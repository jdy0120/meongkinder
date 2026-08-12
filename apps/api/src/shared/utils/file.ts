import { diskStorage } from "multer"; // NestJS에 내장
import { fileTypeFromBuffer, fileTypeFromFile } from "file-type";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomBytes } from "crypto";
import { Domain } from "@pawlog/shared";
import { getTenantId } from "@pawlog/database";
import * as fs from "fs";
import { join, relative, extname, dirname } from "path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { BlobSASPermissions } from "@azure/storage-blob";
import { containerClient } from "../configs/azure.config";
import { s3Client, s3Config } from "../configs/s3.config";
import { mimeMap } from "../constants";
import { fileLogger } from "../logger";
import { DEFAULT_TENANT_ID } from "./tenant";

const execFileAsync = promisify(execFile);

export const resourcePath = join(process.cwd(), "resources");
export const tempPath = () => join(resourcePath, "temps");
export const storagePath = () => join("resources", "uploads");

export const DEFAULT_MAX_FILES = 10;
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// this for server, it may private, no need to open to client.
export const getTempPath = (tenantId: string) => join(tempPath(), tenantId);

/**
 * 테넌트/도메인/논리경로/파일명으로 파일의 논리(상대) 저장 경로를 조립한다.
 * `resources/uploads/<tenantId>/<domain>/<newPath>/<filename>` 형태 — 테넌트별로 물리적으로도
 * 분리해 크로스 테넌트 파일 접근(경로 추측)을 막는다. DB(localPath/cloudPath)에는 이 상대 경로를
 * 그대로 저장하고, 실제 파일시스템 조작 시에는 `join(process.cwd(), ...)`로 절대 경로화해 사용한다.
 */
export const buildStoragePath = (
  tenantId: string,
  domain: Domain,
  newPath: string,
  filename: string,
): string => join(storagePath(), tenantId, domain, newPath, filename);

/**
 * 소유 테넌트가 없는 파일(`FileService` 의 ownership: "shared")이 들어가는 최상위 디렉터리.
 * `buildStoragePath` 의 tenantId 자리에 이 값을 넣는다 — 테넌트 id 는 항상 UUID 라
 * 이 이름과 충돌할 수 없다.
 */
export const SHARED_STORAGE_DIR = "_shared";

export const makeDirectory = (path: string) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
};

const filename = (name: string, extension: string) => {
  const today = Date.now();
  const random = randomBytes(16).toString("hex");

  return `${today}_${random}${extension}`;
};

export const getMulterOptions = () => {
  return {
    storage: diskStorage({
      destination: (req, file, cb) => {
        // ALS 에 실린 테넌트(TenantMiddleware 가 먼저 실행됨)로 임시 업로드 경로를 분리한다.
        // 미해석(bypass) 상황이면 기존 단일 default-tenant 동작을 유지한다.
        const tenantId = getTenantId() ?? DEFAULT_TENANT_ID;
        const path = getTempPath(tenantId);
        makeDirectory(path);
        cb(null, path);
      },
      filename: (req, file, cb) => {
        const originalName = file.originalname;
        const lastDot = originalName.lastIndexOf(".");
        const name =
          lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
        const ext = lastDot !== -1 ? originalName.substring(lastDot) : "";

        const finalName = filename(name, ext);
        cb(null, finalName);
      },
    }),
    limits: {
      files: DEFAULT_MAX_FILES,
      fileSize: DEFAULT_MAX_FILE_SIZE,
    },
  };
};

export const parseMime = async (buffer: Buffer) => {
  return await fileTypeFromBuffer(buffer);
};

/** WebP 품질. 82는 사진에서 육안 차이가 거의 없으면서 용량이 크게 줄어드는 지점이다. */
const WEBP_QUALITY = 82;

/**
 * 변환하면 안 되는 이미지 타입 (job-052).
 *
 *   gif  — 캔버스/sharp 로 단순 변환하면 애니메이션이 첫 프레임으로 납작해진다.
 *          sharp 의 animated 옵션으로 살릴 수는 있지만, 그 경우 용량이 되레 늘 때가 많다.
 *   svg  — 벡터다. 래스터화하면 확대 시 깨지고 원본의 이점이 사라진다.
 *   webp — 이미 목표 포맷. 다시 인코딩하면 화질만 깎인다.
 *   avif — WebP 보다 압축률이 높다. 바꾸면 오히려 커진다(측정: 409B → 2,022B).
 *          "커지면 원본 유지" 규칙에 어차피 걸리지만, 우연에 기대지 않고 명시한다.
 */
