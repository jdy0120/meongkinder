"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Clock } from "lucide-react";
import type { PetWithOwner } from "@pawlog/shared";
import { BADGE_LEVEL } from "@pawlog/shared";

import { calculateAgeLabel, speciesLabelMap } from "../lib/options";
import {
  formatPickupMethod,
  formatPickupTime,
  resolvePetSafety,
  type PetSafety,
} from "../lib/safety";
import { PetAvatar } from "./PetAvatar";
import {
  AdaptationBadge,
  AllergyBadge,
  MarkingBadges,
  NeuteredBadge,
  PassBalanceBadge,
  TemperamentBadges,
  VaccinationBadge,
} from "./SafetyBadges";
// 출석 배지는 `entities/attendance` 가 갖는다 — 원생 목록·출석부·대시보드가 같은 배지를
// 써야 상태 이름과 색이 화면마다 갈리지 않는다.
import { TodayAttendanceBadge } from "@/entities/attendance";

/**
 * 원생 카드 (design-system.md §3.3 · §6.1).
 *
 * **컴파운드로 만드는 이유**: 같은 카드가 대시보드 축약형·목록 전체형·등원 처리 선택형으로
 * 쓰이는데 다른 건 표시 항목뿐이다. `variant` prop 으로 나누면 곧 6개가 되고, 그때부터
 * 각 variant 가 조금씩 다르게 낡는다. 슬롯을 골라 끼우면 조합이 늘어도 카드는 하나다.
 *
 *   <DogCard.Root pet={pet} action={<CheckInButton …/>} onOpen={…}>
 *     <DogCard.Head />
 *     <DogCard.Badges />
 *     <DogCard.Footer />
 *   </DogCard.Root>
 *
 * **카드에 담을 정보를 '조회용'과 '사고 예방용'으로 나누고, 사고 예방용만 표면에 올린다.**
 * 체중·생일·보호자 주소는 상세 시트로 내려도 되지만, 알러지·공격성·접종 만료는 한 뎁스만
 * 숨겨도 급할 때 놓치고, 이 부류는 놓치면 사후 확인이 무의미하다.
 */

interface DogCardContextValue {
  pet: PetWithOwner;
  safety: PetSafety;
}

const DogCardContext = createContext<DogCardContextValue | null>(null);

const useDogCard = () => {
  const context = useContext(DogCardContext);
  if (!context) {
    throw new Error("DogCard.* 는 <DogCard.Root> 안에서만 쓸 수 있습니다.");
  }
  return context;
};

interface RootProps {
  pet: PetWithOwner;
  /**
   * 카드 우측에 붙는 64px 탭 버튼 (등원/하원 처리).
   *
   * ⚠️ **스와이프 제스처로 대체하지 않는다**(§3.2 MUST NOT). 젖은 손가락은 드래그 궤적이
   * 튀어 인식률이 낮고, 실패하면 사용자는 자기가 뭘 잘못했는지 알 수 없다.
   */
  action?: ReactNode;
  /** 카드 본문을 누르면 상세 시트를 연다. 페이지 이동이 아니라 시트다(§3.2). */
  onOpen?: () => void;
  children: ReactNode;
}

const Root = ({ pet, action, onOpen, children }: RootProps) => {
  // 목록이 스크롤되는 동안 매 프레임 다시 계산하지 않도록 카드 단위로 묶는다.
  const safety = useMemo(() => resolvePetSafety(pet), [pet]);

  /**
   * 접종 만료·공격 이력은 **테두리 자체를 승격**시킨다.
   * 배지 하나로는 스크롤 중에 놓친다 — 배지는 카드를 멈춰서 봐야 읽히고,
   * 테두리는 지나가면서도 보인다.
   */
  const borderClass =
    safety.level === BADGE_LEVEL.CRITICAL
      ? "border-2 border-danger"
      : "border border-border";

  const body = (
    <div className='min-w-0 flex-1 space-y-3 p-4 text-left'>{children}</div>
  );

  return (
    <DogCardContext.Provider value={{ pet, safety }}>
      <div
        className={`flex items-stretch overflow-hidden rounded-card border border-border bg-surface ${borderClass}`}
      >
        {onOpen ? (
          <button
            type='button'
            onClick={onOpen}
            aria-label={`${pet.name} 상세 보기`}
            className='min-w-0 flex-1 transition-colors hover:bg-accent/40'
          >
            {body}
          </button>
        ) : (
          body
        )}

        {/*
         * 등원/하원 버튼 자리. **64×64 버튼**이지 카드 높이를 채우는 색 띠가 아니다.
         * 예전에는 `w-touch` 칸에 `h-full` 버튼을 넣어 카드 오른쪽 전체(160px+)가
         * 통째로 칠해졌는데, 그 크기의 면은 버튼이 아니라 카드의 일부로 읽혀
         * "왜 여기 초록 띠가 있지"가 된다. 세로 가운데 정렬로 목록을 훑을 때
         * 카드 높이가 달라도 누르는 지점의 높이가 일정하다.
         */}
        {action && (
          <div className='flex shrink-0 items-center py-5 pr-4 pl-1'>
            {action}
          </div>
        )}
      </div>
    </DogCardContext.Provider>
  );
};

