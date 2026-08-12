import { Post } from "@/shared/libs/axios/request";

import { resizeImage } from "./resizeImage";

export interface UploadedPhoto {
  id: string;
  originalName: string;
}

/** 한 번에 보낼 사진 수. 요청 하나가 너무 커지면 끊길 확률이 그만큼 올라간다. */
const CHUNK_SIZE = 4;
/** 청크 단위 재시도 횟수. 현장 와이파이의 일시적 끊김은 대개 한 번 더 보내면 통과한다. */
const MAX_RETRIES = 2;

const uploadChunk = async (files: File[]): Promise<UploadedPhoto[]> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  // Content-Type 을 수동 지정하면 multipart boundary 가 누락되어 서버(multer)가 파일을
  // 파싱하지 못한다. undefined 로 두어 브라우저가 boundary 를 자동 생성하게 한다.
  const res = await Post<UploadedPhoto[], FormData>(
    "/v1/file/upload",
    formData,
    { headers: { "Content-Type": undefined } },
  );
  return res.data.data ?? [];
};

/**
 * 사진 여러 장을 리사이징 → 청크 분할 → 재시도까지 거쳐 업로드한다 (shared).
 *
 * 사진 15장을 한 요청에 몰아 넣으면 중간에 끊겼을 때 15장이 전부 날아간다. 청크로 쪼개면
 * 실패 범위가 4장으로 줄고, 앞선 청크의 결과는 이미 서버에 남는다. `onProgress` 는 화면이
 * "3/15장 업로드됨"을 보여주기 위한 것으로, 진행 상황이 보이지 않으면 선생님은 멈춘 줄 알고
 * 앱을 닫는다.
 *
 * 두 개의 feature 가 각각 이 로직을 갖지 않도록 shared 에 둔다 (FSD 상 feature 끼리는 import 불가).
 */
export const uploadPhotos = async (
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadedPhoto[]> => {
  const prepared = await Promise.all(files.map(resizeImage));
  const uploaded: UploadedPhoto[] = [];

  for (let i = 0; i < prepared.length; i += CHUNK_SIZE) {
    const chunk = prepared.slice(i, i + CHUNK_SIZE);

    let lastError: unknown;
    let done = false;
    for (let attempt = 0; attempt <= MAX_RETRIES && !done; attempt += 1) {
      try {
        uploaded.push(...(await uploadChunk(chunk)));
        done = true;
      } catch (error) {
        lastError = error;
      }
    }
    if (!done) throw lastError;

    onProgress?.(uploaded.length, prepared.length);
  }

  return uploaded;
};
