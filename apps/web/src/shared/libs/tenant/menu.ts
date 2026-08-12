import {
  BellRing,
  ClipboardCheck,
  Images,
  NotebookPen,
  PawPrint,
  Settings,
  Tags,
  Ticket,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ROLES, type MembershipRole } from "@pawlog/shared";

/**
 * 매장 메뉴를 묶는 두 갈래.
 *
 * `operations` 는 오늘 하루를 돌리는 일(등원·사진·알림장·원생)이고, `management` 는
 * 그보다 낮은 빈도로 돌아오는 경영 업무(구성원·이용권·요금제·매출)다. 사이드바에서
 * 이 둘을 나누는 이유는 분류를 좋아해서가 아니라, 10개가 한 덩어리로 붙어 있으면
 * 매일 누르는 4개가 나머지에 묻히기 때문이다.
 */
export type TenantMenuGroup = "operations" | "management";

export interface TenantMenuItem {
  /** `/tenant/[tenant]/` 뒤에 붙는 세그먼트. 링크는 항상 `tenantPath()` 로 만든다. */
  path: string;
  /** 매장 홈 카드에 쓰는 이름. 문장에 가깝게 길어도 된다. */
  label: string;
  /** 사이드바·하단 탭에 쓰는 짧은 이름. */
  short: string;
  description: string;
  icon: LucideIcon;
  /** apps/api 컨트롤러의 `@Roles` 와 같은 기준. 누를 수 없는 메뉴를 그리지 않기 위한 것이다. */
  roles: MembershipRole[];
  group: TenantMenuGroup;
  /**
   * 모바일 하단 탭에도 올릴 것인가.
   *
   * ⚠️ 여기에 표시된 항목은 **최대 5개**여야 한다 (design-system.md §8) — 엄지 도달
   * 범위를 넘으면 끝의 탭은 보이기만 하고 실제로는 안 눌린다. 사이드바에는 그 제약이
   * 없으므로 전체 메뉴가 다 나간다. 메뉴를 늘릴 때 이 플래그를 같이 켜지 말 것.
   */
  bottomTab?: boolean;
}

/**
 * 매장 스코프 메뉴의 **단일 출처** — 매장 홈 카드(`views/tenant-home`)와
 * 내비게이션(`widgets/mobile-nav`)이 둘 다 여기서 읽는다.
 *
 * 전에는 두 곳이 각자 배열을 들고 있었고, 그래서 이용권·요금제·매출·알림 이력·회원 목록
 * 다섯 개가 **홈 카드에만 있고 사이드바에는 없었다**. 데스크톱에서 사이드바로만 이동하는
 * 원장은 매장 홈으로 되돌아가지 않는 한 그 메뉴들의 존재를 알 수 없었다 — 화면과 API 는
 * 멀쩡히 있는데 도달 경로가 없는 상태다. 목록이 둘이면 반드시 다시 갈라지므로 하나로 합쳤다.
 *
 * 순서는 사이드바에 그대로 쓰인다. 그룹 안에서는 **하루 중 쓰는 순서**다.
 */
