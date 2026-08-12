import { Injectable } from "@nestjs/common";
import { ClaudeClientService } from "../../shared/llm/services/claude-client.service";

interface CaptionInput {
  petNames: string[];
  mediaCount: number;
  at?: Date;
}

interface DigestInput {
  petName: string;
  captions: string[];
  photoCount: number;
  friendNames: string[];
}

/** 시간대 라벨 — 오전/점심/오후/저녁에 유치원에서 실제로 일어나는 일이 다르다. */
const timeSlot = (date: Date) => {
  const hour = date.getHours();
  if (hour < 11) return "오전";
  if (hour < 14) return "점심";
  if (hour < 17) return "오후";
  return "저녁";
};

const SLOT_PHRASES: Record<string, string> = {
  오전: "오전 활동 시간이에요",
  점심: "점심시간 풍경이에요",
  오후: "오후에 신나게 놀았어요",
  저녁: "하원 전 마지막 시간이에요",
};

const joinNames = (names: string[]) => {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}와 ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, ${names[names.length - 1]}`;
};

/**
 * 하루 요약을 쓸 때의 역할·문체·금지사항.
 *
 * 두 가지가 특히 중요하다.
 *   1) **주어진 사실만 쓴다.** 모델이 받는 재료는 선생님이 남긴 캡션과 이름·장수뿐이다.
 *      "밥을 잘 먹었어요" 같은 그럴듯한 문장을 지어내면 보호자가 사실로 읽고, 그 순간
 *      제품이 거짓말을 한 것이 된다.
 *   2) **친구 이야기를 빼먹지 않는다.** 보호자가 유치원에 보내는 이유가 사회화라, 누구와
 *      어울렸는지가 돈 내고 확인하고 싶은 바로 그 정보다 (기획 §5).
 */
const DIGEST_SYSTEM_PROMPT = `당신은 애견유치원 선생님을 대신해 보호자에게 보낼 알림장을 쓰는 사람입니다.

지켜야 할 것:
- 주어진 정보에만 근거해 쓰세요. 식사·배변·건강·기분처럼 주어지지 않은 내용은 절대 지어내지 마세요.
- 함께 찍힌 친구가 있으면 반드시 언급하세요. 보호자가 가장 궁금해하는 정보입니다.
- 2~3문장, 한 문단. 목록·머리말·따옴표 없이 본문만 쓰세요.
- 아이를 이름으로 부르고, 다정하되 과장하지 마세요. 이모지는 쓰지 마세요.
- "~했어요", "~였어요" 처럼 부드러운 종결어미를 쓰세요.
- 사진이 한 장도 없으면 억지로 꾸미지 말고 기록이 적었다는 사실을 담백하게 적으세요.`;

/**
 * 캡션·하루 요약 초안 생성.
 *
 * **하루 요약(generateDigest)은 실제 Claude 호출**이고, 실패하거나 API 키가 없으면 규칙 기반
 * 문장으로 폴백한다 — 모델이 답을 못 주는 건 정상적으로 일어나는 일이지 하루 마감을 막을
 * 사건이 아니다.
 *
 * ⚠️ 캡션(generateCaption)은 아직 규칙 기반이다. 업로드 화면에서 선생님이 기다리는 실시간
 * 경로라 지연·원가 성격이 다르고, 사진을 모델에 보내야 해서 초상권 판단도 따로 필요하다.
 * 요약 품질을 먼저 확인한 뒤 붙이는 것이 순서다 (아래 `// TODO(llm)`).
 */
@Injectable()
export class FeedCaptionDraftService {
  constructor(private readonly claude: ClaudeClientService) {}

  /** 업로드 화면에서 제안할 캡션 한 줄 */
  generateCaption(input: CaptionInput): string {
    // TODO(llm): 사진 + 태그된 아이 이름을 넘겨 실제 캡션을 생성한다.
    const at = input.at ?? new Date();
    const slot = timeSlot(at);
    const names = joinNames(input.petNames);

    if (!names) {
      return `${SLOT_PHRASES[slot]}.`;
    }

    if (input.petNames.length >= 2) {
      return `${names} 함께 놀았어요. ${SLOT_PHRASES[slot]}.`;
    }

    return `${names}의 ${SLOT_PHRASES[slot]}.`;
  }

  /**
   * 하루 마감 — 그 아이의 오늘 사진들을 모아 만든 알림장 초안.
   * "선생님은 알림장을 한 번도 쓰지 않습니다"가 성립하는 지점이라 문장이 그대로 보호자에게 간다.
   *
   * 모델이 답을 못 주면(키 미설정·장애·거절) 규칙 기반 문장으로 폴백한다. 알림장이 조금
   * 밋밋해질지언정 하루 마감 자체는 반드시 끝나야 한다.
   */
  async generateDigest(input: DigestInput): Promise<string> {
    const generated = await this.claude.complete({
      system: DIGEST_SYSTEM_PROMPT,
      prompt: this.buildDigestPrompt(input),
      maxTokens: 400,
    });

    return generated ?? this.buildFallbackDigest(input);
  }

  /** 모델에 넘길 재료. 없는 항목은 아예 빼서 "모른다"를 "없다"로 오해하지 않게 한다. */
  private buildDigestPrompt(input: DigestInput): string {
    const lines = [
      `아이 이름: ${input.petName}`,
      `오늘 사진 수: ${input.photoCount}장`,
    ];

    if (input.friendNames.length > 0) {
      lines.push(`같은 사진에 함께 찍힌 친구: ${input.friendNames.join(", ")}`);
    }

    const captions = input.captions
      .map((caption) => caption.trim())
      .filter(Boolean);
    if (captions.length > 0) {
      lines.push(
        "선생님이 사진에 남긴 메모:",
        ...captions.map((caption) => `- ${caption}`),
      );
    }

    lines.push("", "위 정보로 오늘의 알림장을 써주세요.");
    return lines.join("\n");
  }

  /** LLM 을 못 쓸 때의 문장. 사실만 나열하므로 밋밋하지만 틀리지는 않는다. */
  private buildFallbackDigest(input: DigestInput): string {
    const sentences: string[] = [];

    sentences.push(
      input.photoCount > 0
        ? `오늘 ${input.petName}의 사진 ${input.photoCount}장이 기록됐어요.`
        : `오늘 ${input.petName}의 기록이에요.`,
    );

    if (input.friendNames.length > 0) {
      sentences.push(
        `${joinNames(input.friendNames)}와(과) 함께 있는 모습이 담겼어요.`,
      );
    }

    // 선생님이 직접 쓴 캡션이 가장 생생한 1차 자료라 요약에 그대로 얹는다.
    const captions = input.captions
      .map((caption) => caption.trim())
      .filter(Boolean);
    if (captions.length > 0) {
      sentences.push(captions.join(" "));
    }

    return sentences.join(" ");
  }
}
