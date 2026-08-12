import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, requireTenantId } from "@pawlog/database";
import {
  buildPaginatedData,
  normalizePhone,
  resolvePagination,
  MEMBERSHIP_STATUS,
  ROLES,
  type PaginationQuery,
  type UpdateTenantRequest,
} from "@pawlog/shared";
import {
  OnboardTenantDto,
  TenantDirectoryQueryDto,
  UpdateTenantSettingsDto,
} from "../dtos";
import { PlatformSubscriptionService } from "../../subscription/services/platform-subscription.service";
import { GeocodingService } from "../../shared/geo/services/geocoding.service";
import { buildAddressData } from "../../shared/utils/address";
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
  constructor(
    private readonly platformSubscription: PlatformSubscriptionService,
    private readonly geocoding: GeocodingService,
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
      },
      orderBy: { name: "asc" },
      // 지도는 화면 안의 매장을 한 번에 받아야 핀이 빠지지 않으므로 영역 조회일 때 넉넉히 준다.
      take: hasBounds ? 200 : 20,
    });
    return { tenants };
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

    const { tenant } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, subdomain, ...address.data },
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
  } as const;

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
    return { tenant };
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
      },
      select: this.settingsSelect,
    });

    // 저장은 성공했다. 다만 좌표를 못 얻었으면 이 매장은 지도에 뜨지 않으므로,
    // 화면이 그 사실을 말할 수 있도록 함께 알린다(에러가 아니다).
    return { tenant, geocodeFailed: address.geocodeFailed };
  }
}
