import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  prisma,
  getTenantId,
  isBypass,
  runWithoutTenant,
  type ExtendedTransactionClient,
} from "@pawlog/database";
import { Domain, type FileUrlResponse } from "@pawlog/shared";
import * as fs from "fs";
import * as path from "path";
import * as UTILS from "../../utils/file";
import { DEFAULT_TENANT_ID } from "../../utils/tenant";
import { FILE_ROUTES } from "../routes";

// 파일 도메인 중에는 SUPER_ADMIN 이 X-Tenant-Id 헤더 없이 다루는 전역 리소스(약관 등)도 있어
// requireTenantId() 로 강제하지 않고, ALS 에 실제 테넌트가 있으면 그것을, 없으면 기존 단일
// default-tenant 동작을 그대로 유지한다.
const resolveTenantId = () => getTenantId() ?? DEFAULT_TENANT_ID;

/**
 * 파일의 소유 테넌트를 정하는 방식 (job-055).
 *
 * - `"request"` (기본): **요청 스코프의 테넌트**가 소유한다. 피드 사진·알림장 첨부처럼
 *   그 매장에서 만들어져 그 매장 안에서만 쓰이는 자료.
 * - `"shared"`: 어느 테넌트의 것도 아니다 (`tenantId = null`). **매장을 옮겨 다니는
 *   엔티티에 붙는 파일**이 여기 해당한다 — 지금은 펫 프로필 사진 하나뿐이다.
 *
 * ## 왜 이 구분이 필요한가
 *
 * 파일의 테넌트는 **업로드한 요청의 스코프**로 정해지는데, 그 파일이 보이는 범위는
 * **붙어 있는 엔티티의 테넌트**가 정한다. 펫은 그 둘이 어긋나는 유일한 엔티티다:
 * 보호자가 `/pet` 에서(개인 스코프 → 테넌트 없음) 사진과 함께 아이를 등록하고,
 * 나중에 원장이 그 아이를 원생으로 받으면(`intake` 의 `ENROLLED_EXISTING`) **펫의
 * tenantId 만 매장으로 바뀌고 파일은 그대로 남는다.** 그러면 매장 화면에서
 * `GET v1/file/:id` 가 Prisma Extension 의 스코프 주입에 걸려 404 가 되고, 화면에는
 * 깨진 아바타만 남는다 — 파일은 디스크에 멀쩡히 있는데도.
 *
 * 등원/전학마다 파일 테넌트를 따라 옮기는 방법도 있지만, 동기화 지점이 계속 늘고
 * 한 곳만 빠뜨려도 같은 404 가 재발한다. 펫 사진은 애초에 매장의 자료가 아니라
 * **그 아이의 것**이므로, 테넌트를 아예 주지 않는 쪽이 사실에 맞다.
 */
export type FileOwnership = "request" | "shared";

export interface MoveFileOptions {
  fileList: { id: string }[];
  domain: Domain;
  newPath: string;
  tx?: ExtendedTransactionClient;
  beforeMove?: (files: any[]) => Promise<void>;
  /** 기본 `"request"`. 자세한 내용은 `FileOwnership` 참고. */
  ownership?: FileOwnership;
}

export interface EraseTempsOptions {
  files: { id: string; localPath?: string | null }[];
  tx?: ExtendedTransactionClient;
}

export interface StreamedFile {
  stream: fs.ReadStream;
  originalName: string;
  mimeType: string;
  sizeByte: number;
}

