"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { Button, Card, CardContent, Spinner } from "@pawlog/ui";
import { formatPhone } from "@pawlog/shared";

import { PageShell } from "@/shared/ui";
import {
  ConditionSummary,
  getPhotoContents,
  ReportPhotoTile,
  useSharedDailyReport,
} from "@/entities/daily-report";
import { PetAvatar } from "@/entities/pet";

/**
 * 공개 알림장 화면 (view) — 알림톡 링크로 열리는, **로그인이 필요 없는** 페이지 (job-040).
 *
 * 이 서비스의 알림톡은 계정이 아니라 전화번호로 나간다. 아직 가입하지 않은 보호자도 받고,
 * 받은 사람은 링크를 눌러 그날의 알림장을 본다. 여기서 로그인을 요구하면 "설치도 가입도
 * 요구하지 않는다"는 전제가 마지막 한 칸에서 무너지므로, 이 페이지는 (checkauth) 바깥에
 * 있고 인증 상태를 보지 않는다.
 *
 * 대신 하단에 가입 유도를 둔다 — 가입하면 지난 알림장까지 모아 볼 수 있다는 것이
 * 이 링크가 만드는 가장 자연스러운 전환 지점이다.
 */
export const SharedReportPage = ({ token }: { token: string }) => {
  const { data, isLoading } = useSharedDailyReport(token);
  const report = data?.dailyReport ?? null;

  return (
    <PageShell title='알림장' width='md'>
      {isLoading ? (
        <div className='flex justify-center py-16'>
          <Spinner className='size-6' />
        </div>
      ) : !report ? (
        <div className='flex flex-col items-center gap-3 py-16 text-center'>
          <p className='text-sm text-muted-foreground'>
            링크가 만료되었거나 올바르지 않아요.
          </p>
          <p className='text-xs text-muted-foreground'>
            알림장 링크는 발송 후 2주 동안 열 수 있어요. 다니는 유치원에
            문의해주세요.
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-6'>
          <div className='flex items-center gap-3'>
            <PetAvatar name={report.pet.name} className='size-12' />
            <div>
              <p className='font-semibold'>{report.pet.name}</p>
              <p className='text-sm text-muted-foreground'>
                {new Date(report.date).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
                {" · "}
                {report.tenant.name}
              </p>
            </div>
          </div>

          {getPhotoContents(report.contents).length > 0 && (
            <div className='grid grid-cols-3 gap-2'>
              {getPhotoContents(report.contents).map((photo) => (
                <ReportPhotoTile
                  key={photo.id}
                  fileId={photo.fileId as string}
                  className='aspect-square'
                />
              ))}
            </div>
          )}

          <section className='space-y-2'>
            <h2 className='text-sm font-semibold text-muted-foreground'>
              오늘의 컨디션
            </h2>
            <ConditionSummary contents={report.contents} />
          </section>

          {report.summary && (
            <Card>
              <CardContent className='pt-4'>
                <p className='text-xs font-medium text-muted-foreground'>
                  선생님 코멘트
                </p>
                <p className='mt-1 whitespace-pre-wrap text-sm'>
                  {report.summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* job-047: 같은 아이의 지난 알림장. 링크 하나가 "우리 아이 기록"이 되는 지점이다 —
              예전엔 그날 한 장뿐이라 매일 새 링크를 받는 일회성 알림에 가까웠다. */}
          {(data?.history ?? []).length > 0 && (
            <section className='space-y-2'>
              <h2 className='text-sm font-semibold text-muted-foreground'>
                지난 알림장
              </h2>
              <div className='flex flex-col gap-1.5'>
                {data?.history.map((item) => (
                  <div
                    key={item.id}
                    className='rounded-xl border px-3 py-2 text-sm'
                  >
                    <span className='font-medium'>
                      {new Date(item.date).toLocaleDateString("ko-KR", {
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    {item.summary && (
                      <span className='ml-2 text-muted-foreground'>
                        {item.summary}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 미가입 보호자에게는 이 화면이 전부다 — 물어볼 곳이 없으면 여기서 끊긴다. */}
          {data?.tenant.contactPhone && (
            <Card>
              <CardContent className='flex items-center justify-between py-3 text-sm'>
                <span className='text-muted-foreground'>
                  {data.tenant.name}에 문의
                </span>
                <a
                  href={`tel:${data.tenant.contactPhone}`}
                  className='flex items-center gap-1.5 font-medium text-primary'
                >
                  <Phone className='size-4' />
                  {formatPhone(data.tenant.contactPhone)}
                </a>
              </CardContent>
            </Card>
          )}

          <Card className='bg-muted/40'>
            <CardContent className='flex flex-col items-center gap-3 pt-4 text-center'>
              <p className='text-sm'>
                가입하시면 지난 알림장과 사진을 모아서 볼 수 있어요.
              </p>
              <Button
                asChild
               
                onClick={() => {
                  // job-047: 초대 토큰을 들고 로그인으로 간다. 가입 직후 게이트가 이걸 써서
                  // **전화번호를 다시 묻지 않고** 아이를 연결한다 — 예전엔 여기서 정보를
                  // 버리고 사용자에게 번호를 되물어, 안 넣으면 연결이 끊겼다.
                  if (data?.inviteToken) {
                    sessionStorage.setItem("pawlog:invite", data.inviteToken);
                  }
                }}
              >
                <Link href='/auth/login'>카카오로 시작하기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
};
