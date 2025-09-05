import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION!;
const bucket = process.env.AWS_S3_BUCKET!;
const publicBase = process.env.AWS_S3_PUBLIC_URL || `https://${bucket}.s3.${region}.amazonaws.com`;

if (!region || !bucket) {
  console.warn("[s3] Missing AWS_REGION or AWS_S3_BUCKET. Presign will fail until you set env vars.");
}

export const s3 = new S3Client({
  region,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
});

export async function presignPutObject(key: string, contentType: string) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
  const publicUrl = `${publicBase.replace(/\/$/, "")}/${encodeURIComponent(key)}`;
  return { url, publicUrl, bucket, key };
}
