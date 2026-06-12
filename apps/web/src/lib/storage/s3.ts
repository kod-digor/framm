import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

function getClient() {
  return new S3Client({
    region: process.env.S3_REGION ?? "fr-par",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

export async function getOrgStorageBytes(orgId: string): Promise<bigint> {
  const bucket = process.env.S3_BUCKET_UPLOADS;
  if (!bucket || !process.env.S3_ACCESS_KEY) return BigInt(0);

  const client = getClient();
  const prefix = `orgs/${orgId}/`;
  let total = BigInt(0);
  let token: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents ?? []) {
      total += BigInt(obj.Size ?? 0);
    }
    token = res.NextContinuationToken;
  } while (token);

  return total;
}

export async function uploadOrgFile(orgId: string, key: string, body: Buffer) {
  const bucket = process.env.S3_BUCKET_UPLOADS;
  if (!bucket) throw new Error("S3 not configured");

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `orgs/${orgId}/${key}`,
      Body: body,
    })
  );
}
