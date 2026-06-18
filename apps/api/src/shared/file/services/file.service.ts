import { Injectable } from "@nestjs/common";
import { prisma, Prisma } from "@template/database";
import { Domain } from "@template/shared";
import * as path from "path";
import * as UTILS from "../../utils/file";

export interface MoveFileOptions {
  fileList: { id: string }[];
  domain: Domain;
  newPath: string;
  tx?: Prisma.TransactionClient;
  beforeMove?: (files: any[]) => Promise<void>;
}

export interface EraseTempsOptions {
  files: { id: string; localPath?: string | null }[];
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class FileService {
  async uploadsTemp(files: Express.Multer.File[]) {
    const createdFiles = await Promise.all(
      files.map(async (file) => {
        const originalName = file.originalname;
        const lastDot = originalName.lastIndexOf(".");
        const extension = lastDot !== -1 ? originalName.substring(lastDot) : "";

        const localPath = path.join("resources", "temps", file.filename);

        const createdFile = await prisma.fileTemp.create({
          data: {
            originalName,
            extension,
            mimeType: file.mimetype,
            sizeByte: BigInt(file.size),
            localPath,
          },
        });

        return {
          ...createdFile,
          sizeByte: Number(createdFile.sizeByte),
          cloudPath: null,
          storageStatus: "LOCAL",
          checksumMd5: null,
          checksumSha256: null,
          uploadedBy: null,
          syncedAt: null,
          deletedAt: null,
        };
      }),
    );

    return createdFiles;
  }

  async moveTempsToUploads(options: MoveFileOptions) {
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

    await UTILS.moveFiles(domain, filesToMove, newPath);

    await Promise.all(
      fileTemps.map(async (temp) => {
        const filename = temp.localPath ? path.basename(temp.localPath) : "";
        const newLocalPath = temp.localPath
          ? path.join("resources", "uploads", domain, newPath, filename)
          : null;

        await client.file.create({
          data: {
            id: temp.id,
            originalName: temp.originalName,
            extension: temp.extension,
            mimeType: temp.mimeType,
            sizeByte: temp.sizeByte,
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

  async deleteFile(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const file = await client.file.findUnique({ where: { id } });
    if (file) {
      if (file.localPath) {
        await UTILS.removeFiles(file.localPath);
      }
      await client.file.delete({ where: { id } });
    }
  }
}