const NO_CONVERT_MIME = new Set([
  "image/gif",
  "image/svg+xml",
  "image/webp",
  "image/avif",
]);

/**
 * sharp 가 디코딩하지 못해 **`vips` CLI 로 우회**하는 이미지 타입 (job-052 → job-053).
 *
 * HEIC/HEIF 는 HEVC(H.265) 코덱을 쓰는데, 특허 라이선스 때문에 npm 으로 배포되는 sharp 의
 * libheif 에는 그 디코더가 빠져 있다 — `sharp.format.heif.input.fileSuffix` 가 `[".avif"]` 뿐이다.
 * `SHARP_FORCE_GLOBAL_LIBVIPS=1` 로 시스템 libvips 를 쓰게 하려 했지만, alpine 의 libvips
 * 8.17.3 이 sharp 0.35 의 요구 버전에 못 미쳐 번들 라이브러리로 되돌아간다.
 *
 * 반면 alpine 의 `vips-heif` 패키지를 깐 libvips 는 HEIC 를 정상 디코딩한다. 그래서 이
 * 포맷만 `vips` 를 자식 프로세스로 불러 처리한다(→ `convertHeicToWebp`).
 */
const HEIC_MIME = new Set(["image/heic", "image/heif"]);

/**
 * HEIC 동시 변환 수 상한 (job-053).
 *
 * 측정값(4코어, 12MP HEIC → 1600px WebP, 24장):
 *
 *   동시  전체시간   장당p50   장당p95   처리량
 *    1     46.9s     1,959ms   1,981ms   0.51장/초
 *    3     19.0s     2,407ms   2,467ms   1.27장/초
 *    6     17.0s     4,152ms   4,737ms   1.41장/초  ← 처리량 포화
 *   15     17.4s    10,128ms  11,854ms   1.38장/초  ← 더 느려짐
 *
 * **처리량은 6에서 포화되고 15에서는 오히려 떨어진다.** CPU 바운드라 코어 수를 넘겨 띄우면
 * 같은 코어를 나눠 쓰느라 장당 지연만 커진다(15에서 4배). `VIPS_CONCURRENCY=1` 로 강제해도
 * 결과가 같은 걸 보면 HEIC 디코딩은 libvips 내부 스레딩이 걸리지 않는다(libheif 단일 스레드)
 * — 즉 **프로세스 수가 곧 병렬도**다.
 *
 * 기본값을 6이 아니라 3으로 두는 이유: 이 코어를 API·웹·DB 가 함께 쓴다. 6이면 변환이 CPU 를
 * 거의 다 먹어 다른 요청까지 느려진다. 처리량 11% 를 포기하고 여유를 남기는 편이 낫다.
 * 나중에 변환을 별도 워커로 분리하면 그쪽에서는 6이 맞다.
 */
const HEIC_CONCURRENCY = Math.max(
  1,
  Number(process.env.IMAGE_CONVERT_CONCURRENCY) || 3,
);

/** HEIC 변환 결과의 긴 변 상한. 클라이언트 리사이즈(1600)와 같은 값이다. */
const HEIC_MAX_EDGE = 1600;

/**
 * 아주 단순한 세마포어. 큐 라이브러리를 들이지 않는 이유는 **필요한 게 동시 실행 수 제한
 * 하나뿐**이기 때문이다 — 재시도·우선순위·영속성이 필요해지면 그때 Redis 큐로 옮긴다.
 */
let heicRunning = 0;
const heicWaiters: (() => void)[] = [];

const acquireHeicSlot = async (): Promise<void> => {
  if (heicRunning < HEIC_CONCURRENCY) {
    heicRunning += 1;
    return;
  }
  await new Promise<void>((resolve) => heicWaiters.push(resolve));
  heicRunning += 1;
};

const releaseHeicSlot = () => {
  heicRunning -= 1;
  heicWaiters.shift()?.();
};

/**
 * 자식 `vips` 프로세스에 넘길 환경변수 (job-053).
 *
 * ⚠️ **`require("sharp")` 는 프로세스 env 에 `VIPSHOME=/target` 을 심는다.** 그대로 물려주면
 * 시스템 `vips` 바이너리가 존재하지도 않는 `/target` 아래에서 플러그인을 찾다가 heif 로더를
 * 못 찾고 `"is not a known file format"` 으로 실패한다 — HEIC 를 읽을 수 있는데도 못 읽는다.
 *
 * 증상이 **"손상된 HEIC"와 구별되지 않아** 진단이 매우 어렵다. 같은 명령을 셸에서 직접 치면
 * 성공하기 때문에 더 헷갈린다(셸에는 VIPSHOME 이 없다). 실제로 이 함수가 없을 때
 * 모든 HEIC 변환이 40ms 만에 조용히 실패했다.
 */
const vipsChildEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.VIPSHOME;
  return env;
};

/**
 * `vips` 실패 사유를 사람이 읽을 수 있게 뽑는다.
 *
 * execFile 의 `error.message` 는 "Command failed: vips …" 뿐이고 **실제 사유는 stderr 에**
 * 있다. 그것만 남기면 로그를 봐도 왜 실패했는지 알 수 없어 진단이 되지 않는다.
 */
const heicFailureReason = (error: unknown): string => {
  const stderr = (error as { stderr?: string | Buffer } | null)?.stderr;
  const detail = stderr ? String(stderr).trim() : "";
  if (detail) return detail.split("\n").slice(0, 2).join(" / ");
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
};

/**
 * HEIC/HEIF 를 WebP 로 변환한다 (job-053).
 *
 * `vips thumbnail` 하나로 **디코딩·축소·인코딩을 한 번에** 한다. 중간 JPEG 을 거치지 않는
 * 이유는 그게 느려서가 아니라(디코딩이 비용의 전부라 출력 포맷은 거의 공짜다) 파일이 두 배가
 * 되기 때문이다 — 실측 1600px 기준 JPEG 240KB vs WebP 124KB.
 *
 * `thumbnail` 은 shrink-on-load 를 써서 전체 해상도로 디코딩한 뒤 줄이는 것보다 빠르다
 * (3,364ms → 1,945ms).
 */
const convertHeicToWebp = async (
  filePath: string,
  webpPath: string,
): Promise<void> => {
  await acquireHeicSlot();
  try {
    await execFileAsync(
      "vips",
      [
        "thumbnail",
        filePath,
        `${webpPath}[Q=${WEBP_QUALITY}]`,
        String(HEIC_MAX_EDGE),
      ],
      { env: vipsChildEnv() },
    );
  } finally {
    releaseHeicSlot();
  }
};

const isConvertibleImage = (mimeType: string) =>
  mimeType.startsWith("image/") &&
  !NO_CONVERT_MIME.has(mimeType) &&
  !HEIC_MIME.has(mimeType);

/**
 * 파일 **내용**으로 실제 MIME 을 판별한다 (job-052).
 *
 * multer 가 넘겨주는 `file.mimetype` 은 클라이언트가 보낸 Content-Type 을 그대로 옮긴 값이라
 * 신뢰할 수 없다. 멀쩡한 PNG 가 `application/octet-stream` 으로 오는 일이 실제로 있고
 * (curl·스크립트 업로드, 일부 모바일 브라우저), 그러면 이미지인 줄 몰라 변환이 통째로
 * 건너뛰어진다. 판별에 실패하면(텍스트·CSV 등 시그니처가 없는 포맷) 선언값으로 돌아간다.
 */
const resolveMimeType = async (
  filePath: string,
  declaredMime: string,
): Promise<string> => {
  try {
    const detected = await fileTypeFromFile(filePath);
    return detected?.mime ?? declaredMime;
  } catch {
    return declaredMime;
  }
};

export interface NormalizedUpload {
  /** WebP 로 다시 저장했는가. false 면 아래 값들은 원본 그대로다. */
  converted: boolean;
  filename: string;
  extension: string;
  /** 파일 내용으로 판별한 실제 MIME (변환했으면 image/webp). */
  mimeType: string;
  size: number;
}