@Injectable()
export class FileService {
  async uploadsTemp(files: Express.Multer.File[], uploadedBy?: string | null) {
    const tenantId = resolveTenantId();

    const createdFiles = await Promise.all(
      files.map(async (file) => {
        const originalName = file.originalname;
        const lastDot = originalName.lastIndexOf(".");
        const originalExtension =
          lastDot !== -1 ? originalName.substring(lastDot) : "";

        // job-052: 실제 MIME 을 파일 내용으로 판별하고, 이미지면 WebP 로 다시 저장한다.
        // multer 가 이미 디스크에 쓴 뒤라 여기서 변환하고 원본을 지운다.
        //
        // 변환하지 않는 경우(GIF·SVG·이미 WebP/AVIF·HEIC·실패·되레 커지는 경우)에도
        // **판별한 MIME 은 반영한다** — 저장 포맷을 못 바꿨더라도 DB 타입은 정확해야 하고,
        // 그 값이 다운로드 Content-Type 이 된다.
        const normalized = await UTILS.normalizeUploadedFile(
          file.path,
          file.mimetype,
          file.size,
        );

        const storedFilename = normalized.filename;
        // 변환하지 않았으면 업로드된 파일명의 확장자를 그대로 쓴다. 원본 파일명의
        // 확장자(originalExtension)와 다를 수 있어 저장된 쪽을 기준으로 삼는다.
        const extension = normalized.converted
          ? normalized.extension
          : normalized.extension || originalExtension;
        const mimeType = normalized.mimeType;
        const sizeByte = normalized.size;

        // multer destination 콜백(getMulterOptions)도 동일하게 ALS tenantId 로 temps 하위 경로를
        // 분리하므로, DB 에 남기는 localPath 도 같은 규칙(resources/temps/<tenantId>/<filename>)을 따른다.
        const localPath = path.join(
          "resources",
          "temps",
          tenantId,
          storedFilename,
        );

        const createdFile = await prisma.fileTemp.create({
          data: {
            tenantId,
            // 원본 파일명은 변환과 무관하게 그대로 보존한다 — 사용자가 올린 이름이고
            // 다운로드 시 보여줄 이름이다. 저장 포맷만 바뀐 것이지 파일이 바뀐 게 아니다.
            originalName,
            extension,
            mimeType,
            sizeByte: BigInt(sizeByte),
            localPath,
            uploadedBy: uploadedBy ?? null,
          },
        });

        return {
          ...createdFile,
          sizeByte: Number(createdFile.sizeByte),
          cloudPath: null,
          storageStatus: "LOCAL",
          checksumMd5: null,
          checksumSha256: null,
          syncedAt: null,
          deletedAt: null,
        };
      }),
    );

    return createdFiles;
  }

  /**
   * 조회한 파일이 현재 요청 스코프에서 읽어도 되는지 확인한다 (job-055).
   *
   * ⚠️ 이 검사는 **직접 해야 한다.** 예전에는 `prisma.file.findUnique` 에 Prisma Extension 이
   * 자동 주입하는 `tenantId` 에만 기댔는데, 그러면 `tenantId = null` 인 공유 파일(펫 프로필
   * 사진)이 테넌트 스코프에서 통째로 안 보인다 — where 에 `tenantId: <매장>` 이 붙는 순간
   * null 은 매칭되지 않기 때문이다. 그래서 조회는 스코프 밖에서 하고 권한은 여기서 본다.
   *
   * 규칙은 세 줄이다:
   *   1. `tenantId = null` — 테넌트 소유가 아니다. 어느 스코프에서든 읽을 수 있다.
   *   2. bypass(개인 스코프 / SUPER_ADMIN) — 예전 그대로 통과. 보호자가 개인 화면에서
   *      매장이 올린 알림장 사진을 보는 경로가 여기다.
   *   3. 그 외 — 활성 테넌트의 파일이어야 한다. 남의 매장 파일은 거부.
   */
  private assertReadable(file: { tenantId: string | null }): void {
    if (file.tenantId === null) return;
    if (isBypass()) return;
    if (file.tenantId === getTenantId()) return;

    throw new ForbiddenException("해당 파일에 접근할 권한이 없습니다.");
  }