export const TENANT_MENU: TenantMenuItem[] = [
  {
    path: "feed",
    label: "사진 피드",
    short: "피드",
    description: "사진을 올리면 알림장이 자동으로 만들어집니다.",
    icon: Images,
    roles: [ROLES.STAFF, ROLES.TENANT_ADMIN],
    group: "operations",
    bottomTab: true,
  },
  {
    path: "attendance",
    label: "오늘의 출석부",
    short: "출석부",
    description: "등원·하원을 체크합니다.",
    icon: ClipboardCheck,
    roles: [ROLES.STAFF, ROLES.TENANT_ADMIN],
    group: "operations",
    bottomTab: true,
  },
  {
    path: "daily-reports",
    label: "일일 리포트",
    short: "리포트",
    description: "아이들의 하루를 기록하고 발행합니다.",
    icon: NotebookPen,
    roles: [ROLES.STAFF, ROLES.TENANT_ADMIN],
    group: "operations",
    bottomTab: true,
  },
  {
    path: "pets",
    label: "원생 관리",
    short: "원생",
    description: "등록된 아이들의 정보를 관리합니다.",
    icon: PawPrint,
    // job-046: 신규 원생을 받는 건 데스크 업무라 스태프에게도 연다(등록 API 도 함께 열었다).
    roles: [ROLES.STAFF, ROLES.TENANT_ADMIN],
    group: "operations",
    bottomTab: true,
  },
  {
    path: "members",
    label: "구성원 관리",
    short: "구성원",
    description: "가입 승인, 스태프 초대를 처리합니다.",
    icon: UserCog,
    roles: [ROLES.TENANT_ADMIN],
    group: "management",
    bottomTab: true,
  },
  {
    path: "subscriptions",
    label: "이용권 관리",
    short: "이용권",
    description: "정기권·회수권 판매 현황을 봅니다.",
    icon: Ticket,
    roles: [ROLES.TENANT_ADMIN],
    group: "management",
  },
  {
    // job-051: 우리 유치원이 파는 상품을 직접 만든다. 예전에는 요금제에 주인이 없어
    // 만들 화면조차 없었고, API 로 만들면 다른 유치원 목록에도 떴다.
    path: "plans",
    label: "요금제",
    short: "요금제",
    description: "10회권·월 무제한처럼 우리가 파는 상품을 만듭니다.",
    icon: Tags,
    roles: [ROLES.TENANT_ADMIN],
    group: "management",
  },
  {
    // job-051: 입금 기준 월별 매출. 원장이 pawlog 에 내는 개설권 비용은 여기 섞이지 않는다.
    path: "revenue",
    label: "매출",
    short: "매출",
    description: "이용권 판매로 들어온 돈을 월별로 확인합니다.",
    icon: Wallet,
    roles: [ROLES.TENANT_ADMIN],
    group: "management",
  },
  // "회원 목록"(`users`)은 제거했다 — 매장이 회원을 다루는 창구는 구성원 관리 하나다.
  // 역할 변경은 거기와 완전 중복이었고, 나머지 둘(계정 상태 수정·약관 동의 이력)은
  // 애초에 매장 권한이 아니다. 자세한 이유는 apps/api 의 admin 라우트 주석에 있다.
  {
    // job-046: 알림 실패가 조용해서 원장이 "보냈는데 안 왔다"를 문의로만 알던 문제.
    path: "notifications",
    label: "알림 발송 이력",
    short: "알림 이력",
    description: "알림톡·문자가 제대로 나갔는지 확인합니다.",
    icon: BellRing,
    roles: [ROLES.TENANT_ADMIN],
    group: "management",
  },
  {
    // job-059: 매장 정보(이름·연락처·주소)를 원장이 직접 고치는 자리.
    // 전에는 매장 수정 API 가 SUPER_ADMIN 전용이라 원장이 주소를 넣을 방법이 없었고,
    // 그래서 지도 기반 매장 찾기 자체가 성립하지 않았다.
    path: "settings",
    label: "매장 설정",
    short: "설정",
    description: "매장 이름·연락처·주소를 관리합니다.",
    icon: Settings,
    roles: [ROLES.TENANT_ADMIN],
    group: "management",
  },
];

export const TENANT_MENU_GROUP_LABEL: Record<TenantMenuGroup, string> = {
  operations: "오늘 운영",
  management: "매장 관리",
};

/**
 * 내 역할로 열리는 메뉴만 남긴다.
 *
 * `isPlatformAdmin` 은 소속이 아니라 **권한**으로 들어온 SUPER_ADMIN 이다 (job-050).
 * 그쪽은 `currentRole` 이 끝까지 null 이라 역할 필터로 거르면 메뉴가 하나도 안 남는데,
 * 서버는 매장 컨트롤러를 전부 열어준다 — 접근은 되는데 화면만 없는 상태가 된다.
 */
export const visibleTenantMenu = (
  currentRole: MembershipRole | null,
  isPlatformAdmin: boolean,
): TenantMenuItem[] =>
  TENANT_MENU.filter(
    (item) =>
      isPlatformAdmin || (currentRole && item.roles.includes(currentRole)),
  );