/**
 * 업로드된 파일의 실제 MIME 을 판별하고, 이미지면 WebP 로 다시 저장한다 (job-052).
 *
 * ## 왜 서버에서도 하는가
 *
 * 클라이언트(`apps/web` 의 `resizeImage`)에도 WebP 변환이 있지만 세 군데가 뚫려 있었다:
 * ① 긴 변 1600px 이하 사진은 변환 없이 통과 ② 피드가 아닌 업로드 경로는 변환 자체가 없음
 * ③ API 를 직접 호출하는 경로(스크립트·연동)는 당연히 원본 저장.
 * 저장 포맷을 보장하려면 **저장하는 쪽**이 해야 한다.
 *
 * 클라이언트 리사이징을 없애지 않는 이유는 목적이 달라서다 — 그쪽은 **올리는 바이트**를
 * 줄여 열악한 유치원 와이파이에서 업로드가 끊기지 않게 하는 것이고, 이쪽은 **저장되는
 * 바이트**를 줄인다. 서버 변환은 이미 다 올라온 뒤라 업로드 실패를 막아주지 못한다.
 *
 * ## 실패해도 업로드를 막지 않는다
 *
 * 변환은 최적화일 뿐이다. 손상된 파일이나 sharp 가 모르는 포맷을 만나면 원본을 그대로 두고
 * `converted: false` 로 돌려준다 — 여기서 예외를 던지면 "사진이 안 올라간다"가 된다.
 * 변환 결과가 원본보다 크면(AVIF 등 이미 잘 압축된 포맷) 역시 원본을 유지한다.
 *
 * 변환하지 않는 경우에도 **판별한 MIME 은 돌려준다.** 저장 포맷을 못 바꿨더라도 DB 에
 * 적히는 타입은 정확해야 한다 — 그 값으로 다운로드 Content-Type 이 정해진다.
 */
