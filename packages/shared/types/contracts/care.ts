import type { Attendance, DailyReport, ReportContent } from "@pawlog/database";

export interface CreateAttendanceRequest {
  petId: string;
  date: string; // ISO 8601
  status?: string;
}

export type UpdateAttendanceRequest = Partial<
  Omit<CreateAttendanceRequest, "petId">
> & {
  checkInAt?: string; // ISO 8601
  checkOutAt?: string; // ISO 8601
};

export interface AttendanceResponse {
  attendance: Attendance;
}

// 오늘의 출석부 조회용 확장 타입 — 목록에서 펫 이름/프로필 사진을 함께 보여주기 위함
export interface AttendanceWithPet extends Attendance {
  pet: {
    id: string;
    name: string;
    profileImageFileId: string | null;
  };
}

export interface CheckInAttendanceRequest {
  checkInAt?: string; // ISO 8601, 미지정 시 현재 시각
  deductSubscription?: boolean; // 정기권/회수권 차감 여부 (기본 true)
}

export interface CheckOutAttendanceRequest {
  checkOutAt?: string; // ISO 8601, 미지정 시 현재 시각
  deductSubscription?: boolean; // 정기권/회수권 차감 여부 (기본 false)
}

export interface UpdateAttendanceStatusRequest {
  status: string; // ABSENT(결석) | MAKEUP(보강) | CANCELED(취소)
  deductSubscription?: boolean; // 정기권/회수권 차감 여부
  reason?: string; // 결석/보강 사유
}

export interface CreateReportContentRequest {
  type: string; // MEAL(식사) | TOILET(배변) | NAP(낮잠) | ACTIVITY(활동) | HEALTH(건강) | NOTE(특이사항) | PHOTO(사진)
  title?: string;
  content?: string;
  fileId?: string; // v1/file 업로드 응답의 File.id (사진 등 첨부, 여러 장은 PHOTO 타입 항목을 여러 개 전달)
  order?: number;
}

export interface CreateDailyReportRequest {
  petId: string; // 아이(펫) 태그
  attendanceId?: string;
  date: string; // ISO 8601
  summary?: string;
  status?: string;
  contents?: CreateReportContentRequest[]; // 식사/배변/낮잠/활동/특이사항/사진 항목 일괄 입력
}

export type UpdateDailyReportRequest = Partial<
  Omit<CreateDailyReportRequest, "petId">
>;

export interface DailyReportResponse {
  dailyReport: DailyReport;
}

// 보호자용 리포트 조회(아카이브/상세)용 확장 타입 — 항목(contents)과 펫 이름/프로필 사진을 함께 내려주기 위함
export interface DailyReportWithPetAndContents extends DailyReport {
  contents: ReportContent[];
  pet: {
    id: string;
    name: string;
    profileImageFileId: string | null;
  };
}

/**
 * 공개(로그인 불필요) 알림장 — 알림톡 링크로 열리는 화면의 응답 (job-040).
 *
 * 아직 가입하지 않은 보호자도 받는 알림이라 계정 없이 열려야 한다. 링크를 아는 사람은
 * 누구나 볼 수 있으므로 **담는 것을 최소로 줄인다** — 보호자 연락처, 소유 계정, 다른 아이,
 * 다른 날짜는 없다. `DailyReport` 전체를 그대로 쓰지 않고 별도 타입을 두는 이유가 이것이다.
 */
export interface SharedDailyReport {
  id: string;
  date: string;
  summary: string | null;
  createdAt: string;
  contents: {
    id: string;
    type: string;
    title: string | null;
    content: string | null;
    fileId: string | null;
    order: number;
  }[];
  pet: { name: string; profileImageFileId: string | null };
  tenant: { name: string };
}

/** 같은 아이의 지난 알림장 (목록 표시용 요약) */
export interface SharedReportHistoryItem {
  id: string;
  date: string;
  summary: string | null;
}

export interface SharedDailyReportResponse {
  dailyReport: SharedDailyReport;
  /** 같은 아이의 다른 발행 알림장 — 링크 하나가 "우리 아이 기록"이 되게 한다 (job-047) */
  history: SharedReportHistoryItem[];
  /** 매장 이름과 연락처. 미가입 보호자가 문의할 유일한 경로다. */
  tenant: { name: string; contactPhone?: string | null };
  /** 아직 계정이 연결되지 않은 아이라면 초대 토큰 — 가입 시 번호 재입력이 필요 없다. */
  inviteToken: string | null;
}

export type UpdateReportContentRequest = Partial<CreateReportContentRequest>;

export interface ReportContentResponse {
  reportContent: ReportContent;
}
