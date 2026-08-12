/**
 * 업로드 전 클라이언트 리사이징.
 *
 * 유치원 와이파이는 대체로 열악하다. 원본 4MB 짜리 사진 15장을 그대로 올리다 중간에 끊기면
 * 다 날아가고, 한 번 겪은 선생님은 그 기능을 다시 쓰지 않는다. 보내는 바이트를 줄이는 것이
 * 실패율을 낮추는 가장 직접적인 수단이라 업로드 경로의 맨 앞에 둔다.
 *
 * 긴 변 기준으로만 줄이므로 이미 작은 사진은 그대로 통과한다.
 */

/** 긴 변 기준 상한. 피드·알림장 표시용으로 충분하면서 전송량을 크게 줄이는 지점. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    image.src = url;
  });

/**
 * 긴 변이 MAX_EDGE 를 넘으면 축소한 WebP 로 변환한다.
 * 변환에 실패하거나 이미 충분히 작으면 **원본을 그대로 돌려준다** — 리사이징은 최적화일 뿐이라
 * 여기서 실패했다고 업로드 자체를 막으면 안 된다.
 */
export const resizeImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;
  // GIF 는 캔버스로 그리면 애니메이션이 첫 프레임으로 납작해진다.
  if (file.type === "image/gif") return file;

  try {
    const image = await loadImage(file);
    const longEdge = Math.max(image.width, image.height);
    if (longEdge <= MAX_EDGE) return file;

    const scale = MAX_EDGE / longEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
};
