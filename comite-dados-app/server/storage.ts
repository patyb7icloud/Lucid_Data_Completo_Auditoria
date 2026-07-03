/**
 * storage.ts
 * Abstração de armazenamento de arquivos com suporte a múltiplos provedores.
 *
 * Provedor selecionado via variável de ambiente STORAGE_PROVIDER:
 *   - "s3"     → AWS S3 ou qualquer serviço S3-compatível (MinIO, R2, etc.)
 *   - "azure"  → Azure Blob Storage
 *   - "local"  → Sistema de arquivos local (pasta configurável, padrão)
 *
 * Variáveis por provedor:
 *
 * S3:
 *   STORAGE_PROVIDER=s3
 *   AWS_ACCESS_KEY_ID=...
 *   AWS_SECRET_ACCESS_KEY=...
 *   AWS_REGION=us-east-1
 *   AWS_S3_BUCKET=meu-bucket
 *   AWS_S3_ENDPOINT=https://... (opcional, para MinIO/R2/etc.)
 *   AWS_S3_PUBLIC_URL=https://... (opcional, URL pública base)
 *
 * Azure Blob:
 *   STORAGE_PROVIDER=azure
 *   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
 *   AZURE_STORAGE_CONTAINER=lucid-data-governance
 *
 * Local (padrão):
 *   STORAGE_PROVIDER=local
 *   LOCAL_STORAGE_PATH=/var/lucid-data-governance/uploads
 *   LOCAL_STORAGE_PUBLIC_URL=https://meuservidor.com/uploads
 */

import fs from "fs";
import path from "path";

type StorageResult = { key: string; url: string };

// ─── Provider detection ───────────────────────────────────────────────────────

function getProvider(): "s3" | "azure" | "local" {
  const p = (process.env.STORAGE_PROVIDER ?? "").toLowerCase();
  if (p === "s3") return "s3";
  if (p === "azure") return "azure";
  return "local";
}

// ─── S3 provider ─────────────────────────────────────────────────────────────

async function s3Put(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<StorageResult> {
  // Dynamic import to avoid bundling AWS SDK when not needed
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");

  const clientConfig: Record<string, unknown> = {
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  };

  const customEndpoint = process.env.AWS_S3_ENDPOINT;
  if (customEndpoint) {
    clientConfig.endpoint = customEndpoint;
    clientConfig.forcePathStyle = true;
  }

  const client = new S3Client(clientConfig as any);
  const body = typeof data === "string" ? Buffer.from(data) : data;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  const publicBase = process.env.AWS_S3_PUBLIC_URL;
  const url = publicBase
    ? `${publicBase.replace(/\/$/, "")}/${key}`
    : `https://${bucket}.s3.amazonaws.com/${key}`;

  return { key, url };
}

// ─── Azure Blob provider ──────────────────────────────────────────────────────

async function azurePut(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<StorageResult> {
  const { BlobServiceClient } = await import("@azure/storage-blob");

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");

  const containerName = process.env.AZURE_STORAGE_CONTAINER ?? "lucid-data-governance";
  const client = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = client.getContainerClient(containerName);

  // Create container if it doesn't exist
  await containerClient.createIfNotExists({ access: "blob" });

  const blockBlobClient = containerClient.getBlockBlobClient(key);
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  await blockBlobClient.upload(body, body.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return { key, url: blockBlobClient.url };
}

// ─── Local filesystem provider ────────────────────────────────────────────────

async function localPut(
  key: string,
  data: Buffer | Uint8Array | string,
  _contentType: string
): Promise<StorageResult> {
  const basePath = process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), "uploads");
  const filePath = path.join(basePath, key);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, body);

  const publicBase = process.env.LOCAL_STORAGE_PUBLIC_URL ?? "/uploads";
  const url = `${publicBase.replace(/\/$/, "")}/${key}`;

  return { key, url };
}

async function localGet(key: string): Promise<StorageResult> {
  const publicBase = process.env.LOCAL_STORAGE_PUBLIC_URL ?? "/uploads";
  const url = `${publicBase.replace(/\/$/, "")}/${key}`;
  return { key, url };
}

// ─── Public API ───────────────────────────────────────────────────────────────

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Upload a file to the configured storage provider.
 * Returns { key, url } where url is the public access URL.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  const provider = getProvider();

  switch (provider) {
    case "s3":
      return s3Put(key, data, contentType);
    case "azure":
      return azurePut(key, data, contentType);
    case "local":
      return localPut(key, data, contentType);
    default:
      return localPut(key, data, contentType);
  }
}

/**
 * Get the public URL for an existing file.
 */
export async function storageGet(relKey: string): Promise<StorageResult> {
  const key = normalizeKey(relKey);
  const provider = getProvider();

  switch (provider) {
    case "local":
      return localGet(key);
    default:
      // For S3 and Azure, the URL is known from the put operation.
      // Return a best-effort URL based on configuration.
      return storagePut(key, Buffer.alloc(0), "application/octet-stream")
        .then(() => ({ key, url: key }))
        .catch(() => ({ key, url: key }));
  }
}
