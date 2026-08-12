import { canvasColor } from "@/shared/libs/theme/tokens";

/**
 * 인스타그램 스토리(9:16)용 리포트 요약 카드.
 *
 * job-052: 색을 전부 토큰으로 바꿨다. 캔버스는 CSS 를 모르므로 `canvasColor` 가
 * `getComputedStyle` 로 같은 토큰을 읽어 온다 — 예전에는 여기만 이전 팔레트(주황·앰버)를
 * 하드코딩하고 있어서, **보호자가 SNS 에 올리는 이미지만 앱과 다른 색**이었다.
 * 브랜드가 갈리는 곳이 하필 가장 많이 공유되는 자리였다.
 */
export const STORY_CARD_WIDTH = 1080;
export const STORY_CARD_HEIGHT = 1920;

export interface StoryCardData {
  petName: string;
  dateLabel: string;
  conditionLines: string[];
  comment?: string;
  photoCount: number;
  /** 대표 사진(첫 번째 PHOTO 항목)을 미리 로드해 전달하면 사진 영역에 실제 사진을 그린다 */
  photoImage?: HTMLImageElement | null;
}

/** 캔버스 텍스트 줄바꿈 — maxWidth 를 넘는 지점에서 다음 줄로 넘긴다 */
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/** 원형 배경 + 발바닥 도형으로 구성한 Pawlog 워터마크 (외부 이미지 자산 없이 캔버스로 직접 그림) */
const drawPawWatermark = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 64, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();

  ctx.fillStyle = canvasColor("primary");
  ctx.translate(cx, cy - 6);
  ctx.beginPath();
  ctx.ellipse(0, 16, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  const toeOffsets: [number, number][] = [
    [-22, -14],
    [-8, -24],
    [8, -24],
    [22, -14],
  ];
  toeOffsets.forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.ellipse(dx, dy, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  ctx.fillStyle = canvasColor("text");
  ctx.font = "600 26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Pawlog", cx, cy + 100);
};

/** 인스타그램 스토리(9:16)용 리포트 요약 카드를 캔버스에 그린다 */
export const drawStoryCard = (
  canvas: HTMLCanvasElement,
  data: StoryCardData,
) => {
  canvas.width = STORY_CARD_WIDTH;
  canvas.height = STORY_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 배경 그라데이션
  const gradient = ctx.createLinearGradient(0, 0, 0, STORY_CARD_HEIGHT);
  gradient.addColorStop(0, canvasColor("bg"));
  gradient.addColorStop(1, canvasColor("cautionTint"));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STORY_CARD_WIDTH, STORY_CARD_HEIGHT);

  const marginX = 80;
  let y = 160;

  // 헤더: 펫 이름 + 날짜
  ctx.fillStyle = canvasColor("primaryOnTint");
  ctx.font = "700 64px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${data.petName}의 하루`, marginX, y);

  y += 56;
  ctx.font = "500 34px sans-serif";
  ctx.fillStyle = canvasColor("cautionText");
  ctx.fillText(data.dateLabel, marginX, y);

  // 사진 영역 — 대표 사진이 로드되어 있으면 실제 사진을 crop 해서 채우고,
  // 없으면(사진 없음/로드 실패) 자리표시 프레임을 표시한다.
  y += 70;
  const photoBoxWidth = STORY_CARD_WIDTH - marginX * 2;
  const photoBoxHeight = 640;
  const photoBoxRadius = 32;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(marginX, y, photoBoxWidth, photoBoxHeight, photoBoxRadius);
  ctx.clip();

  if (data.photoImage) {
    const img = data.photoImage;
    const boxRatio = photoBoxWidth / photoBoxHeight;
    const imgRatio = img.width / img.height;
    let drawWidth = photoBoxWidth;
    let drawHeight = photoBoxHeight;
    if (imgRatio > boxRatio) {
      drawHeight = photoBoxHeight;
      drawWidth = drawHeight * imgRatio;
    } else {
      drawWidth = photoBoxWidth;
      drawHeight = drawWidth / imgRatio;
    }
    const drawX = marginX + (photoBoxWidth - drawWidth) / 2;
    const drawY = y + (photoBoxHeight - drawHeight) / 2;
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    if (data.photoCount > 1) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.roundRect(
        marginX + photoBoxWidth - 220,
        y + photoBoxHeight - 80,
        180,
        56,
        28,
      );
      ctx.fill();
      ctx.fillStyle = canvasColor("surface");
      ctx.font = "600 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `+${data.photoCount - 1}장`,
        marginX + photoBoxWidth - 130,
        y + photoBoxHeight - 42,
      );
    }
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(marginX, y, photoBoxWidth, photoBoxHeight);

    ctx.fillStyle = canvasColor("cautionText");
    ctx.font = "500 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      data.photoCount > 0 ? `오늘의 사진 ${data.photoCount}장 📷` : "오늘의 순간 🐾",
      STORY_CARD_WIDTH / 2,
      y + photoBoxHeight / 2,
    );
  }
  ctx.restore();

  // 컨디션 요약
  y += photoBoxHeight + 90;
  ctx.textAlign = "left";
  ctx.fillStyle = canvasColor("primaryOnTint");
  ctx.font = "700 40px sans-serif";
  ctx.fillText("오늘의 컨디션", marginX, y);

  y += 54;
  ctx.font = "500 34px sans-serif";
  ctx.fillStyle = canvasColor("text");
  for (const line of data.conditionLines.slice(0, 5)) {
    ctx.fillText(`• ${line}`, marginX, y);
    y += 50;
  }

  // 코멘트
  if (data.comment) {
    y += 30;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    const commentBoxTop = y;
    ctx.font = "500 32px sans-serif";
    const lines = wrapText(ctx, data.comment, STORY_CARD_WIDTH - marginX * 2 - 60);
    const commentBoxHeight = 60 + lines.length * 44;
    ctx.beginPath();
    ctx.roundRect(marginX, commentBoxTop, STORY_CARD_WIDTH - marginX * 2, commentBoxHeight, 24);
    ctx.fill();

    ctx.fillStyle = canvasColor("text");
    let commentY = commentBoxTop + 54;
    for (const line of lines) {
      ctx.fillText(line, marginX + 30, commentY);
      commentY += 44;
    }
  }

  // 워터마크 (하단 중앙)
  drawPawWatermark(ctx, STORY_CARD_WIDTH / 2, STORY_CARD_HEIGHT - 160);
};
