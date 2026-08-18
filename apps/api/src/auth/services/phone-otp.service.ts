import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { prisma } from "@pawlog/database";
import { normalizePhone, PHONE_MAX_DIGITS } from "@pawlog/shared";

import { RedisService } from "../../shared/redis/redis.service";
import { SolapiClientService } from "../../notification/services/solapi-client.service";
import { otpConfig } from "../../shared/configs/otp.config";
import { solapiConfig } from "../../shared/configs/solapi.config";

const MIN_PHONE_DIGITS = 10;

/**
 * 휴대폰 본인확인 (job-042).
 *
 * ## 왜 필요한가
 *
 * 이 서비스에서 전화번호는 **소유권의 열쇠**다. 매장이 미가입 보호자의 아이를 번호로
 * 등록해 두고(job-040), 그 번호로 가입하는 사람에게 아이·알림장·사진이 통째로 넘어간다
 * (`claimForUser`). 지금까지 그 번호는 자기신고였으므로, **남의 번호를 입력하는 것만으로
 * 남의 아이 기록에 접근할 수 있었다.**
 *
 * OTP 가 닫는 것은 정확히 그 한 칸이다 — "번호를 안다"와 "그 번호를 지금 손에 쥐고 있다"의 차이.
 *
 * ## 왜 SMS 인가 (알림톡이 아니라)
 *
 * OTP 가 증명하려는 것이 **번호의 소유**이기 때문이다. 알림톡은 그 번호에 연결된 카카오
 * *계정*에 도달하므로 한 단계 우회이고, 카톡을 안 쓰거나 차단하면 실패해 결국 SMS 폴백이
 * 필요하다. 경로를 둘로 만들 이유가 없다. (알림톡은 정보성 메시지가 원칙이라 인증번호
 * 템플릿은 심사에서 반려될 여지도 있다.)
 *
 * ## 저장 구조 (Redis)
 *
 *   otp:code:{userId}:{phone}      → 해시된 코드 + 시도 횟수   (TTL 5분)
 *   otp:cooldown:{userId}:{phone}  → 재발송 잠금               (TTL 30초)
 *   otp:daily:{phone}              → 하루 발송 수              (TTL 24시간)
 *   otp:verified:{userId}:{phone}  → 검증 완료 표시            (TTL 10분)
 *
 * 키에 `userId` 가 들어가는 이유: 검증 결과가 **그 사람의 것**이어야 한다. 번호만으로
 * 키를 만들면 A 가 인증한 결과를 B 가 주워 쓸 수 있다.
 */
@Injectable()
export class PhoneOtpService {
  private readonly logger = new Logger(PhoneOtpService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly solapi: SolapiClientService,
  ) {}

  private codeKey = (userId: string, phone: string) =>
    `otp:code:${userId}:${phone}`;
  private cooldownKey = (userId: string, phone: string) =>
    `otp:cooldown:${userId}:${phone}`;
  private dailyKey = (phone: string) =>
    `otp:daily:${phone}:${new Date().toISOString().slice(0, 10)}`;
  private verifiedKey = (userId: string, phone: string) =>
    `otp:verified:${userId}:${phone}`;

  /** 코드는 평문으로 두지 않는다 — Redis 를 읽을 수 있는 사람이 곧 인증을 통과해서는 안 된다. */
  private hash = (code: string) =>
    crypto.createHash("sha256").update(code).digest("hex");

