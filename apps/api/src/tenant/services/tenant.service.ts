import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, prisma, requireTenantId } from "@pawlog/database";
import {
  buildPaginatedData,
  fromDateKey,
  normalizeBusinessHours,
  normalizePhone,
  parseBusinessHours,
  resolvePagination,
  toDateKey,
  validateBusinessHours,
  MEMBERSHIP_STATUS,
  ROLES,
  type BusinessHours,
  type PaginationQuery,
  type UpdateTenantRequest,
} from "@pawlog/shared";
import {
  CreateTenantClosureDto,
  OnboardTenantDto,
  TenantDirectoryQueryDto,
  UpdateTenantSettingsDto,
} from "../dtos";
import { PlatformSubscriptionService } from "../../subscription/services/platform-subscription.service";
import { NotificationService } from "../../notification/services/notification.service";
import { GeocodingService } from "../../shared/geo/services/geocoding.service";
import { buildAddressData } from "../../shared/utils/address";
import {
  resolveGuardianPhone,
  scheduledOn,
  startOfToday,
} from "../../shared/utils";
import {
  normalizeSubdomain,
  validateSubdomainFormat,
} from "../../shared/utils/tenant";

const TENANT_SORTABLE_FIELDS = [
  "createdAt",
  "name",
  "subdomain",
  "isActive",
] as const;

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly platformSubscription: PlatformSubscriptionService,
    private readonly geocoding: GeocodingService,
    // job-060: 임시 휴무로 풀린 등원 예정일을 보호자에게 통보한다.
    private readonly notification: NotificationService,
  ) {}

  /** 서브도메인 형식/예약어를 검증하고, 이미 사용 중이면 사유를 담아 반환한다. */
  async checkSubdomainAvailability(rawSubdomain: string) {
    const subdomain = normalizeSubdomain(rawSubdomain);
    const formatError = validateSubdomainFormat(subdomain);
    if (formatError) {
      return { subdomain, available: false, reason: formatError };
    }

    const existing = await prisma.tenant.findUnique({ where: { subdomain } });
    if (existing) {
      return {
        subdomain,
        available: false,
        reason: "이미 사용 중인 서브도메인입니다.",
      };
    }

    return { subdomain, available: true };
  }

  /**
   * 공개 매장 검색 (job-034) — 보호자가 가입 신청할 매장을 찾는 용도.
   * 로그인 전에도 열리는 경로라 이름/서브도메인 외의 정보는 절대 내리지 않는다.
   * 운영 중(isActive)인 매장만 노출한다.
   */
  async searchDirectory(query: TenantDirectoryQueryDto = {}) {
    const { search, swLat, swLng, neLat, neLng } = query;

    // 넷이 **모두** 있을 때만 영역 필터를 건다. 하나라도 빠진 좌표로 자르면 사용자는
    // 매장이 왜 사라졌는지 알 수 없는 화면을 보게 된다.
    const hasBounds = [swLat, swLng, neLat, neLng].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    );

    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        // job-059: 매장이 스스로 노출을 끌 수 있다. 소규모 매장은 주소가 곧 자택이다.
        isListed: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                {
                  subdomain: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
        ...(hasBounds
          ? {
              latitude: { gte: swLat, lte: neLat },
              longitude: { gte: swLng, lte: neLng },
            }
          : {}),
      },
      // ⚠️ 이 응답은 @Public() 이다. 담는 것은 전부 "영업 정보로서 공개해도 되는가"를
      // 통과해야 한다. **addressDetail(층/호)은 일부러 빠져 있다** — 핀에 필요 없고,
      // 소규모 매장은 그것까지 공개하면 사실상 자택 호수를 공개하는 것이 된다.
      select: {
        id: true,
        name: true,
        subdomain: true,
        roadAddress: true,
        latitude: true,
        longitude: true,
        contactPhone: true,
        // job-060: 운영시간은 영업 정보라 공개해도 되는 축에 든다 — 오히려 보호자가
        // 매장을 고를 때 주소 다음으로 먼저 보는 값이다.
        businessHours: true,
      },
      orderBy: { name: "asc" },
      // 지도는 화면 안의 매장을 한 번에 받아야 핀이 빠지지 않으므로 영역 조회일 때 넉넉히 준다.
      take: hasBounds ? 200 : 20,
    });
    return { tenants: tenants.map((tenant) => this.withBusinessHours(tenant)) };
  }

  /**
   * 테넌트 온보딩 (job-034) — **로그인한 회원이 보유한 미사용 매장 개설권 1건을 소비**해
   * 매장을 만들고, 본인에게 TENANT_ADMIN 멤버십을 부여한다.
   *
   * 예전에는 @Public 이라 누구나 무제한으로 매장을 만들 수 있었다. 이제는 개설권 구독이
   * 선행되어야 하며, UserSubscription.tenantId 가 UNIQUE 이므로 하나의 구독으로 두 매장을
   * 열 수 없다(2호점은 구독을 하나 더 결제).
   *
   * 개설권 소비와 매장/멤버십 생성은 한 트랜잭션이다 — 중간에 실패하면 개설권이 소모된 채로
   * 매장이 없는 상태가 되어선 안 된다.
   */
  async onboard(userId: string, dto: OnboardTenantDto) {
    const subdomain = normalizeSubdomain(dto.subdomain);
    const formatError = validateSubdomainFormat(subdomain);
    if (formatError) {
      throw new BadRequestException(formatError);
    }

    const existing = await prisma.tenant.findUnique({ where: { subdomain } });
    if (existing) {
      throw new ConflictException("이미 사용 중인 서브도메인입니다.");
    }

    // 미사용 개설권이 없으면 403. (있으면 그중 가장 먼저 산 것을 반환)
    const entitlement =
      await this.platformSubscription.assertCanOpenTenant(userId);

    // job-059: 주소는 선택이다. 지오코딩은 외부 호출이라 **트랜잭션 밖에서** 먼저 끝낸다 —
    // 안에서 부르면 카카오가 느린 만큼 DB 트랜잭션이 열려 있게 된다.
    const address = await buildAddressData(this.geocoding, dto);

    // job-060: 운영시간도 선택이다. 검증은 트랜잭션 **밖에서** 먼저 한다 — 잘못된
    // 시간표 때문에 개설권을 소비하는 트랜잭션이 열렸다 롤백되는 일이 없게 한다.
    const businessHours = this.buildBusinessHoursData(dto.businessHours);

    const { tenant } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          subdomain,
          ...address.data,
          ...businessHours,
        },
      });

      // 개설권 소비 — tenantId 가 아직 비어 있는 건에만 걸리게 해서, 동시에 두 번 호출돼도
      // 하나만 성공하도록 한다(updateMany + count 검사로 낙관적 잠금 효과).
      const consumed = await tx.userSubscription.updateMany({
        where: { id: entitlement.id, tenantId: null },
        data: { tenantId: tenant.id },
      });
      if (consumed.count !== 1) {
        throw new ConflictException(
          "개설권이 이미 사용되었습니다. 다시 시도해주세요.",
        );
      }

      await tx.tenantMembership.create({
        data: {
          userId,
          tenantId: tenant.id,
          role: ROLES.TENANT_ADMIN,
          status: MEMBERSHIP_STATUS.ACTIVE,
          approvedAt: new Date(),
        },
      });

      return { tenant };
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      omit: { password: true },
    });

    return { tenant, user };
  }

  // ── SUPER_ADMIN 전용 (플랫폼 운영) ──────────────────────────────────
  // Tenant 는 tenantScopeExtension 의 스코프 대상이 아니므로(전역 공용 모델) 아래 조회는
  // ALS 컨텍스트와 무관하게 항상 전체 테넌트를 대상으로 한다. 접근 제한은 컨트롤러의
  // @Roles(SUPER_ADMIN) 가 담당한다.

  /** 테넌트 목록 (페이지네이션·정렬·검색). 소속 사용자/반려동물 수를 함께 반환한다. */
  async listTenants(query: PaginationQuery) {
    const { page, pageSize, skip, take, order, sort, search } =
      resolvePagination(query);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { subdomain: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const sortField = TENANT_SORTABLE_FIELDS.includes(
      sort as (typeof TENANT_SORTABLE_FIELDS)[number],
    )
      ? (sort as string)
      : "createdAt";

    const [items, total] = await prisma.$transaction([
      prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: order },
        include: { _count: { select: { memberships: true, pets: true } } },
      }),
      prisma.tenant.count({ where }),
    ]);

    return buildPaginatedData(items, { page, pageSize, total });
  }

  /**
   * 서브도메인으로 테넌트 1건 조회 (job-050) — apps/web 의 매장 게이트 전용.
   *
   * `getTenant` 와 달리 집계(_count)를 붙이지 않고 게이트가 판단에 쓰는 4개 필드만 내린다.
   * 이 경로는 SUPER_ADMIN 이 **소속되지 않은** 매장을 여는 유일한 입구라, 필요 이상을
   * 흘리지 않는 편이 낫다 — 구성원 수·원생 수는 그 화면들이 각자 스코프된 API 로 가져간다.
   *
   * 정지된 테넌트도 그대로 반환한다. 정지 매장을 열어보고 다시 활성화하는 주체가
   * SUPER_ADMIN 본인이므로, 여기서 감추면 복구 경로가 막힌다
   * (TenantMiddleware.assertActive 가 같은 이유로 SUPER_ADMIN 을 예외 처리한다).
   */
  async getTenantBySubdomain(rawSubdomain: string) {
    const subdomain = normalizeSubdomain(rawSubdomain);
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
      select: { id: true, name: true, subdomain: true, isActive: true },
    });
    if (!tenant) {
      throw new NotFoundException("존재하지 않는 테넌트입니다.");
    }
    return tenant;
  }

  /** 테넌트 상세. */
  async getTenant(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { memberships: true, pets: true } } },
    });
    if (!tenant) {
      throw new NotFoundException("존재하지 않는 테넌트입니다.");
    }
    return tenant;
  }

  /**
   * 테넌트 정보 수정 (이름·서브도메인).
   * 서브도메인은 온보딩과 동일한 정규화/형식/예약어/중복 검증을 거친다 —
   * 변경 시 기존 접속 URL 이 무효화되므로 호출부(UI)에서 별도 확인을 받는다.
   */
  async updateTenant(id: string, dto: UpdateTenantRequest) {
    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("존재하지 않는 테넌트입니다.");
    }

    const data: { name?: string; subdomain?: string } = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.subdomain !== undefined) {
      const subdomain = normalizeSubdomain(dto.subdomain);
      const formatError = validateSubdomainFormat(subdomain);
      if (formatError) {
        throw new BadRequestException(formatError);
      }
      if (subdomain !== existing.subdomain) {
        const duplicated = await prisma.tenant.findUnique({
          where: { subdomain },
        });
        if (duplicated) {
          throw new ConflictException("이미 사용 중인 서브도메인입니다.");
        }
      }
      data.subdomain = subdomain;
    }

    const tenant = await prisma.tenant.update({ where: { id }, data });
    return { tenant };
  }

  /**
   * 테넌트 활성/정지 토글.
   * isActive=false 인 테넌트는 TenantMiddleware 의 assertActive 가 모든 요청을 403 으로 막는다
   * (요금 미납·계약 종료 가맹점 차단 경로). 지금까지 이 값을 바꿀 수 있는 API 가 없어
   * DB 직접 수정에 의존했던 부분을 대체한다.
   */
  async setTenantActive(id: string, isActive: boolean) {
    const existing = await prisma.tenant.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("존재하지 않는 테넌트입니다.");
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { isActive },
    });
    return { tenant };
  }

  // ── 매장 설정 (job-059) — TENANT_ADMIN 이 자기 매장을 고친다 ──────────
  //
  // 위의 `updateTenant`/`setTenantActive` 는 SUPER_ADMIN 전용 플랫폼 경로다. 원장이
  // 부를 수 있는 것이 하나도 없어서 **자기 매장 주소를 넣을 방법 자체가 없었다.**
  //
  // 대상은 언제나 `requireTenantId()` 가 주는 **활성 테넌트**다. id 를 인자로 받지
  // 않는 이유가 그것 — 남의 매장 id 를 넣어볼 자리를 아예 만들지 않는다.

  private readonly settingsSelect = {
    id: true,
    name: true,
    subdomain: true,
    contactPhone: true,
    postalCode: true,
    roadAddress: true,
    addressDetail: true,
    latitude: true,
    longitude: true,
    isListed: true,
    isActive: true,
    businessHours: true,
  } as const;

  /**
   * 운영시간 JSONB 를 계약 모양으로 좁혀 내보낸다 (job-060).
   *
   * Prisma 는 JSONB 를 `JsonValue` 로 주고 DB 는 모양을 검사해 주지 않으므로, **읽는
   * 쪽에서** 한 번 더 확인하지 않으면 옛 행이나 손으로 고친 행이 그대로 화면까지 간다.
   * 그러면 `days.map` 이 터지면서 설정 화면이 통째로 렌더에 실패하는데, SSR 은 200 이라
   * 서버 로그에는 아무것도 남지 않는다(job-044 와 같은 실패 방식이다).
   */
  private withBusinessHours<T extends { businessHours: unknown }>(
    tenant: T,
  ): Omit<T, "businessHours"> & { businessHours: BusinessHours | null } {
    return {
      ...tenant,
      businessHours: parseBusinessHours(tenant.businessHours),
    };
  }

  /** 매장 설정 조회. 원장에게는 상세주소까지 전부 보인다(공개 디렉터리와 다르다). */
  async getSettings() {
    const tenantId = requireTenantId();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: this.settingsSelect,
    });
    if (!tenant) {
      throw new NotFoundException("존재하지 않는 매장입니다.");
    }
    return { tenant: this.withBusinessHours(tenant) };
  }

  /** 매장 설정 수정. 보내지 않은 칸은 건드리지 않는다. */
  async updateSettings(dto: UpdateTenantSettingsDto) {
    const tenantId = requireTenantId();

    // 지오코딩은 외부 호출이므로 DB 를 잡기 전에 끝낸다.
    const address = await buildAddressData(this.geocoding, dto);

    const name = dto.name?.trim();
    if (dto.name !== undefined && !name) {
      throw new BadRequestException("매장 이름은 비울 수 없습니다.");
    }

    const businessHours = this.buildBusinessHoursData(dto.businessHours);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name !== undefined ? { name } : {}),
        // job-043: 전화번호 저장은 언제나 숫자만. 빈 문자열은 "지웠다"로 읽어 null 로 만든다
        // — 빈 문자열이 저장되면 "번호가 있다"로 취급돼 폴백이 걸리지 않는다.
        ...(dto.contactPhone !== undefined
          ? { contactPhone: normalizePhone(dto.contactPhone) || null }
          : {}),
        ...(dto.isListed !== undefined ? { isListed: dto.isListed } : {}),
        ...address.data,
        ...businessHours,
      },
      select: this.settingsSelect,
    });

    // 저장은 성공했다. 다만 좌표를 못 얻었으면 이 매장은 지도에 뜨지 않으므로,
    // 화면이 그 사실을 말할 수 있도록 함께 알린다(에러가 아니다).
    return {
      tenant: this.withBusinessHours(tenant),
      geocodeFailed: address.geocodeFailed,
    };
  }

  // ── 임시 휴무일 (job-060) ───────────────────────────────────────────
  //
  // 요일 시간표가 "평소"라면 이쪽은 그 예외다. 명절·워크샵·소독·원장 사정처럼 요일
  // 패턴으로 표현할 수 없는 하루가 실제로 있고, 등원 예약이 생긴 뒤로는 이걸 표현하지
  // 못하면 **매장이 쉬는 날에 보호자가 예약을 잡는다.**

  /**
   * 휴무일 목록. `month` 를 주면 그 달, 안 주면 **오늘 이후 전부**.
   *
   * 지난 휴무일을 기본으로 빼는 이유는 이 화면이 "앞으로 언제 쉬는가"를 보는 자리이기
   * 때문이다. 지나간 휴무는 지울 이유도 볼 이유도 없는데 목록만 계속 길어진다.
   */
  async listClosures(month?: string) {
    const tenantId = requireTenantId();

    const range = month
      ? (() => {
          const [year, monthOfYear] = month.split("-").map(Number);
          return {
            // 반경계 구간이다. `lte: 말일` 로 쓰면 `@db.Date` 가 아닌 환경에서 그 날의
            // 00:00 이후가 잘려 말일이 통째로 빠진다.
            gte: new Date(year, monthOfYear - 1, 1),
            lt: new Date(year, monthOfYear, 1),
          };
        })()
      : { gte: startOfToday() };

    const closures = await prisma.tenantClosure.findMany({
      where: { tenantId, date: range },
      orderBy: { date: "asc" },
      select: { id: true, date: true, reason: true },
    });

    return {
      closures: closures.map((closure) => ({
        id: closure.id,
        date: toDateKey(closure.date),
        reason: closure.reason,
      })),
    };
  }

  /**
   * 휴무일 등록.
   *
   * ⚠️ **그 날 잡혀 있던 등원 예정일을 함께 지우고, 보호자에게 통보한다** (job-060).
   * 지우기만 하면 그 사실은 보호자가 앱을 다시 열어야만 보이는데, 다시 열 이유가 없는
   * 사람은 끝까지 모른 채 **문 닫은 매장 앞에 아이를 데리고 선다.** 통보하지 않는 취소는
   * 취소가 아니다.
   *
   * 지운 예약은 이용권을 되돌릴 것이 없다(예약은 애초에 차감하지 않는다, job-060).
   * 그래서 이 조작은 잔액에 아무 영향이 없고, 보호자는 다른 날을 다시 잡으면 된다.
   */
  async createClosure(dto: CreateTenantClosureDto) {
    const tenantId = requireTenantId();
    const date = fromDateKey(dto.date);

    if (date < startOfToday()) {
      throw new BadRequestException("지난 날짜는 휴무일로 지정할 수 없습니다.");
    }

    const existing = await prisma.tenantClosure.findFirst({
      where: { tenantId, date },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("이미 휴무일로 지정된 날짜입니다.");
    }

    const reason = dto.reason?.trim();

    // ⚠️ 통보 대상은 **지우기 전에** 모은다. 삭제하고 나면 그 날 누가 오기로 했는지를
    // 알 방법이 사라진다(어떤 예약이 있었는지 따로 기록하지 않는다, §3.2).
    const affected = await this.petsScheduledOn(date);

    // 휴무 등록과 예약 해제는 한 트랜잭션이어야 한다. 사이가 벌어지면 그 틈에 들어온
    // 예약이 살아남아, 쉬는 날에 예약이 하나 붙어 있는 상태가 된다.
    const { closure, released } = await prisma.$transaction(async (tx) => {
      const closure = await tx.tenantClosure.create({
        data: { tenantId, date, reason: reason ? reason : null },
        select: { id: true, date: true, reason: true },
      });

      const { count } = await tx.petSchedule.deleteMany({
        where: { tenantId, date },
      });

      return { closure, released: count };
    });

    // ⚠️ 발송은 트랜잭션 **밖**이다. 알림톡은 외부 호출이라 느리고 실패할 수 있는데,
    // 그것 때문에 휴무 등록이 되돌아가면 안 된다 — 매장이 쉬는 것은 이미 정해진 사실이고
    // 알림은 그 사실을 전하는 부수 효과다.
    const notified = await this.notifyClosure(affected, {
      date,
      reason: closure.reason,
    });

    return {
      closure: {
        id: closure.id,
        date: toDateKey(closure.date),
        reason: closure.reason,
      },
      releasedReservations: released,
      // 통보 **대상** 수와 실제로 **닿은** 수를 따로 준다. 하나로 합치면 화면이
      // "몇 명에게 직접 전화해야 하는가"를 말할 수 없다.
      affectedPets: affected.length,
      notifiedGuardians: notified,
    };
  }

  /**
   * 그 날 등원 예정이던 아이들 — 휴무 통보 대상 (job-060).
   *
   * ⚠️ **삭제된 `PetSchedule` 행을 세는 것으로는 부족하다.** WEEKLY 아이의 정기 등원일은
   * 요일 패턴이라 날짜 행으로 저장되지 않으므로(job-053), 행만 보면 **매주 그 요일에
   * 오는 아이들이 통째로 빠진다** — 정작 아무것도 예약하지 않고도 그 날 오는 사람들이다.
   * 그래서 판정은 출석부와 같은 `scheduledOn` 으로 한다.
   *
   * 이미 등원 체크가 끝난 아이는 뺀다. 오늘을 휴무로 지정하는 경우(허용된다)에 그 사람은
   * 이미 아이를 데려다줬으므로, "등원이 취소되었습니다"는 사실과 다르다.
   */
  private async petsScheduledOn(date: Date) {
    const attended = await prisma.attendance.findMany({
      where: { date, status: { not: "SCHEDULED" } },
      select: { petId: true },
    });
    const attendedIds = new Set(attended.map((row) => row.petId));

    const pets = await prisma.pet.findMany({
      where: { status: "ACTIVE", ...scheduledOn(date) },
      select: {
        id: true,
        name: true,
        userId: true,
        guardianPhone: true,
        user: { select: { phone: true } },
      },
    });

    return pets.filter((pet) => !attendedIds.has(pet.id));
  }

  /**
   * 휴무 통보 발송. **한 명의 실패가 나머지를 막지 않는다.**
   *
   * 순차로 보내는 것은 의도다 — 원생 30마리를 동시에 던지면 중계사 rate limit 에 걸려
   * 뒤쪽이 통째로 실패하는데, 그 실패는 `NotificationLog` 에만 남고 원장은 전부 보낸 줄
   * 안다. 발송 자체는 `NotificationService` 가 알림톡 → SMS 폴백까지 처리한다.
   */
  private async notifyClosure(
    pets: {
      id: string;
      name: string;
      userId: string | null;
      guardianPhone: string | null;
      user: { phone: string | null } | null;
    }[],
    closure: { date: Date; reason: string | null },
  ): Promise<number> {
    if (pets.length === 0) return 0;

    const tenant = await prisma.tenant.findUnique({
      where: { id: requireTenantId() },
      select: { name: true },
    });

    let sent = 0;
    for (const pet of pets) {
      const guardianPhone = resolveGuardianPhone(pet);
      if (!guardianPhone) continue;

      try {
        // ⚠️ 발송 성공만 센다. 알림톡도 SMS 도 실패한 건까지 세면 화면이 "N명에게
        // 안내를 보냈습니다"라고 말하는데 실제로는 아무도 못 받은 상태가 된다.
        const delivered = await this.notification.notifyTenantClosure({
          userId: pet.userId,
          petId: pet.id,
          petName: pet.name,
          guardianPhone,
          tenantName: tenant?.name ?? "유치원",
          date: closure.date,
          reason: closure.reason,
        });
        if (delivered) sent += 1;
      } catch (error) {
        // 여기까지 오는 것은 로그 기록 실패 같은 예외적인 경우다(발송 실패는
        // NotificationService 안에서 폴백·기록으로 끝난다). 한 건 때문에 나머지
        // 보호자가 통보를 못 받는 쪽이 훨씬 나쁘다.
        this.logger.error(
          `휴무 통보 발송에 실패했습니다. petId=${pet.id}: ${
            (error as Error).message
          }`,
        );
      }
    }

    return sent;
  }

  /**
   * 휴무일 해제.
   *
   * ⚠️ 지워졌던 예약은 **되살리지 않는다.** 어떤 예약이 있었는지 기록해 두지 않기도
   * 했지만, 되살리는 편이 더 나쁘다 — 보호자는 그 사이 다른 날로 옮겨 잡았을 수 있고,
   * 그러면 본인이 모르는 예약이 하나 더 생긴다. 다시 여는 것까지가 매장의 몫이고,
   * 그 날 받을지는 보호자가 다시 고른다.
   */
  async deleteClosure(dateKey: string) {
    const tenantId = requireTenantId();

    const closure = await prisma.tenantClosure.findFirst({
      where: { tenantId, date: fromDateKey(dateKey) },
      select: { id: true },
    });
    if (!closure) {
      throw new NotFoundException("지정된 휴무일이 없습니다.");
    }

    await prisma.tenantClosure.delete({ where: { id: closure.id } });
    return { canceled: dateKey };
  }

  /**
   * 운영시간 저장값을 만든다 — 미전달 / 지우기(`null`) / 교체를 구분한다 (job-060).
   *
   * ⚠️ JSONB 는 DB 가 모양을 검사해 주지 않는다. 그래서 **여기가 유일한 관문**이다:
   * 의미 검증(`validateBusinessHours`)을 통과하지 못한 값은 어디에도 남지 않고,
   * 통과한 값도 정규화(`normalizeBusinessHours`)를 거쳐 7요일이 채워진 모양으로만
   * 저장된다. 화면이 이미 같은 검사를 하지만 서버가 마지막 방어선이다 — API 를 직접
   * 부르는 경로(스크립트·연동)로 들어와도 갈리지 않아야 한다.
   */
  private buildBusinessHoursData(input: BusinessHours | null | undefined) {
    if (input === undefined) return {};

    // 명시적 null = "등록을 지운다". Prisma 에서 JSON 칸을 NULL 로 만들려면 `JsonNull`
    // 이어야 한다 — 자바스크립트 `null` 을 그대로 넣으면 타입 에러가 난다.
    if (input === null) return { businessHours: Prisma.JsonNull };

    const errors = validateBusinessHours(input);
    if (errors.length > 0) {
      throw new BadRequestException(errors.join("\n"));
    }

    return {
      businessHours: normalizeBusinessHours(
        input,
      ) as unknown as Prisma.InputJsonValue,
    };
  }
}
