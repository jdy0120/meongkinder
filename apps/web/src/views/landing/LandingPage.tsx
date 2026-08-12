"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  BookHeart,
  Camera,
  ClipboardCheck,
  Instagram,
  LogIn,
  NotebookPen,
  PawPrint,
  Sparkles,
  Store,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import { Button, Card, CardContent } from "@pawlog/ui";

import { useMe } from "@/entities/user";

/**
 * 보호자가 앱에서 실제로 보는 것들. 첫 항목만 2×2 로 크게 잡는 bento 배치라
 * 순서를 바꾸면 레이아웃도 바뀐다.
 */
const PARENT_FEATURES = [
  {
    title: "오늘의 알림장",
    description:
      "식사 · 배변 · 낮잠 · 활동 · 특이사항을 항목별로. 선생님이 남긴 총평까지 그대로 전해집니다.",
    icon: BookHeart,
    // 4열 그리드에서 2×2 를 차지한다 (위 그리드 주석 참고).
    className: "sm:col-span-2 lg:row-span-2",
  },
  {
    title: "활동 사진첩",
    description: "신나게 뛰논 순간들을 리포트와 함께",
    icon: Camera,
    className: "",
  },
  {
    title: "등·하원 현황",
    description: "몇 시에 오고 갔는지 한눈에",
    icon: ClipboardCheck,
    className: "",
  },
  {
    title: "정기권 잔여",
    description: "남은 횟수와 사용 내역을 투명하게",
    icon: Ticket,
    className: "",
  },
  {
    title: "카카오 알림톡",
    description: "하원하면 리포트 링크가 바로 도착",
    icon: BellRing,
    className: "",
  },
] as const;

const STEPS = [
  {
    title: "카카오로 로그인",
    description:
      "따로 가입할 필요 없습니다. 카카오 계정으로 처음 로그인하면 계정이 바로 만들어집니다.",
    icon: LogIn,
  },
  {
    title: "매장에 연결",
    description:
      "아이를 맡길 유치원을 찾아 가입을 신청하세요. 유치원이 휴대폰 번호로 미리 초대해 뒀다면 로그인만 해도 연결됩니다.",
    icon: Store,
  },
  {
    title: "매일 리포트 확인",
    description:
      "하원 시각에 맞춰 알림톡이 오고, 사진과 알림장이 앱에 차곡차곡 쌓입니다.",
    icon: NotebookPen,
  },
] as const;

const STORE_FEATURES = [
  {
    title: "오늘의 출석부",
    description:
      "오늘 등원 예정인 아이 목록에서 등원·하원을 한 번에 체크하고, 결석·보강도 그 자리에서 처리합니다.",
    icon: ClipboardCheck,
  },
  {
    title: "리포트 작성 + AI 초안",
    description:
      "사진을 여러 장 올리고 함께 찍힌 아이들을 드래그로 한 번에 태그. 임시저장하면 총평 초안을 AI 가 먼저 써 둡니다.",
    icon: Sparkles,
  },
  {
    title: "원생 · 케어 노트",
    description:
      "알러지, 입질 주의, 분리불안, 접종 기록까지. 담당이 바뀌어도 아이에 대한 정보는 남습니다.",
    icon: PawPrint,
  },
  {
    title: "이용권 관리",
    description:
      "정기권·회수권 판매 현황과 잔여 횟수, 다음 결제 일정을 매장 단위로 확인합니다.",
    icon: Ticket,
  },
  {
    title: "구성원 관리",
    description:
      "보호자 가입 신청 승인, 스태프·관리자 권한 부여. 아직 앱을 쓰지 않는 보호자는 연락처로 미리 초대해 둘 수 있습니다.",
    icon: UserCog,
  },
  {
    title: "매장별 독립 공간",
    description:
      "매장마다 주소가 따로 있고 데이터도 완전히 분리됩니다. 한 사람이 여러 매장에 서로 다른 자격으로 속할 수 있습니다.",
    icon: Users,
  },
] as const;