  /**
   * 이미 **다른 계정**이 쓰고 있는 번호인지 본다.
   *
   * ## 왜 막아야 하나
   *
   * 이 번호는 표시 데이터가 아니라 **매칭 키**다. 매장이 미가입 보호자의 아이를 번호로
   * 등록해 두고(job-040), 가입하는 사람에게 `claimForUser` 가 그 아이·알림장·사진을
   * 넘긴다. 같은 번호를 두 계정이 들고 있으면 **그 소유권이 누구 것인지 정해지지 않는다.**
   * 실제로 `PetIntakeService.findSingleUserByPhone` 은 그 상황에서 아이를 임의로 넘기지
   * 않으려고 409 로 멈추는데, 그 결과 원장은 번호를 알고 있는데도 **원생 조회가 통째로
   * 막힌다.** 중복은 나중에 푸는 것보다 들어올 때 막는 편이 훨씬 싸다.
   *
   * ## 본인 번호 재인증은 막지 않는다
   *
   * 이미 자기 번호를 등록한 사람이 프로필에서 다시 인증하는 것은 정상 흐름이다.
   * 그래서 **다른 userId** 가 쓰고 있을 때만 막는다.
   *
   * ⚠️ 이 응답은 "그 번호를 쓰는 계정이 있다"를 알려주므로 계정 열거에 쓰일 여지가 있다.
   * 다만 이 엔드포인트는 **로그인해야 부를 수 있고**(`@Public()` 없음) 번호당 일일 발송
   * 한도와 재발송 쿨다운이 함께 걸려 있어 대량 조회로는 쓰기 어렵다. 그 위험보다 "번호가
   * 겹친 채 가입이 끝나 원생 연결이 막히는" 쪽이 실제로 더 자주, 더 크게 아프다.
   */
  private async assertPhoneNotTaken(userId: string, phone: string) {
    const owner = await prisma.user.findFirst({
      where: { phone, NOT: { id: userId } },
      select: { id: true },
    });
    if (!owner) return;

    this.logger.warn(
      `이미 등록된 번호로 인증을 시도했습니다. phone=${this.mask(phone)}`,
    );
    throw new ConflictException(
      "이미 다른 계정에 등록된 휴대폰 번호입니다. 이전에 가입한 계정으로 로그인하시거나, 다른 번호를 입력해주세요.",
    );
  }

  private requireValidPhone(raw: string): string {
    const phone = normalizePhone(raw ?? "");
    if (phone.length < MIN_PHONE_DIGITS || phone.length > PHONE_MAX_DIGITS) {
      throw new BadRequestException("올바른 휴대폰 번호를 입력해주세요.");
    }
    return phone;
  }

  /** 로그에 번호를 통째로 남기지 않는다. */
  private mask = (phone: string) =>
    `${phone.slice(0, 3)}****${phone.slice(-4)}`;

