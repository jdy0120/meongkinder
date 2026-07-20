import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

export const s3Config = {
  region,
  bucketName: process.env.AWS_S3_BUCKET_NAME,
};

export const s3Client =
  region && accessKeyId && secretAccessKey
    ? new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;
