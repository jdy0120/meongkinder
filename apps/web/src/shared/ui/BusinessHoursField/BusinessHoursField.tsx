"use client";

import { Button, Card, CardContent, Input, Switch } from "@pawlog/ui";
import {
  BUSINESS_WEEKDAY_LABELS,
  WEEK_DISPLAY_ORDER,
  createDefaultBusinessHours,
  summarizeBusinessHours,
  validateBusinessHours,
  type BusinessDay,
  type BusinessHours,
} from "@pawlog/shared";

// 같은 레이어(shared/ui) 안이므로 배럴(`@/shared/ui`)이 아니라 파일을 직접 가리킨다 —
// 배럴을 거치면 자기 자신을 포함한 순환 참조가 된다.
import { SectionHeading } from "../SectionHeading/SectionHeading";
import { TimeSelect } from "./TimeSelect";

type Props = {
  value: BusinessHours | null;
  onChange: (value: BusinessHours | null) => void;
};

/** 요일당 휴게시간 상한. 서버 DTO 의 `@ArrayMaxSize(3)` 과 같은 값이어야 한다. */
const MAX_BREAKS = 3;

/**
 * 매장 운영시간 편집기 (job-060) — 네이버 스마트플레이스의 영업시간 입력을 따른다.
 *
 * ## 미설정과 전휴무를 구분한다
 *
 * `null`(미등록)일 때 요일 7개를 휴무로 그려 놓고 시작하면, 원장이 아무것도 안 해도
 * 보호자 화면에는 "매일 휴무"로 나간다. 그래서 처음에는 **입력란을 아예 띄우지 않고**
 * 버튼 하나만 보여준다 — 그 버튼을 누르는 것이 곧 "운영시간을 등록하겠다"는 의사표시다.
 *
 * ## 요일을 한 줄씩 그린다
 *
 * 네이버는 요일 칩을 먼저 고르고 시간을 넣는 방식인데, 여기서는 요일마다 한 줄을 둔다.
 * 이 화면을 쓰는 사람은 대개 이미 정해진 시간표를 **옮겨 적으러** 오지 처음 설계하러
 * 오지 않는다. 그때는 "지금 무엇이 저장돼 있나"가 한눈에 보이는 편이 낫다. 대신 반복
 * 입력의 수고는 `이 시간을 영업일 전체에 적용` 이 덜어 준다.
 */