  /** fileId 로 저장된 파일을 조회해 접근 가능한 URL(Azure Blob SAS URL 또는 로컬 정적 서빙 URL)을 반환한다. */
  async getFileUrl(fileId: string): Promise<FileUrlResponse> {
    // 스코프 밖에서 조회하고 권한은 assertReadable 이 본다 (위 주석 참고).
    const file = await runWithoutTenant(() =>
      prisma.file.findUnique({ where: { id: fileId } }),
    );
    if (!file || file.deletedAt) {
      throw new NotFoundException("존재하지 않는 파일입니다.");
    }
    this.assertReadable(file);

    if (file.storageStatus === "CLOUD" && file.cloudPath) {
      const url = await UTILS.getBlobSasUrl(file.cloudPath);
      return {
        id: file.id,
        url,
        originalName: file.originalName,
        mimeType: file.mimeType,
      };
    }

    if (file.localPath) {
      // `/resources` 정적 마운트가 제거되었으므로, LOCAL 파일은 인증 + 소유권 검사를 거치는
      // 스트리밍 엔드포인트(GET v1/file/:fileId/raw)의 URL을 반환한다.
      const base = (
        process.env.API_PUBLIC_URL ||
        `http://localhost:${process.env.SERVER_PORT || 3000}`
      ).replace(/\/$/, "");
      const project = process.env.PROJECT_NAME ?? "template-dev";
      const url = `${base}/api/${project}${FILE_ROUTES.v1.BASE}/${file.id}/raw`;
      return {
        id: file.id,
        url,
        originalName: file.originalName,
        mimeType: file.mimeType,
      };
    }

    throw new NotFoundException("파일 경로 정보를 찾을 수 없습니다.");
  }

  /**
   * fileId 로 저장된 파일을 스트리밍용 fs.ReadStream 으로 연다 (GET v1/file/:fileId/raw).
   *
   * job-055: 조회는 `runWithoutTenant` 로 하고 소유권은 `assertReadable` 이 본다 —
   * 자동 주입에 기대면 `tenantId = null` 인 공유 파일(펫 프로필 사진)이 매장 스코프에서
   * 통째로 사라진다. 이제 스코프 검사는 `getFileUrl` 과 **같은 규칙 하나**를 쓴다.
   */
  async streamFile(fileId: string): Promise<StreamedFile> {
    const file = await runWithoutTenant(() =>
      prisma.file.findUnique({ where: { id: fileId } }),
    );
    if (!file || file.deletedAt) {
      throw new NotFoundException("존재하지 않는 파일입니다.");
    }

    // job-053: 활성 테넌트는 **ALS** 에서 읽는다. 예전에는 컨트롤러가 넘겨준
    // `req.tenantMembership?.tenantId` 와 비교했는데, `TenantMiddleware` 는
    // **SUPER_ADMIN 에게 `req.tenantMembership` 을 일부러 설정하지 않는다**
    // (tenant.middleware.ts — 플랫폼 관리자는 테넌트 멤버십 없이 들어온다).
    // 그래서 그 값이 항상 `null` 이 되어 **모든 파일이 403** 이었다 — 업로드는
    // 되는데 어떤 이미지도 뜨지 않는 상태였고, 화면에는 깨진 썸네일만 보여
    // 파일이 없는 것처럼 읽혔다.
    //
    // ALS 는 Prisma Extension 이 tenantId 를 주입할 때 쓰는 것과 **같은 출처**라
    // "조회는 되는데 스트리밍만 막히는" 어긋남이 원리적으로 생기지 않는다.
    this.assertReadable(file);

    if (file.storageStatus === "CLOUD" || !file.localPath) {
      throw new NotFoundException(
        "로컬 저장소에 존재하지 않는 파일입니다. GET v1/file/:fileId 로 접근 URL을 조회하세요.",
      );
    }

    const absolutePath = path.join(process.cwd(), file.localPath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException("파일을 찾을 수 없습니다.");
    }

    return {
      stream: fs.createReadStream(absolutePath),
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeByte: Number(file.sizeByte),
    };
  }