  /**
   * 인증번호 발송.
   *
   * 세 겹으로 제한한다. 수신자는 문자 비용을 내지 않지만 **괴롭힘의 대상은 될 수 있다** —
   * 남의 번호를 넣고 연타하는 것을 막는 것이 재발송 제한의 실제 목적이다.
   */
  async issue(userId: string, rawPhone: string) {
    const phone = this.requireValidPhone(rawPhone);

    // ⚠️ 중복 검사를 **문자를 보내기 전에** 한다. 보내 놓고 저장 단계에서 막으면 사용자는
    // 인증번호를 받아 6자리를 정확히 입력하고 나서야 "쓸 수 없는 번호"라는 말을 듣는다.
    // 실패할 것을 알면서 문자 비용을 쓴 셈이고, 사용자는 자기가 뭘 잘못했는지 모른다.
    // 막을 것은 인증이 아니라 **인증 시도 자체**다.
    await this.assertPhoneNotTaken(userId, phone);

    if (!solapiConfig.isConfigured) {
      // 조용히 성공한 척하면 사용자는 오지 않는 문자를 기다린다. 명시적으로 막는다.
      throw new ServiceUnavailableException(
        "문자 발송이 설정되지 않아 인증번호를 보낼 수 없습니다. 관리자에게 문의해주세요.",
      );
    }

    if (await this.redis.get(this.cooldownKey(userId, phone))) {
      throw new HttpException(
        `잠시 후 다시 시도해주세요. (${otpConfig.resendCooldownSec}초)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const dailyKey = this.dailyKey(phone);
    const sentToday = Number((await this.redis.get(dailyKey)) ?? 0);
    if (sentToday >= otpConfig.dailyLimitPerPhone) {
      throw new HttpException(
        "오늘 이 번호로 보낼 수 있는 인증번호 횟수를 초과했습니다. 내일 다시 시도해주세요.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 앞자리가 0 이어도 자릿수가 유지되도록 문자열로 만든다.
    const code = String(crypto.randomInt(0, 10 ** otpConfig.length)).padStart(
      otpConfig.length,
      "0",
    );

    await this.solapi.sendSms({
      to: phone,
      text: `[Pawlog] 인증번호 ${code} 를 입력해주세요. (${Math.floor(otpConfig.ttlSec / 60)}분 내 유효)`,
    });

    await this.redis.set(
      this.codeKey(userId, phone),
      JSON.stringify({ hash: this.hash(code), attempts: 0 }),
      otpConfig.ttlSec,
    );
    await this.redis.set(
      this.cooldownKey(userId, phone),
      "1",
      otpConfig.resendCooldownSec,
    );
    await this.redis.set(dailyKey, String(sentToday + 1), 24 * 60 * 60);

    this.logger.log(`인증번호를 발송했습니다. phone=${this.mask(phone)}`);

    return { expiresInSec: otpConfig.ttlSec };
  }

  /** 인증번호 확인. 맞으면 "이 사람이 이 번호를 가졌다"는 표시를 남긴다. */
  async verify(userId: string, rawPhone: string, code: string) {
    const phone = this.requireValidPhone(rawPhone);
    const key = this.codeKey(userId, phone);

    const raw = await this.redis.get(key);
    if (!raw) {
      throw new BadRequestException(
        "인증번호가 만료되었거나 발송되지 않았습니다. 다시 요청해주세요.",
      );
    }

    const saved = JSON.parse(raw) as { hash: string; attempts: number };

    if (saved.hash !== this.hash(code.trim())) {
      const attempts = saved.attempts + 1;
      if (attempts >= otpConfig.maxAttempts) {
        // 한도를 넘으면 코드를 폐기한다. 남겨두면 자릿수의 의미가 사라진다.
        await this.redis.del(key);
        throw new BadRequestException(
          "인증번호를 여러 번 틀렸습니다. 처음부터 다시 요청해주세요.",
        );
      }
      await this.redis.set(
        key,
        JSON.stringify({ ...saved, attempts }),
        otpConfig.ttlSec,
      );
      throw new BadRequestException(
        `인증번호가 올바르지 않습니다. (${otpConfig.maxAttempts - attempts}회 남음)`,
      );
    }

    // 성공한 코드는 즉시 폐기한다 — 한 번 맞힌 코드를 재사용할 수 있으면 안 된다.
    await this.redis.del(key);
    await this.redis.set(
      this.verifiedKey(userId, phone),
      "1",
      otpConfig.verifiedTtlSec,
    );

    this.logger.log(`휴대폰 본인확인 완료. phone=${this.mask(phone)}`);

    return { verified: true as const };
  }

  /**
   * 이 사람이 이 번호를 방금 인증했는가.
   *
   * 번호를 저장하는 쪽(`complete-profile`, `PATCH me`)이 저장 직전에 부른다. 표시는
   * **한 번 쓰면 지운다** — 남겨두면 유효시간 동안 같은 번호를 여러 번 저장할 수 있고,
   * 그건 인증 한 번으로 여러 요청을 통과시키는 것과 같다.
   */
  async consumeVerification(
    userId: string,
    rawPhone: string,
  ): Promise<boolean> {
    const phone = this.requireValidPhone(rawPhone);
    const key = this.verifiedKey(userId, phone);

    if (!(await this.redis.get(key))) return false;
    await this.redis.del(key);
    return true;
  }

  /**
   * 번호를 저장하기 전에 본인확인을 강제한다.
   *
   * ⚠️ `ALLOW_UNVERIFIED_PHONE=true` 면 통과시킨다 — 발신번호 등록 전이나 로컬에서
   * 흐름을 끝까지 돌려보기 위한 임시 탈출구이고, 켜져 있는 동안 job-042 의 취약점은
   * 그대로 열려 있다. 부팅 로그가 그 사실을 매번 알린다.
   */
  async assertVerified(userId: string, rawPhone: string) {
    if (otpConfig.allowUnverified) {
      this.logger.warn(
        `ALLOW_UNVERIFIED_PHONE=true — 본인확인 없이 전화번호를 저장합니다. userId=${userId}`,
      );
      return;
    }

    if (!(await this.consumeVerification(userId, rawPhone))) {
      throw new BadRequestException(
        "휴대폰 본인확인이 필요합니다. 인증번호를 받아 확인해주세요.",
      );
    }
  }
}