export const BusinessHoursField = ({ value, onChange }: Props) => {
  if (!value) {
    return (
      <Card>
        <CardContent className='flex flex-col gap-4 pt-6'>
          <SectionHeading>운영시간</SectionHeading>
          <p className='text-label text-muted-foreground'>
            아직 등록하지 않았습니다. 등록하면 보호자가 매장 찾기에서 영업 여부를
            확인하고, 등원 예약 달력에서 운영일만 고를 수 있습니다.
          </p>
          <Button
            type='button'
            variant='outline'
            onClick={() => onChange(createDefaultBusinessHours())}
          >
            운영시간 설정하기
          </Button>
        </CardContent>
      </Card>
    );
  }

  const patchDay = (day: number, patch: Partial<BusinessDay>) =>
    onChange({
      ...value,
      days: value.days.map((item) =>
        item.day === day ? { ...item, ...patch } : item,
      ),
    });

  /**
   * 한 요일의 시간을 나머지 **영업일 전체**에 복사한다.
   *
   * 휴무일은 건드리지 않는다 — 주말 휴무를 지정해 둔 원장이 평일 시간을 맞추려다 주말이
   * 영업으로 되살아나면, 그건 보호자에게 "토요일에 문 연다"고 말하는 것이 된다.
   */
  const applyToAll = (source: BusinessDay) =>
    onChange({
      ...value,
      days: value.days.map((item) =>
        item.closed
          ? item
          : {
              ...item,
              open: source.open,
              close: source.close,
              breaks: source.breaks.map((entry) => ({ ...entry })),
            },
      ),
    });

  const errors = validateBusinessHours(value);
  const summary = summarizeBusinessHours(value);

  return (
    <Card>
      <CardContent className='flex flex-col gap-6 pt-6'>
        <div className='flex flex-col gap-1'>
          <SectionHeading
            action={
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => onChange(null)}
              >
                등록 해제
              </Button>
            }
          >
            운영시간
          </SectionHeading>
          <p className='text-label text-muted-foreground'>
            보호자의 매장 찾기와 등원 예약 달력에 그대로 쓰입니다.
          </p>
        </div>

        <div className='flex flex-col gap-3'>
          {WEEK_DISPLAY_ORDER.map((index) => {
            const day = value.days.find((item) => item.day === index);
            if (!day) return null;

            return (
              <div
                key={index}
                className='flex flex-col gap-3 rounded-btn border p-4'
              >
                <div className='flex items-center justify-between gap-3'>
                  <span className='font-semibold'>
                    {BUSINESS_WEEKDAY_LABELS[index]}요일
                  </span>
                  <div className='flex items-center gap-2'>
                    <span className='text-label text-muted-foreground'>
                      {day.closed ? "휴무" : "영업"}
                    </span>
                    <Switch
                      aria-label={`${BUSINESS_WEEKDAY_LABELS[index]}요일 영업 여부`}
                      checked={!day.closed}
                      onCheckedChange={(checked) =>
                        patchDay(index, {
                          closed: !checked,
                          // 휴무로 바꾸면 휴게시간은 의미가 없다. 남겨 두면 다시 영업으로
                          // 켰을 때 지운 줄 알았던 값이 되살아난다.
                          ...(checked ? {} : { breaks: [] }),
                        })
                      }
                    />
                  </div>
                </div>

                {!day.closed && (
                  <div className='flex flex-col gap-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <TimeSelect
                        aria-label={`${BUSINESS_WEEKDAY_LABELS[index]}요일 개점`}
                        value={day.open}
                        onChange={(open) => patchDay(index, { open })}
                      />
                      <span className='text-muted-foreground'>~</span>
                      <TimeSelect
                        aria-label={`${BUSINESS_WEEKDAY_LABELS[index]}요일 마감`}
                        value={day.close}
                        allowMidnight
                        onChange={(close) => patchDay(index, { close })}
                      />
                    </div>

                    {day.breaks.map((entry, position) => (
                      <div
                        key={position}
                        className='flex flex-wrap items-center gap-2'
                      >
                        <span className='text-label text-muted-foreground'>
                          휴게
                        </span>
                        <TimeSelect
                          aria-label='휴게 시작'
                          value={entry.start}
                          onChange={(start) =>
                            patchDay(index, {
                              breaks: day.breaks.map((item, i) =>
                                i === position ? { ...item, start } : item,
                              ),
                            })
                          }
                        />
                        <span className='text-muted-foreground'>~</span>
                        <TimeSelect
                          aria-label='휴게 종료'
                          value={entry.end}
                          allowMidnight
                          onChange={(end) =>
                            patchDay(index, {
                              breaks: day.breaks.map((item, i) =>
                                i === position ? { ...item, end } : item,
                              ),
                            })
                          }
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() =>
                            patchDay(index, {
                              breaks: day.breaks.filter(
                                (_, i) => i !== position,
                              ),
                            })
                          }
                        >
                          삭제
                        </Button>
                      </div>
                    ))}

                    <div className='flex flex-wrap gap-2'>
                      {day.breaks.length < MAX_BREAKS && (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            patchDay(index, {
                              breaks: [
                                ...day.breaks,
                                { start: "13:00", end: "14:00" },
                              ],
                            })
                          }
                        >
                          휴게시간 추가
                        </Button>
                      )}
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => applyToAll(day)}
                      >
                        이 시간을 영업일 전체에 적용
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className='flex items-center justify-between gap-4 rounded-btn border p-4'>
          <div className='flex flex-col gap-1'>
            <span className='font-semibold'>공휴일 휴무</span>
            <span className='text-label text-muted-foreground'>
              보호자에게 안내로만 표시됩니다. 예약 달력에서 개별 공휴일이 자동으로
              막히지는 않습니다.
            </span>
          </div>
          <Switch
            aria-label='공휴일 휴무'
            checked={value.closedOnPublicHolidays}
            onCheckedChange={(checked) =>
              onChange({ ...value, closedOnPublicHolidays: checked })
            }
          />
        </div>

        <div className='flex flex-col gap-2'>
          <span className='font-semibold'>안내 문구</span>
          <Input
            value={value.note ?? ""}
            maxLength={200}
            placeholder='예: 마지막 등원 17:00까지'
            onChange={(event) =>
              onChange({ ...value, note: event.target.value })
            }
          />
          <span className='text-label text-muted-foreground'>
            시간표로 표현되지 않는 내용을 적습니다.
          </span>
        </div>

        {/* 저장 전에 미리 보여준다. 요약은 보호자가 실제로 보게 될 문장과 같은 함수로
            만들어지므로, 여기서 어색하면 보호자 화면에서도 어색하다. */}
        {errors.length > 0 ? (
          <div className='flex flex-col gap-1 rounded-btn border-2 border-danger p-4'>
            {errors.map((error) => (
              <span key={error} className='text-label text-danger'>
                {error}
              </span>
            ))}
          </div>
        ) : (
          <div className='flex flex-col gap-1 rounded-btn bg-muted p-4'>
            <span className='text-label text-muted-foreground'>
              보호자에게 이렇게 보입니다
            </span>
            {summary.map((group) => (
              <span key={group.label}>
                <span className='font-semibold'>{group.label}</span>{" "}
                <span
                  className={
                    group.closed ? "text-muted-foreground" : undefined
                  }
                >
                  {group.hours}
                </span>
              </span>
            ))}
            {value.closedOnPublicHolidays && (
              <span className='text-label text-muted-foreground'>
                공휴일 휴무
              </span>
            )}
            {value.note && <span className='text-label'>{value.note}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