  /**
   * 임시 업로드 → 영구 저장.
   *
   * ⚠️ **현재는 프로덕션에서도 로컬 디스크에 저장한다** (사용자 결정). 예전에는
   * `NODE_ENV === "production"` 이면 S3/Blob 으로 올리고 `storageStatus = CLOUD` 로
   * 기록했는데, 클라우드 저장소를 붙이기 전까지 그 분기가 켜지면 **업로드가 프로덕션에서만
   * 실패**한다(개발에서는 로컬 경로라 아무 문제가 없어 배포 전까지 드러나지 않는다).
   *
   * 그래서 분기를 없애고 로컬 경로 하나로 합쳤다. 클라우드로 옮길 때는 이 위임을 지우고
   * 아래 `moveTempsToUploadsLocal` 과 갈라진 예전 구현(`UTILS.moveFiles` 의 S3 분기)을
   * 되살리면 된다 — **호출부는 손대지 않아도 된다.** 그게 이 위임을 남겨 둔 이유다.
   */
  async moveTempsToUploads(options: MoveFileOptions) {
    return this.moveTempsToUploadsLocal(options);
  }

  // ⚠️ 이 클라우드 구현은 아직 `ownership` 을 반영하지 않는다 (job-055). 되살릴 때
  //    `moveTempsToUploadsLocal` 의 shared 분기를 그대로 옮겨 와야 한다 — 빠뜨리면
  //    클라우드로 전환하는 순간 펫 사진이 다시 매장 소유가 되어 전학 시 404 가 난다.
  private async moveTempsToUploadsCloud(options: MoveFileOptions) {
    const { fileList, domain, newPath, tx, beforeMove } = options;
    const fileIds = fileList.map((file) => file.id);

    const client = tx || prisma;

    const fileTemps = await client.fileTemp.findMany({
      where: { id: { in: fileIds } },
    });

    if (beforeMove) {
      await beforeMove(fileTemps);
    }

    const filesToMove = fileTemps
      .filter((file) => !!file.localPath)
      .map((file) => ({
        localPath: file.localPath as string,
        mimeType: file.mimeType || undefined,
      }));

    const tenantId = resolveTenantId();
    await UTILS.moveFiles(tenantId, domain, filesToMove, newPath);

    await Promise.all(
      fileTemps.map(async (temp) => {
        const filename = temp.localPath ? path.basename(temp.localPath) : "";
        const newLocalPath = temp.localPath
          ? UTILS.buildStoragePath(tenantId, domain, newPath, filename)
          : null;

        await client.file.create({
          data: {
            id: temp.id,
            tenantId,
            originalName: temp.originalName,
            extension: temp.extension,
            mimeType: temp.mimeType,
            sizeByte: temp.sizeByte,
            uploadedBy: temp.uploadedBy,
            ...(process.env.NODE_ENV === "production"
              ? {
                  localPath: null,
                  cloudPath: newLocalPath,
                }
              : {
                  localPath: newLocalPath,
                  cloudPath: null,
                }),
            storageStatus:
              process.env.NODE_ENV === "production" ? "CLOUD" : "LOCAL",
          },
        });
      }),
    );

    await this.eraseTemps({ files: fileTemps, tx });
  }

