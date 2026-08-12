import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, runWithoutTenant } from "@pawlog/database";
import * as crypto from "crypto";

/** 링크 유효기간. 알림톡을 받은 당일 보는 것이 정상이고, 늦게 눌러도 며칠은 열려야 한다. */
const LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const secret = () =>
  process.env.REPORT_LINK_SECRET ??
  process.env.JWT_ACCESS_SECRET ??
  "pawlog-report-link-dev-secret";

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

/**
 * 비회원 보호자용 알림장 공개 링크 (job-040).
 *
 * ## 왜 필요한가
 *
 * 알림톡은 계정 없이 전화번호로 나간다. 그런데 그 알림톡에 담는 링크가 로그인을 요구하면
 * 결국 가입해야 볼 수 있고, "설치도 가입도 요구하지 않는다"는 전제가 마지막 한 칸에서
 * 무너진다. 그래서 링크 자체가 **자기 자신을 증명하는** 형태여야 한다.
 *
 * ## 왜 DB 토큰이 아니라 서명인가
 *
 * 리포트마다 토큰 컬럼을 두면 발송할 때마다 쓰기가 생기고, 만료를 따로 청소해야 하고,
 * 재발송 시 토큰을 재사용할지 새로 낼지를 또 정해야 한다. HMAC 서명은 상태가 없어서
 * 이 셋이 전부 사라진다. 대신 **개별 무효화가 안 되므로** 유효기간을 짧게 잡는다.
 *
 * ## 이 링크로 볼 수 있는 것
 *
 * 그 리포트 하나뿐이다. 링크를 아는 사람은 그 아이의 그날 알림장을 보게 되므로,
 * 보호자 연락처·다른 아이·다른 날짜는 응답에 담지 않는다. 발행(PUBLISHED)되지 않은
 * 리포트도 열리지 않는다 — 작성 중인 초안이 링크로 새어나가면 안 된다.
 */
@Injectable()
export class ReportShareService {
  /**
   * `<payload>.<signature>` 형태의 토큰을 만든다.
   *
   * job-047: 페이로드에 **아이(petId)** 도 담는다. 예전에는 알림장 1건만 가리켜서, 링크를
   * 받은 미가입 보호자가 볼 수 있는 것이 그날 한 장뿐이었다 — 매일 새 링크를 받는 일회성
   * 알림에 가까웠다. 아이를 알면 "지난 알림장"을 같은 링크에서 이어 볼 수 있고, 그때부터
   * 이 링크가 **우리 아이 기록이 쌓이는 곳**이 된다(그게 단톡방을 이기는 지점이다).
   *
   * 유출 시 노출 범위가 그 아이의 발행된 알림장 전체로 넓어지는 대신 유효기간을 짧게 둔다.
   */
  createToken(dailyReportId: string, petId: string): string {
    const payload = b64url(
      JSON.stringify({
        id: dailyReportId,
        petId,
        exp: Date.now() + LINK_TTL_MS,
      }),
    );
    return `${payload}.${this.sign(payload)}`;
  }

  /**
   * 토큰을 검증하고 리포트를 반환한다.
   *
   * 실패 이유(위조/만료/없는 리포트)를 구분해서 알려주지 않는다 — 토큰을 넣어보는 쪽에
   * "서명은 맞는데 만료됐다" 같은 힌트를 주지 않기 위해서다. 사용자에게는 화면에서
   * "링크가 만료되었어요" 한 문장으로 안내한다.
   */
  async findByToken(token: string) {
    const [payload, signature] = (token ?? "").split(".");
    if (!payload || !signature) {
      throw new BadRequestException("링크가 올바르지 않습니다.");
    }

    const expected = this.sign(payload);
    // 타이밍 공격 방지를 위해 길이를 먼저 맞춘 뒤 상수시간 비교한다.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new BadRequestException("링크가 올바르지 않거나 만료되었습니다.");
    }

    // JSON.parse 는 any 를 돌려주므로 unknown 으로 받아 좁힌다. 서명이 맞았어도 페이로드
    // 모양까지 믿지는 않는다 — 예전 형식의 토큰이 남아 있을 수 있다.
    let decoded: { id?: string; petId?: string; exp?: number } = {};
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      );
      if (parsed && typeof parsed === "object") {
        decoded = parsed as { id?: string; petId?: string; exp?: number };
      }
    } catch {
      throw new BadRequestException("링크가 올바르지 않습니다.");
    }

    if (!decoded.id || !decoded.exp || decoded.exp < Date.now()) {
      throw new BadRequestException("링크가 올바르지 않거나 만료되었습니다.");
    }

    // 테넌트 컨텍스트 없이(로그인하지 않은 요청이라 X-Tenant-Id 도 없다) 조회해야 하므로
    // 자동 스코프를 명시적으로 끈다. 대신 조회 조건이 id 하나로 이미 충분히 좁다.
    const dailyReport = await runWithoutTenant(() =>
      prisma.dailyReport.findFirst({
        where: { id: decoded.id, status: "PUBLISHED" },
        select: {
          id: true,
          date: true,
          summary: true,
          createdAt: true,
          contents: {
            select: {
              id: true,
              type: true,
              title: true,
              content: true,
              fileId: true,
              order: true,
            },
            orderBy: { order: "asc" },
          },
          // 보호자 연락처·소유 계정은 담지 않는다. 링크만 아는 사람이 볼 화면이다.
          pet: { select: { name: true, profileImageFileId: true } },
          tenant: { select: { name: true } },
        },
      }),
    );

    if (!dailyReport) {
      throw new NotFoundException("알림장을 찾을 수 없습니다.");
    }

    // job-047: 이 아이의 지난 알림장 + 매장 연락처 + (있으면) 초대 토큰을 함께 준다.
    // 셋 다 "링크를 받은 미가입 보호자가 다음에 할 수 있는 일"을 만드는 재료다.
    const petId = decoded.petId ?? null;
    const [history, tenant, invitation] = petId
      ? await runWithoutTenant(() =>
          Promise.all([
            prisma.dailyReport.findMany({
              where: {
                petId,
                status: "PUBLISHED",
                id: { not: dailyReport.id },
              },
              select: { id: true, date: true, summary: true },
              orderBy: { date: "desc" },
              take: 20,
            }),
            prisma.pet
              .findUnique({
                where: { id: petId },
                select: {
                  tenant: { select: { name: true, contactPhone: true } },
                },
              })
              .then((pet) => pet?.tenant ?? null),
            // 아직 계정이 연결되지 않은 아이라면, 이 링크로 가입하는 사람이 번호를 다시
            // 입력하지 않아도 되도록 초대 토큰을 함께 실어 준다. 이미 연결된 아이면 null.
            prisma.tenantInvitation.findFirst({
              where: {
                petId,
                status: "PENDING",
                expiresAt: { gt: new Date() },
              },
              select: { token: true },
            }),
          ]),
        )
      : [[], null, null];

    return {
      dailyReport,
      history,
      tenant: tenant ?? dailyReport.tenant,
      inviteToken: invitation?.token ?? null,
    };
  }

  private sign(payload: string): string {
    return crypto
      .createHmac("sha256", secret())
      .update(payload)
      .digest("base64url");
  }
}
