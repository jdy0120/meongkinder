import { ShieldAlert } from "lucide-react";

interface PlatformViewBannerProps {
  tenantName: string;
}

/**
 * 플랫폼 운영자 열람 배너 (job-050).
 *
 * SUPER_ADMIN 이 **소속되지 않은** 매장을 보고 있을 때 매장 영역 최상단에 깔린다.
 *
 * 왜 필요한가: 이 화면에는 보호자 전화번호와 아이 사진이 있다. 소속 원장이 보는 것과
 * 플랫폼 운영자가 보는 것은 성격이 전혀 다른 열람인데, 표시가 없으면 화면상 구별이
 * 사라져 운영자 본인도 "지금 남의 매장을 보고 있다"는 자각 없이 조작하게 된다.
 * 실수로 남의 매장 데이터를 고치는 사고는 대개 이 자각이 없을 때 난다.
 *
 * 이 배너는 안전장치가 아니라 **표시**다. 접근 자체는 API 가 이미 허용하고 있고
 * (TenantMiddleware 가 SUPER_ADMIN 의 멤버십 검사를 건너뛴다), 여기서 감춘다고
 * 막히지 않는다. 실제 통제가 필요하면 서버에 열람 감사 로그를 남겨야 한다.
 */
export const PlatformViewBanner = ({ tenantName }: PlatformViewBannerProps) => (
  <div
    role='status'
    // job-052: amber-* 하드코딩 → caution 토큰. 팔레트 밖 색은 테마를 따라오지 않고,
    // 무엇보다 '주의'라는 뜻이 이미 토큰에 있는데 새 색을 만들면 규칙이 갈라진다.
    //
    // job-053: `lg:ml-nav` — 이 배너는 매장 레이아웃이 `PageShell` **바깥**에 그리므로
    // 사이드바 오프셋을 스스로 져야 한다. 없으면 데스크톱에서 문장 앞부분이 고정
    // 사이드바 밑에 깔려 "…에 소속되어 있지 않으며"부터 보인다. 매장 영역 전용
    // 컴포넌트라 사이드바가 항상 함께 있다. padding 이 아니라 margin 인 이유는
    // `px-5` 를 그대로 둬야 본문(`PageShell` 도 `px-5`)과 글자 시작점이 맞기 때문이다.
    className='flex items-start gap-2 border-b border-caution bg-caution-tint px-5 py-3 text-caution-text lg:ml-nav'
  >
    <ShieldAlert className='mt-0.5 size-5 shrink-0' />
    <p className='break-keep text-label'>
      <span className='font-semibold'>플랫폼 관리자로 열람 중입니다.</span>{" "}
      <span className='font-medium'>{tenantName}</span> 에 소속되어 있지 않으며,
      운영 지원을 위해 매장 데이터를 보고 있습니다. 보호자 연락처와 아이 사진이
      포함되므로 필요한 범위에서만 확인하세요.
    </p>
  </div>
);
