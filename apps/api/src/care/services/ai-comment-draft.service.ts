import { Injectable } from "@nestjs/common";

interface DraftContentInput {
  type: string;
  title?: string | null;
  content?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  MEAL: "식사",
  TOILET: "배변",
  NAP: "낮잠",
  ACTIVITY: "활동",
  HEALTH: "건강",
  NOTE: "특이사항",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

@Injectable()
export class AiCommentDraftService {
  /**
   * 입력된 리포트 항목을 바탕으로 AI 코멘트 초안을 생성한다.
   * 지금은 규칙 기반 더미 로직이며, 추후 실제 LLM 호출로 교체될 자리를 표시해 둔다.
   */
  generateDraft(contents: DraftContentInput[], summary?: string): string {
    const sentences: string[] = [];

    for (const category of CATEGORY_ORDER) {
      const items = contents.filter((item) => item.type === category);
      if (items.length === 0) continue;

      const label = CATEGORY_LABELS[category];
      const detail = items
        .map((item) => item.content ?? item.title)
        .filter((value): value is string => Boolean(value))
        .join(", ");

      sentences.push(
        detail ? `${label}: ${detail}` : `${label} 기록이 있어요.`,
      );
    }

    const photoCount = contents.filter((item) => item.type === "PHOTO").length;
    if (photoCount > 0) {
      sentences.push(`사진 ${photoCount}장이 첨부되었어요.`);
    }

    if (sentences.length === 0) {
      return summary?.trim() || "오늘의 활동 기록이 아직 없어요.";
    }

    return sentences.join(" ");
  }
}
