import {
  AlertTriangle,
  Droplets,
  Leaf,
  Scissors,
  Shield,
  Sprout,
  Ticket,
} from "lucide-react";
import { Badge } from "@pawlog/ui";
import { BADGE_LEVEL, type BadgeLevel } from "@pawlog/shared";

import { vaccinationLabel, type PetSafety } from "../lib/safety";

/**
 * 원생 카드에 올라가는 안전 배지들 (design-system.md §3.1 · §6.1).
 *
 * ⚠️ 이 파일의 모든 배지는 `normal` / `caution` / `critical` **세 레벨만** 쓴다.
 * 견종별·성향별로 색을 다르게 주면 사용자는 색을 읽지 않고 글자만 읽게 되고,
 * 그러면 급할 때 스캔이 안 된다. 색은 **긴급도만** 인코딩한다.
 *
 * `entities` 에 두는 이유(FSD): 이 배지들은 원생 목록·등원 처리·알림장·대시보드
 * 네 곳에서 쓰인다. `features` 에 두면 feature 끼리 서로 import 하게 되어 순환이 생긴다.
 */

/** 레벨 그대로 받는 범용 배지. 도메인 배지들이 전부 이걸 통해 그려진다. */
export const LevelBadge = ({
  level,
  icon: Icon,
  children,
}: {
  level: BadgeLevel;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) => (
  <Badge variant={level}>
    {Icon && <Icon />}
    {children}
  </Badge>
);

/**
 * 예방접종.
 *
 * 기록이 아예 없으면 `caution` 이다 — "확인했고 문제없다"와 "아무도 확인한 적이 없다"가
 * 화면에서 같아 보이면 안 된다.
 */
export const VaccinationBadge = ({ safety }: { safety: PetSafety }) => {
  if (safety.expiredVaccinations.length > 0) {
    const [first, ...rest] = safety.expiredVaccinations;
    return (
      <LevelBadge level={BADGE_LEVEL.CRITICAL} icon={AlertTriangle}>
        {vaccinationLabel(first.type)} 만료
        {rest.length > 0 && ` 외 ${rest.length}`}
      </LevelBadge>
    );
  }

  if (safety.soonestExpiring) {
    return (
      <LevelBadge level={BADGE_LEVEL.CAUTION} icon={Shield}>
        {vaccinationLabel(safety.soonestExpiring.type)} D-
        {safety.soonestExpiring.daysLeft}
      </LevelBadge>
    );
  }

  if (safety.vaccinations.length === 0) {
    return (
      <LevelBadge level={BADGE_LEVEL.CAUTION} icon={Shield}>
        접종 미확인
      </LevelBadge>
    );
  }

  return (
    <LevelBadge level={BADGE_LEVEL.NORMAL} icon={Shield}>
      접종 정상
    </LevelBadge>
  );
};

/** 알러지. 급여 전에 봐야 하므로 항목을 그대로 적는다 — "알러지 있음"으로는 못 쓴다. */
export const AllergyBadge = ({ allergies }: { allergies: string[] }) => {
  if (allergies.length === 0) return null;

  return (
    <LevelBadge level={BADGE_LEVEL.CAUTION} icon={Leaf}>
      {allergies.join(" · ")}
    </LevelBadge>
  );
};

/**
 * 성향. 상황 서술이 그대로 배지가 된다("대형견 무서워함").
 * 공격 이력만 별도로 `critical` 이다 — 합사 전에 반드시 걸러야 하는 유일한 항목이다.
 */
export const TemperamentBadges = ({
  temperaments,
  hasBiteHistory,
}: {
  temperaments: string[];
  hasBiteHistory: boolean | null;
}) => (
  <>
    {hasBiteHistory && (
      <LevelBadge level={BADGE_LEVEL.CRITICAL} icon={AlertTriangle}>
        공격 이력
      </LevelBadge>
    )}
    {temperaments.map((temperament) => (
      <LevelBadge key={temperament} level={BADGE_LEVEL.CAUTION}>
        {temperament}
      </LevelBadge>
    ))}
  </>
);

/** 마킹·마운팅. 시설 운영(배치·청소)에 직접 영향을 준다. */
export const MarkingBadges = ({
  marksIndoors,
  mountingBehavior,
}: {
  marksIndoors: boolean | null;
  mountingBehavior: boolean | null;
}) => (
  <>
    {marksIndoors && (
      <LevelBadge level={BADGE_LEVEL.CAUTION} icon={Droplets}>
        마킹
      </LevelBadge>
    )}
    {mountingBehavior && (
      <LevelBadge level={BADGE_LEVEL.CAUTION} icon={Droplets}>
        마운팅
      </LevelBadge>
    )}
  </>
);

/** 중성화. `null`(미확인)을 완료와 구분한다. */
export const NeuteredBadge = ({
  isNeutered,
}: {
  isNeutered?: boolean | null;
}) => {
  if (isNeutered === null || isNeutered === undefined) {
    return (
      <LevelBadge level={BADGE_LEVEL.CAUTION} icon={Scissors}>
        중성화 미확인
      </LevelBadge>
    );
  }

  return isNeutered ? (
    <LevelBadge level={BADGE_LEVEL.NORMAL} icon={Scissors}>
      중성화 완료
    </LevelBadge>
  ) : (
    <LevelBadge level={BADGE_LEVEL.NORMAL} icon={Scissors}>
      중성화 안 함
    </LevelBadge>
  );
};

/** 적응 기간 N일차. 적응 중인 아이는 합사·낯선 사람 응대를 다르게 해야 한다. */
export const AdaptationBadge = ({ day }: { day: number | null }) => {
  if (day === null) return null;

  return (
    <LevelBadge level={BADGE_LEVEL.CAUTION} icon={Sprout}>
      적응 {day}일차
    </LevelBadge>
  );
};

/** 정기권 잔여. 0회면 `critical` — 하원 때 보호자를 만나는 그 자리에서 말해야 한다. */
export const PassBalanceBadge = ({
  remaining,
}: {
  remaining: number | null | undefined;
}) => {
  if (remaining === null || remaining === undefined) return null;

  return (
    <LevelBadge
      level={
        remaining <= 0
          ? BADGE_LEVEL.CRITICAL
          : remaining <= 2
            ? BADGE_LEVEL.CAUTION
            : BADGE_LEVEL.NORMAL
      }
      icon={Ticket}
    >
      잔여 {remaining}회
    </LevelBadge>
  );
};