const FAQS = [
  {
    question: "앱을 설치해야 하나요?",
    answer:
      "아니요. 웹 브라우저에서 바로 쓰는 서비스라 설치가 필요 없습니다. 휴대폰 홈 화면에 추가해 두면 앱처럼 쓸 수 있습니다.",
  },
  {
    question: "로그인은 어떻게 하나요?",
    answer:
      "카카오 계정 하나로만 로그인합니다. 별도의 회원가입 절차나 비밀번호가 없고, 처음 로그인하는 순간 계정이 만들어집니다.",
  },
  {
    question: "아이가 여러 마리여도 되나요?",
    answer:
      "네. 등록한 아이 모두의 리포트가 한 화면에 모이고, 아이별로 골라서 볼 수도 있습니다. 여러 아이가 함께 찍힌 사진은 각자의 리포트에 자동으로 들어갑니다.",
  },
  {
    question: "유치원에 가입 신청하면 바로 이용할 수 있나요?",
    answer:
      "유치원 관리자가 승인해야 연결됩니다. 승인 전에는 '승인 대기' 상태로 표시되니 내 매장 화면에서 진행 상황을 확인하세요.",
  },
  {
    question: "알림은 언제 오나요?",
    answer:
      "아이가 하원하면 오늘의 리포트 링크가 알림톡으로 갑니다. 그리고 매일 저녁, 다음 날 등원 예정이 있으면 미리 알려드립니다.",
  },
  {
    question: "우리 유치원에서도 쓸 수 있나요?",
    answer:
      "네. 매장 개설권을 구독하면 바로 매장을 열 수 있고, 개설한 계정이 그대로 그 매장의 관리자가 됩니다.",
  },
] as const;