  async moveTempsToUploadsLocal(options: MoveFileOptions) {
    const { fileList, domain, newPath, tx, beforeMove, ownership } = options;
    const fileIds = fileList.map((file) => file.id);

    const client = tx || prisma;

    const fileTemps = await client.fileTemp.findMany({
      where: { id: { in: fileIds } },
    });

    if (beforeMove) {
      await beforeMove(fileTemps);
    }

    const filesToMove = fileTemps
      .filter((file) => !!file.localPath)
      .map((file) => ({
        localPath: file.localPath as string,
        mimeType: file.mimeType || undefined,
      }));

    // 공유 파일은 소유 테넌트가 없으므로 저장 경로도 테넌트 디렉터리 밖(_shared)에 둔다.
    const shared = ownership === "shared";
    const ownerTenantId = shared ? null : resolveTenantId();
    const pathSegment = shared ? UTILS.SHARED_STORAGE_DIR : resolveTenantId();

    await UTILS.moveFilesLocal(pathSegment, domain, filesToMove, newPath);

    await Promise.all(
      fileTemps.map(async (temp) => {
        const filename = temp.localPath ? path.basename(temp.localPath) : "";
        const newLocalPath = temp.localPath
          ? UTILS.buildStoragePath(pathSegment, domain, newPath, filename)
          : null;

        const data = {
          id: temp.id,
          tenantId: ownerTenantId,
          originalName: temp.originalName,
          extension: temp.extension,
          mimeType: temp.mimeType,
          sizeByte: temp.sizeByte,
          uploadedBy: temp.uploadedBy,
          localPath: newLocalPath,
          cloudPath: null,
          storageStatus: "LOCAL",
        };

        // ⚠️ 공유 파일은 반드시 스코프 **밖**에서 만든다. Prisma Extension 은 create 의
        // data 에도 ALS tenantId 를 주입하는데(tenant-scope.extension.ts `injectCreateData`),
        // 그건 여기서 명시한 `tenantId: null` 을 **덮어쓴다** — 원장이 매장 화면에서 올린
        // 펫 사진만 조용히 테넌트 소유가 되어, 그 아이가 전학 가는 순간 다시 404 가 된다.
        if (shared) {
          await runWithoutTenant(() => client.file.create({ data }));
          return;
        }

        await client.file.create({ data });
      }),
    );

    await this.eraseTemps({ files: fileTemps, tx });
  }

  /**
   * 프로필 사진처럼 **한 장짜리** 임시 업로드를 영구 저장소로 옮긴다 (job-053).
   *
   * 두 가지를 흡수한다:
   *
   * 1. **미전달** — `undefined` 면 아무것도 하지 않는다. 부분 수정에서 사진을 안 건드린
   *    요청과 구분해야 한다.
   * 2. **이미 영구 파일** — 수정 폼은 기존 `profileImageFileId` 를 그대로 되돌려보낸다.
   *    이때 FileTemp 에는 그 id 가 없으므로 조용히 통과시킨다. 여기서 던지면 사진을
   *    바꾸지 않은 평범한 정보 수정이 전부 실패한다.
   *
   * 그래서 "옮길 게 있으면 옮기고, 없으면 아무 일도 없었던 것"이 이 메서드의 계약이다.
   */
  async promoteTempFile(options: {
    fileId?: string | null;
    domain: Domain;
    newPath: string;
    tx?: ExtendedTransactionClient;
    /** 기본 `"request"`. 자세한 내용은 `FileOwnership` 참고. */
    ownership?: FileOwnership;
  }) {
    const { fileId, domain, newPath, tx, ownership } = options;
    if (!fileId) return;

    const client = tx || prisma;
    const temp = await client.fileTemp.findUnique({ where: { id: fileId } });
    if (!temp) return; // 이미 영구 파일이거나(수정 폼 재전송) 만료된 임시 파일

    await this.moveTempsToUploads({
      fileList: [{ id: fileId }],
      domain,
      newPath,
      tx,
      ownership,
    });
  }

  async eraseTemps(options: EraseTempsOptions) {
    const { files, tx } = options;
    const client = tx || prisma;

    for (const file of files) {
      if (file.localPath) {
        await UTILS.removeFiles(file.localPath);
      }
      await client.fileTemp.delete({
        where: { id: file.id },
      });
    }
  }

  async deleteFile(id: string, tx?: ExtendedTransactionClient) {
    const client = tx || prisma;
    const file = await client.file.findUnique({ where: { id } });
    if (file) {
      if (file.localPath) {
        await UTILS.removeFiles(file.localPath);
      }
      await client.file.delete({ where: { id } });
    }
  }

  /** 생성된 지 24시간이 지난 임시 파일과 DB 레코드를 일괄 정리 */
  async cleanOldTempFiles() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldTemps = await prisma.fileTemp.findMany({
      where: {
        createdAt: {
          lt: oneDayAgo,
        },
      },
    });

    if (oldTemps.length > 0) {
      await this.eraseTemps({ files: oldTemps });
    }

    return oldTemps.length;
  }
}
