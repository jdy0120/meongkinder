import { diskStorage } from "multer"; // NestJS에 내장
import { fileTypeFromBuffer } from "file-type";
import { randomBytes } from "crypto";
import { Domain } from "@pawlog/shared";
import * as fs from "fs";
import { join, relative, extname } from "path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { containerClient } from "../configs/azure.config";
import { s3Client, s3Config } from "../configs/s3.config";
import { mimeMap } from "../constants";
import { fileLogger } from "../logger";

export const resourcePath = join(process.cwd(), "resources");
export const tempPath = () => join(resourcePath, "temps");
export const uploadPath = () => join(resourcePath, "uploads");
export const storagePath = () => join("resources", "uploads");

export const DEFAULT_MAX_FILES = 10;
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// this for server, it may private, no need to open to client.
export const getTempPath = () => join(tempPath());
export const getUploadPath = (domain: Domain) => join(uploadPath(), domain);
export const getStoragePath = (domain: Domain) => join(storagePath(), domain);

// this for client, client may request file by this path.
export const getStaticTempPath = () => join("resources", "temps");
export const getStaticUploadPath = (domain: Domain) =>
  join("resources", "uploads", domain);

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
        const path = getTempPath();
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

export const moveFiles = async (
  domain: Domain,
  files: { localPath: string; mimeType?: string }[],
  to: string,
) => {
  const directoryPath = join(getUploadPath(domain), to);
  makeDirectory(directoryPath);

  for (const file of files) {
    const oldPath = file.localPath;
    let fname = "";
    if (oldPath.includes("temps/")) {
      fname = oldPath.split("temps/")[1];
    } else {
      const parts = oldPath.split("/");
      fname = parts[parts.length - 1];
    }

    if (!fname) {
      fileLogger.error(`filename not found for path: ${oldPath}`);
      throw new Error("Filename not found");
    }

    const srcPath = oldPath.startsWith(resourcePath)
      ? oldPath
      : join(getTempPath(), fname);

    const newPath = join(directoryPath, fname);

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
  domain: Domain,
  files: { localPath: string; mimeType?: string }[],
  to: string,
) => {
  const directoryPath = join(getUploadPath(domain), to);
  makeDirectory(directoryPath);

  for (const file of files) {
    const oldPath = file.localPath;
    let fname = "";
    if (oldPath.includes("temps/")) {
      fname = oldPath.split("temps/")[1];
    } else {
      const parts = oldPath.split("/");
      fname = parts[parts.length - 1];
    }

    if (!fname) {
      fileLogger.error(`filename not found for path: ${oldPath}`);
      throw new Error("Filename not found");
    }

    const srcPath = oldPath.startsWith(resourcePath)
      ? oldPath
      : join(getTempPath(), fname);

    const newPath = join(directoryPath, fname);
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