export const normalizeUploadedFile = async (
  filePath: string,
  declaredMime: string,
  originalSizeByte: number,
): Promise<NormalizedUpload> => {
  const mimeType = await resolveMimeType(filePath, declaredMime);
  const currentName = filePath.split("/").pop() ?? "";
  const lastDot = currentName.lastIndexOf(".");

  const asIs: NormalizedUpload = {
    converted: false,
    filename: currentName,
    extension: lastDot !== -1 ? currentName.substring(lastDot) : "",
    mimeType,
    size: originalSizeByte,
  };

  const isHeic = HEIC_MIME.has(mimeType);
  if (!isHeic && !isConvertibleImage(mimeType)) return asIs;

  const webpPath = filePath.replace(/\.[^.]+$/, "") + ".webp";
  // 확장자가 없는 파일이 들어오면 치환이 일어나지 않아 원본을 덮어쓸 수 있다.
  // 같은 경로면 변환하지 않는다.
  if (webpPath === filePath) return asIs;

  // HEIC 는 sharp 가 못 읽으므로 vips 로 우회한다 (job-053).
  //
  // ⚠️ 실패해도 원본을 그대로 두고 넘어간다 — 여기서 던지면 "사진이 안 올라간다"가 된다.
  // 다만 HEIC 는 폴백되면 **브라우저에서 깨져 보이므로** 조용히 넘기지 않고 구분된 문구로
  // 남긴다(손상 파일 로그와 섞이면 실제 규모를 셀 수 없다).
  if (isHeic) {
    try {
      await convertHeicToWebp(filePath, webpPath);
      const { size } = fs.statSync(webpPath);
      fs.unlinkSync(filePath);
      return {
        converted: true,
        filename: webpPath.split("/").pop() ?? "",
        extension: ".webp",
        mimeType: "image/webp",
        size,
      };
    } catch (error) {
      fileLogger.warn(
        `HEIC 변환 실패 — 원본으로 저장합니다(브라우저에서 표시되지 않을 수 있음). ` +
          `path=${filePath} mime=${mimeType} reason=${heicFailureReason(error)}`,
      );
      if (fs.existsSync(webpPath)) {
        try {
          fs.unlinkSync(webpPath);
        } catch {
          // 찌꺼기를 못 지워도 업로드는 계속한다. 정리 스케줄러가 걷어간다.
        }
      }
      return asIs;
    }
  }

  try {
    const { size } = await sharp(filePath)
      // 회전 정보(EXIF Orientation)를 픽셀에 적용한다. WebP 로 바꾸면 EXIF 가 사라지므로
      // 이걸 빼면 세로로 찍은 사진이 눕는다 — 휴대폰 촬영 사진에서 바로 드러난다.
      .rotate()
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpPath);

    const originalSize = fs.statSync(filePath).size;
    if (size >= originalSize) {
      fs.unlinkSync(webpPath);
      return asIs;
    }

    fs.unlinkSync(filePath);

    return {
      converted: true,
      filename: webpPath.split("/").pop() ?? "",
      extension: ".webp",
      mimeType: "image/webp",
      size,
    };
  } catch (error) {
    fileLogger.warn(
      `WebP 변환 실패 — 원본을 그대로 저장합니다. path=${filePath} mime=${mimeType} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    // 변환 중간에 만들어졌을 수 있는 찌꺼기를 지운다.
    if (fs.existsSync(webpPath)) {
      try {
        fs.unlinkSync(webpPath);
      } catch {
        // 지우지 못해도 업로드는 계속한다. 고아 파일은 정리 스케줄러가 걷어간다.
      }
    }
    return asIs;
  }
};

export const moveFiles = async (
  tenantId: string,
  domain: Domain,
  files: { localPath: string; mimeType?: string }[],
  to: string,
) => {
  for (const file of files) {
    const oldPath = file.localPath;
    const fname = oldPath.split("/").pop();

    if (!fname) {
      fileLogger.error(`filename not found for path: ${oldPath}`);
      throw new Error("Filename not found");
    }

    const srcPath = oldPath.startsWith(resourcePath)
      ? oldPath
      : join(process.cwd(), oldPath);

    const newPath = join(
      process.cwd(),
      buildStoragePath(tenantId, domain, to, fname),
    );
    makeDirectory(dirname(newPath));

    if (process.env.NODE_ENV === "production") {
      /**
       * TODO: 원하는 저장소로 변경
       *  - azure
       *  - s3
       *  - Local
       */
      await uploadToS3(newPath, srcPath, file.mimeType);
    } else {
      await fs.promises.rename(srcPath, newPath);
    }
  }
};

export const removeFiles = async (removePath: string) => {
  const targetPath = removePath.startsWith(resourcePath)
    ? removePath
    : join(process.cwd(), removePath);
  if (fs.existsSync(targetPath)) {
    await fs.promises.unlink(targetPath);
  }
};

export const getMimeType = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase();
  return mimeMap[ext] || "application/octet-stream";
};

export const moveFilesLocal = async (
  tenantId: string,
  domain: Domain,
  files: { localPath: string; mimeType?: string }[],
  to: string,
) => {
  for (const file of files) {
    const oldPath = file.localPath;
    const fname = oldPath.split("/").pop();

    if (!fname) {
      fileLogger.error(`filename not found for path: ${oldPath}`);
      throw new Error("Filename not found");
    }

    const srcPath = oldPath.startsWith(resourcePath)
      ? oldPath
      : join(process.cwd(), oldPath);

    const newPath = join(
      process.cwd(),
      buildStoragePath(tenantId, domain, to, fname),
    );
    makeDirectory(dirname(newPath));
    await fs.promises.rename(srcPath, newPath);
  }
};

export const uploadToBlob = async (
  newPath: string,
  oldPath: string,
  mimeType?: string,
) => {
  try {
    if (!containerClient) {
      throw new Error(
        "Azure Storage client is not initialized. Check your environment variables.",
      );
    }

    // Convert absolute path (e.g. /app/resources/uploads/...) to relative path (resources/uploads/...)
    const relativePath = relative(process.cwd(), newPath);
    // Normalize backslashes to forward slashes for Azure Blob Storage path
    const blobName = relativePath.replace(/\\/g, "/");
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Detect Content-Type from parameters or file extension fallback
    const contentType = mimeType || getMimeType(oldPath);

    await blockBlobClient.uploadFile(oldPath, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });
    fileLogger.log(
      `Successfully uploaded to Azure: ${oldPath} -> ${blobName} (${contentType})`,
    );
  } catch (error) {
    fileLogger.error(
      "Error uploading to Azure:",
      error instanceof Error ? error.stack : undefined,
    );
    throw error;
  }
};

const DEFAULT_SAS_EXPIRY_MINUTES = 60;

/** cloudPath(Azure Blob 경로)에 대한 읽기 전용 SAS URL을 발급한다. */
export const getBlobSasUrl = async (
  blobPath: string,
  expiresInMinutes: number = DEFAULT_SAS_EXPIRY_MINUTES,
) => {
  if (!containerClient) {
    throw new Error(
      "Azure Storage client is not initialized. Check your environment variables.",
    );
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  return blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  });
};

export const uploadToS3 = async (
  newPath: string,
  oldPath: string,
  mimeType?: string,
) => {
  try {
    if (!s3Client || !s3Config.bucketName) {
      throw new Error(
        "S3 client is not initialized. Check your environment variables.",
      );
    }

    const relativePath = relative(process.cwd(), newPath);
    const key = relativePath.replace(/\\/g, "/");
    const contentType = mimeType || getMimeType(oldPath);
    const fileBuffer = await fs.promises.readFile(oldPath);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3Config.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      }),
    );

    fileLogger.log(
      `Successfully uploaded to S3: ${oldPath} -> ${key} (${contentType})`,
    );
  } catch (error) {
    fileLogger.error(
      "Error uploading to S3:",
      error instanceof Error ? error.stack : undefined,
    );
    throw error;
  }
};
