import { Readable } from "node:stream";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

export type V2StorageConfig = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  forcePathStyle: boolean;
};

export type PutObjectInput = {
  bucket: string;
  key: string;
  body: Buffer;
  contentType?: string | null;
  metadata?: Record<string, string>;
};

export type GetObjectResult = {
  body: NodeJS.ReadableStream | Buffer;
  contentType?: string | null;
  contentLength?: number | null;
};

export interface V2ObjectStorage {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(bucket: string, key: string): Promise<GetObjectResult>;
}

export class V2StorageConfigError extends Error {
  constructor(message = "V2 object storage is not configured") {
    super(message);
    this.name = "V2StorageConfigError";
  }
}

type StorageEnvironment = {
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_FORCE_PATH_STYLE?: string;
};

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function readV2StorageConfig(
  environment: StorageEnvironment = process.env
): V2StorageConfig | null {
  const endpoint = environment.S3_ENDPOINT?.trim();
  const accessKeyId = environment.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = environment.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = environment.S3_BUCKET?.trim();

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region: environment.S3_REGION?.trim() || "us-east-1",
    forcePathStyle: readBoolean(environment.S3_FORCE_PATH_STYLE, true)
  };
}

export function createS3ObjectStorage(config: V2StorageConfig): V2ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });

  return {
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType ?? undefined,
          Metadata: input.metadata
        })
      );
    },

    async getObject(bucket, key) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key
        })
      );

      const body = result.Body;
      if (!body) {
        return {
          body: Buffer.alloc(0),
          contentType: result.ContentType ?? null,
          contentLength: result.ContentLength ?? null
        };
      }

      if (
        body instanceof Readable ||
        typeof (body as unknown as { pipe?: unknown }).pipe === "function"
      ) {
        return {
          body: body as unknown as NodeJS.ReadableStream,
          contentType: result.ContentType ?? null,
          contentLength: result.ContentLength ?? null
        };
      }

      const bytes = await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType ?? null,
        contentLength: result.ContentLength ?? null
      };
    }
  };
}