export const LandingPage = () => {
  const router = useRouter();
  const { data: user } = useMe();
  const isLoggedIn = Boolean(user);

  return (
    <div className='flex min-h-screen flex-col bg-background font-sans text-foreground'>
      <header className='sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70'>
        <div className='mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 md:px-6'>
          <Link
            href='/'
            className='flex items-center gap-2 text-xl font-bold text-primary'
          >
            <PawPrint className='size-6' />
            Pawlog Kids
          </Link>

          <nav className='hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex'>
            <a href='#features' className='transition-colors hover:text-foreground'>
              기능
            </a>
            <a href='#how' className='transition-colors hover:text-foreground'>
              이용 방법
            </a>
            <a href='#for-stores' className='transition-colors hover:text-foreground'>
              유치원 운영
            </a>
            <a href='#faq' className='transition-colors hover:text-foreground'>
              자주 묻는 질문
            </a>
          </nav>

          {isLoggedIn ? (
            <Button
              className='rounded-full'
              onClick={() => router.push("/launch")}
            >
              콘솔로 이동
            </Button>
          ) : (
            <Button asChild variant='outline' className='rounded-full'>
              <Link href='/auth/login'>로그인</Link>
            </Button>
          )}
        </div>
      </header>

      <main className='flex-1'>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className='relative overflow-hidden'>
          {/* 크림 배경 위에 아주 옅은 캐러멜 광원 — 브랜드 톤만 얹고 대비는 건드리지 않는다. */}
          <div
            aria-hidden
            className='pointer-events-none absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl'
          />

          <div className='relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-20 text-center md:px-6 md:py-28'>
            <span className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-semibold text-primary'>
              <span className='relative flex size-2'>
                <span className='absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75' />
                <span className='relative inline-flex size-2 rounded-full bg-primary' />
              </span>
              펫 유치원을 위한 알림장 서비스
            </span>

            <h1 className='text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-6xl'>
              오늘 우리 아이,
              <br />
              <span className='text-primary'>어떤 하루</span>를 보냈을까요?
            </h1>

            <p className='max-w-xl text-lg leading-relaxed text-muted-foreground'>
              사진 한 장으로는 알 수 없던 것들. 무엇을 먹었고 얼마나 잤는지,
              오늘은 누구와 놀았는지까지 — 선생님이 남긴 하루를 그대로
              전해드립니다.
            </p>

            <div className='mt-2 flex flex-col gap-3 sm:flex-row'>
              <Button
                asChild
                size='lg'
                className='rounded-full shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg'
              >
                <Link href={isLoggedIn ? "/launch" : "/auth/login"}>
                  {isLoggedIn ? "내 아이 리포트 보기" : "카카오로 시작하기"}
                  <ArrowRight className='ml-1.5 size-4' />
                </Link>
              </Button>
              <Button
                asChild
                size='lg'
                variant='secondary'
                className='rounded-full transition-all hover:shadow-md'
              >
                <a href='#features'>기능 둘러보기</a>
              </Button>
            </div>

            <p className='text-sm text-muted-foreground'>
              설치 없이 웹에서 바로 · 카카오 계정이면 준비 끝
            </p>
          </div>
        </section>

        {/* ── 보호자 기능 ───────────────────────────────────────── */}
        <section
          id='features'
          className='mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-16 md:px-6 md:py-24'
        >
          <div className='mb-10 flex flex-col items-center gap-3 text-center'>
            <span className='text-sm font-bold tracking-wide text-primary uppercase'>
              For 보호자
            </span>
            <h2 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>
              하원 후에야 궁금해지는 것들
            </h2>
            <p className='max-w-lg text-muted-foreground'>
              물어보기 애매했던 하루의 조각들을, 굳이 묻지 않아도 매일
              받아보세요.
            </p>
          </div>

          {/*
            job-049: 셀 수가 맞지 않아 레이아웃이 깨져 있었다.
            `grid-cols-3 × grid-rows-2` = 6칸인데 큰 카드가 2×2(4칸)를 먹고 작은 카드가
            4개라 **8칸이 필요**했다. 모자란 2개가 암묵적 3행으로 밀려나는데, 높이는
            `h-[26rem]` 로 2행 기준 고정이라 밀려난 카드가 찌그러졌다.

            칸 수가 정확히 맞는 조합은 4열×2행(8칸 = 큰 카드 4 + 작은 카드 4)이다.
            고정 높이도 그 시점(lg)에만 건다 — 아래 단계는 행 수가 달라 고정하면 또 깨진다.
              · 모바일  1열, 높이 자유
              · sm      2열 (큰 카드가 한 줄 전체) → 3행, 높이 자유
              · lg      4열×2행 정확히 채움 + 26rem 고정
          */}
          <div className='grid gap-4 sm:grid-cols-2 lg:h-[26rem] lg:grid-cols-4 lg:grid-rows-2'>
            {PARENT_FEATURES.map(
              ({ title, description, icon: Icon, className }) => (
                <Card
                  key={title}
                  className={`group overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg ${className}`}
                >
                  <CardContent className='flex h-full flex-col p-6 text-left'>
                    <div className='w-fit rounded-2xl bg-primary/10 p-3 text-primary transition-colors duration-300 group-hover:bg-primary/15'>
                      <Icon className='size-6' />
                    </div>
                    <div className='mt-auto pt-4'>
                      <h3 className='mb-1 text-lg font-bold transition-colors group-hover:text-primary'>
                        {title}
                      </h3>
                      <p className='text-sm leading-relaxed text-muted-foreground'>
                        {description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
          </div>

          <Card className='mt-4 border-border/60 bg-primary/5'>
            <CardContent className='flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center'>
              <div className='rounded-2xl bg-primary/10 p-3 text-primary'>
                <Instagram className='size-6' />
              </div>
              <div className='min-w-0 flex-1'>
                <h3 className='text-lg font-bold'>자랑하고 싶은 날엔</h3>
                <p className='text-sm leading-relaxed text-muted-foreground'>
                  리포트를 스토리 카드 이미지로 저장해 SNS 에 그대로 올릴 수
                  있습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── 이용 방법 ─────────────────────────────────────────── */}
        <section
          id='how'
          className='scroll-mt-20 border-y border-border/60 bg-card/60'
        >
          <div className='mx-auto w-full max-w-5xl px-5 py-16 md:px-6 md:py-24'>
            <div className='mb-10 flex flex-col items-center gap-3 text-center'>
              <span className='text-sm font-bold tracking-wide text-primary uppercase'>
                How it works
              </span>
              <h2 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>
                시작하는 데 3분이면 충분합니다
              </h2>
            </div>

            <ol className='grid gap-4 md:grid-cols-3'>
              {STEPS.map(({ title, description, icon: Icon }, index) => (
                <li key={title}>
                  <Card className='h-full border-border/60'>
                    <CardContent className='flex h-full flex-col gap-3 p-6'>
                      <div className='flex items-center gap-3'>
                        <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground'>
                          {index + 1}
                        </span>
                        <Icon className='size-5 text-primary' />
                      </div>
                      <h3 className='text-lg font-bold'>{title}</h3>
                      <p className='text-sm leading-relaxed text-muted-foreground'>
                        {description}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 유치원 운영자 ─────────────────────────────────────── */}
        <section
          id='for-stores'
          className='mx-auto w-full max-w-5xl scroll-mt-20 px-5 py-16 md:px-6 md:py-24'
        >
          <div className='mb-10 flex flex-col items-center gap-3 text-center'>
            <span className='text-sm font-bold tracking-wide text-primary uppercase'>
              For 유치원
            </span>
            <h2 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>
              알림장 쓰느라 퇴근이 늦어지지 않도록
            </h2>
            <p className='max-w-lg text-muted-foreground'>
              출석 체크부터 리포트 발행, 이용권 관리까지 한 화면에서. 보호자
              앱과 같은 계정으로 쓰는 매장 운영 도구입니다.
            </p>
          </div>

          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {STORE_FEATURES.map(({ title, description, icon: Icon }) => (
              <Card
                key={title}
                className='h-full border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg'
              >
                <CardContent className='flex h-full flex-col gap-3 p-6'>
                  <div className='w-fit rounded-2xl bg-primary/10 p-2.5 text-primary'>
                    <Icon className='size-5' />
                  </div>
                  <h3 className='text-base font-bold'>{title}</h3>
                  <p className='text-sm leading-relaxed text-muted-foreground'>
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className='mt-6 flex justify-center'>
            <Button asChild size='lg' variant='outline' className='rounded-full'>
              <Link href='/onboarding'>
                <Store className='mr-1.5 size-4' />
                우리 유치원 열기
              </Link>
            </Button>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section
          id='faq'
          className='scroll-mt-20 border-y border-border/60 bg-card/60'
        >
          <div className='mx-auto w-full max-w-3xl px-5 py-16 md:px-6 md:py-24'>
            <h2 className='mb-10 text-center text-3xl font-extrabold tracking-tight sm:text-4xl'>
              자주 묻는 질문
            </h2>

            {/* @pawlog/ui 의 Accordion 은 이 테마에 accordion 키프레임이 없어 열림
                애니메이션이 깨진다. 네이티브 details 로 두면 JS 없이도 동작한다. */}
            <div className='flex flex-col gap-3'>
              {FAQS.map(({ question, answer }) => (
                <details
                  key={question}
                  className='group rounded-2xl border border-border/60 bg-card px-5 py-4 transition-colors open:border-primary/30 [&_summary::-webkit-details-marker]:hidden'
                >
                  <summary className='flex cursor-pointer list-none items-center justify-between gap-4 font-bold'>
                    {question}
                    <span
                      aria-hidden
                      className='shrink-0 text-xl leading-none text-primary transition-transform duration-200 group-open:rotate-45'
                    >
                      +
                    </span>
                  </summary>
                  <p className='mt-3 text-sm leading-relaxed text-muted-foreground'>
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 마지막 CTA ───────────────────────────────────────── */}
        <section className='mx-auto w-full max-w-5xl px-5 py-16 md:px-6 md:py-24'>
          <Card className='overflow-hidden border-border/60 bg-primary/5'>
            <CardContent className='flex flex-col items-center gap-4 px-6 py-14 text-center'>
              <PawPrint className='size-10 text-primary' />
              <h2 className='text-3xl font-extrabold tracking-tight text-balance sm:text-4xl'>
                오늘부터 아이의 하루를 받아보세요
              </h2>
              <p className='max-w-md text-muted-foreground'>
                카카오 계정으로 로그인하면 바로 시작할 수 있습니다.
              </p>
              <Button
                asChild
                size='lg'
                className='rounded-full shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg'
              >
                <Link href={isLoggedIn ? "/launch" : "/auth/login"}>
                  {isLoggedIn ? "콘솔로 이동" : "카카오로 시작하기"}
                  <ArrowRight className='ml-1.5 size-4' />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className='border-t border-border/60'>
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6'>
          <div className='flex items-center gap-2 font-bold text-foreground'>
            <PawPrint className='size-4 text-primary' />
            Pawlog Kids
          </div>
          <nav className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            <a href='#features' className='transition-colors hover:text-foreground'>
              기능
            </a>
            <a href='#for-stores' className='transition-colors hover:text-foreground'>
              유치원 운영
            </a>
            <a href='#faq' className='transition-colors hover:text-foreground'>
              자주 묻는 질문
            </a>
            <Link
              href='/auth/login'
              className='transition-colors hover:text-foreground'
            >
              로그인
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Pawlog Kids</p>
        </div>
      </footer>
    </div>
  );
};
