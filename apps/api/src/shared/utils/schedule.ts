import { prisma, requireTenantId } from "@pawlog/database";
import { SCHEDULE_SOURCE, SCHEDULE_TYPE } from "@pawlog/shared";

/**
 * "이 날 등원 예정인 아이" Prisma where 조각 (job-053).
 *
 * 스케줄이 두 방식이 되면서 이 판정을 하는 곳이 넷으로 늘었다 — 오늘의 출석부 자동 생성,
 * 피드 커버리지("오늘 사진 0장"), 태그 제안 후보, 내일 등원 알림. **각자 구현하면
 * 반드시 갈라진다**: 예컨대 출석부만 MONTHLY 를 읽고 알림 크론이 못 읽으면, 날짜 지정
 * 아이는 출석부에는 뜨는데 보호자에게 알림이 안 가고 아무도 그걸 눈치채지 못한다.
 *
 *   WEEKLY  요일 패턴이 진실 — 달이 바뀌어도 이어진다
 *   MONTHLY 저장된 날짜가 진실 — 그 달에 고른 날에만 온다
 *
 * job-060 부터 세 번째 갈래가 붙었다. **보호자가 직접 잡은 등원 예약**은 그 아이의
 * 스케줄 방식이 WEEKLY 든 MONTHLY 든 언제나 유효하다 — 정기 요일에 더해 하루 더 오는
 * 것이 곧 예약이기 때문이다.
 *
 * ⚠️ 그래서 `source` 로 갈래를 나눈다. "방식과 무관하게 `PetSchedule` 행이 있으면 온다"로
 * 뭉뚱그리면, MONTHLY → WEEKLY 로 방식을 바꾼 아이에게 남아 있던 **옛 행이 되살아난다**
 * (방식을 바꿀 때 그 행들을 지우지 않는다). 그 아이는 오지 않는데 출석부에는 뜬다.
 *
 * ⚠️ `date` 는 `@db.Date` 와 맞물리므로 **한국 달력 날짜의 UTC 자정**이어야 한다
 * (`startOfToday()` / `startOfKstDay()`). 그래서 요일도 `getUTCDay()` 로 읽는다 —
 * 로컬 게터는 프로세스 TZ 가 UTC 가 아니면 하루 어긋난다.
 */
export const scheduledOn = (date: Date) => ({
  OR: [
    {
      scheduleType: SCHEDULE_TYPE.WEEKLY,
      scheduleDays: { has: date.getUTCDay() },
    },
    {
      scheduleType: SCHEDULE_TYPE.MONTHLY,
      schedules: { some: { date } },
    },
    {
      schedules: { some: { date, source: SCHEDULE_SOURCE.GUARDIAN } },
    },
  ],
});

/**
 * 그 날짜의 출석 예정(SCHEDULED) 행을 보장한다 (job-053).
 *
 * 같은 5줄이 이미 두 곳에 복사돼 있었다 — 오늘의 출석부 자동 생성(`AttendanceService.findToday`)과
 * 피드 발행 시 태그된 아이의 출석 보장(`FeedPostService.ensureAttendance`). 스케줄 저장까지
 * 세 번째 사본을 만들 자리라, 갈라지기 전에 한 곳으로 모은다.
 *
 * ⚠️ **`skipDuplicates` 가 이 함수의 핵심이다.** `Attendance` 는 `@@unique([petId, date])`
 * 라, 이미 등원 체크한 아이에게 다시 불러도 기존 행을 덮지 않고 그냥 건너뛴다. 그래서
 * 조회/저장 경로 어디서 몇 번 불려도 안전하다.
 *
 * ⚠️ 상태는 언제나 SCHEDULED 다 — **정기권 차감은 하지 않는다.** 차감은 사람이 등원
 * 버튼을 누르는 시점의 조작이어야 하고, 목록을 여는 것만으로 돈이 움직이면 안 된다.
 */
export const ensureScheduledAttendance = async (
  petIds: string[],
  date: Date,
) => {
  if (petIds.length === 0) return;

  const tenantId = requireTenantId();
  await prisma.attendance.createMany({
    data: petIds.map((petId) => ({
      tenantId,
      petId,
      date,
      status: "SCHEDULED",
    })),
    skipDuplicates: true,
  });
};