/**
 * 아바타 + 이름 + (상태 배지 · 견종/나이/체중).
 *
 * **이름은 자르지 않는다.** 예전에는 이름과 출석 배지가 같은 줄에서 폭을 나눠 가졌는데,
 * 가장 넓은 배지("등원 예정")가 붙는 순간 이름 칸이 3글자 남짓으로 줄어 실제로 잘렸다
 * — 카드가 md 에서 2열이고 오른쪽 64px 이 버튼 몫이라 원래 좁다. 배지를 둘째 줄로
 * 내려 이름이 줄 전체를 쓰고, 대신 **견종/나이/체중이 잘린다.** 그쪽은 조회용이라
 * 상세 시트에서 다시 볼 수 있지만, 이름이 잘린 카드는 목록에서 아이를 못 찾게 만든다.
 */
const Head = () => {
  const { pet } = useDogCard();
  const attendance = pet.attendances[0];

  const meta = [
    pet.breed || speciesLabelMap[pet.species] || pet.species,
    calculateAgeLabel(pet.birthDate),
    pet.weightKg ? `${pet.weightKg}kg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className='flex items-center gap-3'>
      <PetAvatar
        name={pet.name}
        fileId={pet.profileImageFileId}
        className='size-avatar-lg shrink-0'
      />

      <div className='min-w-0 flex-1'>
        <p className='truncate text-name'>{pet.name}</p>
        <div className='flex min-w-0 items-center gap-2'>
          {/* 배지가 없는 날(오늘 스케줄이 아닌 아이)에 빈 요소를 남기면 gap 만큼
              메타가 들여쓰기돼 카드마다 시작점이 어긋난다. 조건부로 통째로 뺀다. */}
          {attendance && (
            <span className='shrink-0'>
              <TodayAttendanceBadge attendance={attendance} />
            </span>
          )}
          <p className='truncate text-body text-muted-foreground'>{meta}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * 성향 / 알러지 / 접종 / 중성화 / 정기권.
 *
 * 최대 4개만 노출하고 나머지는 `+N` 으로 접는다 — 배지가 두 줄을 넘어가면 카드 높이가
 * 아이마다 달라져 목록을 훑는 눈이 멈춘다. **접힐 때도 순서는 긴급도 순**이라
 * critical 이 잘려 나가는 일은 없다.
 */
const VISIBLE_BADGE_LIMIT = 4;

const Badges = () => {
  const { pet, safety } = useDogCard();

  // 조건에 걸려 실제로 그려지는 것만 담긴다 — 컴포넌트 배열을 그대로 세면 `null` 을
  // 돌려주는 배지까지 포함돼 "+3" 이라 써 놓고 펼치면 아무것도 없는 상태가 된다.
  const items = countableBadges(pet, safety);
  if (items.length === 0) return null;

  const visible = items.slice(0, VISIBLE_BADGE_LIMIT);
  const hiddenCount = items.length - visible.length;

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {visible.map((item) => (
        <span key={item.key}>{item.node}</span>
      ))}
      {hiddenCount > 0 && (
        <span className='text-label text-muted-foreground'>+{hiddenCount}</span>
      )}
    </div>
  );
};

/** 픽업 시각 + 픽업 수단. 목록의 기본 정렬 키라 카드마다 같은 자리에 있어야 스캔이 된다. */
const Footer = () => {
  const { pet } = useDogCard();

  const method = formatPickupMethod(pet.pickupMethod, pet.shuttleNumber);

  return (
    <div className='flex items-center justify-between gap-3 border-t border-border pt-3'>
      <span className='flex items-center gap-2 text-body'>
        <Clock className='size-4 text-muted-foreground' />
        픽업 {formatPickupTime(pet.pickupTime)}
      </span>
      {method && (
        <span className='text-label text-muted-foreground'>{method}</span>
      )}
    </div>
  );
};

export const DogCard = { Root, Head, Badges, Footer };

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 실제로 그려질 배지만 골라 **긴급도 순**으로 돌려준다.
 *
 * 배지 컴포넌트들이 조건에 따라 `null` 을 돌려주므로, 컴포넌트 배열을 그대로 세면
 * "+3" 이라고 써 놓고 펼치면 아무것도 없는 상태가 된다.
 */
const countableBadges = (
  pet: PetWithOwner,
  safety: PetSafety,
): { key: string; node: ReactNode }[] => {
  const items: { key: string; node: ReactNode }[] = [];

  if (pet.hasBiteHistory) {
    items.push({
      key: "bite",
      node: <TemperamentBadges temperaments={[]} hasBiteHistory />,
    });
  }

  items.push({ key: "vaccination", node: <VaccinationBadge safety={safety} /> });

  if (pet.allergies.length > 0) {
    items.push({
      key: "allergy",
      node: <AllergyBadge allergies={pet.allergies} />,
    });
  }

  if (pet.passRemaining !== null) {
    items.push({
      key: "pass",
      node: <PassBalanceBadge remaining={pet.passRemaining} />,
    });
  }

  if (safety.adaptationDay !== null) {
    items.push({
      key: "adaptation",
      node: <AdaptationBadge day={safety.adaptationDay} />,
    });
  }

  for (const temperament of pet.temperaments) {
    items.push({
      key: `temperament:${temperament}`,
      node: (
        <TemperamentBadges
          temperaments={[temperament]}
          hasBiteHistory={false}
        />
      ),
    });
  }

  if (pet.marksIndoors) {
    items.push({
      key: "marking",
      node: <MarkingBadges marksIndoors mountingBehavior={false} />,
    });
  }

  if (pet.mountingBehavior) {
    items.push({
      key: "mounting",
      node: <MarkingBadges marksIndoors={false} mountingBehavior />,
    });
  }

  items.push({
    key: "neutered",
    node: <NeuteredBadge isNeutered={pet.isNeutered} />,
  });

  return items;
};
