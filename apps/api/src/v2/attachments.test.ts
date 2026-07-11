import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDefaultV2MemorySeed, createV2MemoryRepository } from "./repository.js";
import { registerV2Routes } from "./routes.js";
import { createV2BoardService, V2_MAX_ATTACHMENT_BYTES } from "./service.js";
import type { V2ObjectStorage } from "./storage.js";
import type { RequestContext } from "../context.js";

const ownerContext: RequestContext = {
  userId: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
  source: "dev"
};

const outsideContext: RequestContext = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  source: "dev"
};

function sha256Hex(body: string | Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

function createFakeStorage(): V2ObjectStorage & { objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();

  return {
    objects,
    async putObject(input) {
      objects.set(`${input.bucket}/${input.key}`, Buffer.from(input.body));
    },
    async getObject(bucket, key) {
      const body = objects.get(`${bucket}/${key}`);
      if (!body) {
        throw new Error("Object not found");
      }
      return {
        body,
        contentType: "text/plain",
        contentLength: body.length
      };
    }
  };
}

function createMultipartBody(fields: Array<{
  name: string;
  value?: string;
  file?: {
    filename: string;
    contentType: string;
    body: Buffer | string;
  };
}>) {
  const boundary = `----yadraw-test-${Date.now()}`;
  const chunks: Buffer[] = [];

  for (const field of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (field.file) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${field.name}"; filename="${field.file.filename}"\r\n` +
            `Content-Type: ${field.file.contentType}\r\n\r\n`
        )
      );
      chunks.push(Buffer.isBuffer(field.file.body) ? field.file.body : Buffer.from(field.file.body));
      chunks.push(Buffer.from("\r\n"));
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value ?? ""}\r\n`
        )
      );
    }
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

async function createAttachmentServer(context: RequestContext = ownerContext) {
  const seed = createDefaultV2MemorySeed();
  const repository = createV2MemoryRepository(seed);
  const storage = createFakeStorage();
  const service = createV2BoardService(repository, {
    objectStorage: storage,
    storageBucket: "test-bucket"
  });
  const server = Fastify({
    bodyLimit: V2_MAX_ATTACHMENT_BYTES + 1024 * 1024
  });
  await server.register(multipart);
  server.addHook("preHandler", async (request) => {
    request.requestContext = context;
  });
  registerV2Routes(server, service);

  return {
    server,
    seed,
    repository,
    storage
  };
}

describe("v2 attachment API", () => {
  it("lists empty card attachments", async () => {
    const { server, seed } = await createAttachmentServer();
    const response = await server.inject({
      method: "GET",
      url: `/v2/cards/${seed.cards[0]!.id}/attachments`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await server.close();
  });

  it("uploads, lists, downloads, and detaches an attachment without changing card.data", async () => {
    const { server, seed, repository, storage } = await createAttachmentServer();
    const card = seed.cards[0]!;
    const dataBefore = await repository.getCard(card.id);
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "../manual.txt",
          contentType: "text/plain",
          body: "hello yadraw"
        }
      },
      { name: "role", value: "attachment" },
      { name: "metadata", value: "{\"source\":\"test\"}" }
    ]);

    const upload = await server.inject({
      method: "POST",
      url: `/v2/cards/${card.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });

    expect(upload.statusCode).toBe(201);
    const attachment = upload.json();
    expect(attachment).toMatchObject({
      cardId: card.id,
      role: "attachment",
      filename: "manual.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
      processingStatus: "processed"
    });
    expect(storage.objects.size).toBe(1);

    const list = await server.inject({
      method: "GET",
      url: `/v2/cards/${card.id}/attachments`
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([attachment]);
    await expect(repository.getBoardDetail(card.boardId)).resolves.toMatchObject({
      cardAttachmentCounts: { [card.id]: 1 }
    });

    const download = await server.inject({
      method: "GET",
      url: `/v2/files/${attachment.fileId}/download`
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toContain("text/plain");
    expect(download.headers["content-disposition"]).toContain("manual.txt");
    expect(download.body).toBe("hello yadraw");

    const detach = await server.inject({
      method: "DELETE",
      url: `/v2/cards/${card.id}/attachments/${attachment.id}`
    });
    expect(detach.statusCode).toBe(204);

    const listAfterDetach = await server.inject({
      method: "GET",
      url: `/v2/cards/${card.id}/attachments`
    });
    expect(listAfterDetach.json()).toEqual([]);
    await expect(repository.getBoardDetail(card.boardId)).resolves.toMatchObject({
      cardAttachmentCounts: { [card.id]: 0 }
    });

    const dataAfter = await repository.getCard(card.id);
    expect(dataAfter?.data).toEqual(dataBefore?.data);
    await expect(repository.getCard(card.id)).resolves.toMatchObject({ id: card.id });
    await server.close();
  });

  it("downloads files with non-ASCII filenames using safe Content-Disposition headers", async () => {
    const { server, seed } = await createAttachmentServer();
    const card = seed.cards[0]!;
    const fileBody = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "Рисунок1.png",
          contentType: "image/png",
          body: fileBody
        }
      }
    ]);

    const upload = await server.inject({
      method: "POST",
      url: `/v2/cards/${card.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });
    expect(upload.statusCode).toBe(201);
    const attachment = upload.json();

    const download = await server.inject({
      method: "GET",
      url: `/v2/files/${attachment.fileId}/download`
    });

    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toContain("image/png");
    expect(download.headers["content-disposition"]).toBe(
      "attachment; filename=\"download.png\"; filename*=UTF-8''%D0%A0%D0%B8%D1%81%D1%83%D0%BD%D0%BE%D0%BA1.png"
    );
    expect(download.rawPayload).toEqual(fileBody);
    await server.close();
  });

  it("rejects upload without file", async () => {
    const { server, seed } = await createAttachmentServer();
    const multipartBody = createMultipartBody([{ name: "role", value: "attachment" }]);

    const response = await server.inject({
      method: "POST",
      url: `/v2/cards/${seed.cards[0]!.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "invalid_payload" }
    });
    await server.close();
  });

  it("rejects oversized uploads", async () => {
    const { server, seed } = await createAttachmentServer();
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "large.bin",
          contentType: "application/octet-stream",
          body: Buffer.alloc(V2_MAX_ATTACHMENT_BYTES + 1)
        }
      }
    ]);

    const response = await server.inject({
      method: "POST",
      url: `/v2/cards/${seed.cards[0]!.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "invalid_payload" }
    });
    await server.close();
  });

  it("rejects invalid metadata JSON", async () => {
    const { server, seed } = await createAttachmentServer();
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "manual.txt",
          contentType: "text/plain",
          body: "hello"
        }
      },
      { name: "metadata", value: "{bad" }
    ]);

    const response = await server.inject({
      method: "POST",
      url: `/v2/cards/${seed.cards[0]!.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "invalid_payload" }
    });
    await server.close();
  });

  it("rejects download for users without workspace access", async () => {
    const owner = await createAttachmentServer(ownerContext);
    const card = owner.seed.cards[0]!;
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "manual.txt",
          contentType: "text/plain",
          body: "private"
        }
      }
    ]);
    const upload = await owner.server.inject({
      method: "POST",
      url: `/v2/cards/${card.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });
    const attachment = upload.json();

    const service = createV2BoardService(owner.repository, {
      objectStorage: owner.storage,
      storageBucket: "test-bucket"
    });
    const outsiderServer = Fastify({
      bodyLimit: V2_MAX_ATTACHMENT_BYTES + 1024 * 1024
    });
    await outsiderServer.register(multipart);
    outsiderServer.addHook("preHandler", async (request) => {
      request.requestContext = outsideContext;
    });
    registerV2Routes(outsiderServer, service);

    const response = await outsiderServer.inject({
      method: "GET",
      url: `/v2/files/${attachment.fileId}/download`
    });

    expect(response.statusCode).toBe(403);
    await outsiderServer.close();
    await owner.server.close();
  });

  it("uploads, lists, downloads, and detaches a connection attachment without changing cards or connection data", async () => {
    const { server, seed, repository, storage } = await createAttachmentServer();
    const connection = seed.connections[0]!;
    const sourceCard = seed.cards.find((card) => card.id === connection.sourceCardId)!;
    const targetCard = seed.cards.find((card) => card.id === connection.targetCardId)!;
    const sourceBefore = await repository.getCard(sourceCard.id);
    const targetBefore = await repository.getCard(targetCard.id);
    const connectionBefore = await repository.getConnection(connection.id);
    const fileBody = "connector file";
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "../connector.txt",
          contentType: "text/plain",
          body: fileBody
        }
      },
      { name: "role", value: "attachment" },
      { name: "metadata", value: "{\"scope\":\"connector\"}" }
    ]);

    const upload = await server.inject({
      method: "POST",
      url: `/v2/connections/${connection.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });

    expect(upload.statusCode).toBe(201);
    const attachment = upload.json();
    expect(attachment).toMatchObject({
      connectionId: connection.id,
      role: "attachment",
      metadata: { scope: "connector" },
      filename: "connector.txt",
      mimeType: "text/plain",
      sizeBytes: fileBody.length,
      sha256: sha256Hex(fileBody),
      processingStatus: "processed"
    });
    expect([...storage.objects.keys()][0]).toContain(`/connections/${connection.id}/`);

    const list = await server.inject({
      method: "GET",
      url: `/v2/connections/${connection.id}/attachments`
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([attachment]);

    const download = await server.inject({
      method: "GET",
      url: `/v2/files/${attachment.fileId}/download`
    });
    expect(download.statusCode).toBe(200);
    expect(download.body).toBe(fileBody);
    expect(sha256Hex(download.body)).toBe(sha256Hex(fileBody));

    await expect(repository.listCardAttachments?.(sourceCard.id)).resolves.toEqual([]);
    await expect(repository.listCardAttachments?.(targetCard.id)).resolves.toEqual([]);
    await expect(repository.getCard(sourceCard.id)).resolves.toMatchObject({
      data: sourceBefore?.data
    });
    await expect(repository.getCard(targetCard.id)).resolves.toMatchObject({
      data: targetBefore?.data
    });
    await expect(repository.getConnection(connection.id)).resolves.toMatchObject({
      data: connectionBefore?.data
    });

    const detach = await server.inject({
      method: "DELETE",
      url: `/v2/connections/${connection.id}/attachments/${attachment.id}`
    });
    expect(detach.statusCode).toBe(204);

    const listAfterDetach = await server.inject({
      method: "GET",
      url: `/v2/connections/${connection.id}/attachments`
    });
    expect(listAfterDetach.statusCode).toBe(200);
    expect(listAfterDetach.json()).toEqual([]);

    const downloadAfterDetach = await server.inject({
      method: "GET",
      url: `/v2/files/${attachment.fileId}/download`
    });
    expect(downloadAfterDetach.statusCode).toBe(200);
    expect(downloadAfterDetach.body).toBe(fileBody);
    await server.close();
  });

  it("rejects connection attachment access for users without workspace access", async () => {
    const owner = await createAttachmentServer(ownerContext);
    const connection = owner.seed.connections[0]!;
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "connector.txt",
          contentType: "text/plain",
          body: "private connector file"
        }
      }
    ]);
    const upload = await owner.server.inject({
      method: "POST",
      url: `/v2/connections/${connection.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });
    const attachment = upload.json();

    const service = createV2BoardService(owner.repository, {
      objectStorage: owner.storage,
      storageBucket: "test-bucket"
    });
    const outsiderServer = Fastify({
      bodyLimit: V2_MAX_ATTACHMENT_BYTES + 1024 * 1024
    });
    await outsiderServer.register(multipart);
    outsiderServer.addHook("preHandler", async (request) => {
      request.requestContext = outsideContext;
    });
    registerV2Routes(outsiderServer, service);

    const list = await outsiderServer.inject({
      method: "GET",
      url: `/v2/connections/${connection.id}/attachments`
    });
    expect(list.statusCode).toBe(403);

    const uploadDenied = await outsiderServer.inject({
      method: "POST",
      url: `/v2/connections/${connection.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });
    expect(uploadDenied.statusCode).toBe(403);

    const downloadDenied = await outsiderServer.inject({
      method: "GET",
      url: `/v2/files/${attachment.fileId}/download`
    });
    expect(downloadDenied.statusCode).toBe(403);

    const detachDenied = await outsiderServer.inject({
      method: "DELETE",
      url: `/v2/connections/${connection.id}/attachments/${attachment.id}`
    });
    expect(detachDenied.statusCode).toBe(403);

    await outsiderServer.close();
    await owner.server.close();
  });

  it("returns 503 for connection upload when storage is not configured", async () => {
    const seed = createDefaultV2MemorySeed();
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const server = Fastify({
      bodyLimit: V2_MAX_ATTACHMENT_BYTES + 1024 * 1024
    });
    await server.register(multipart);
    server.addHook("preHandler", async (request) => {
      request.requestContext = ownerContext;
    });
    registerV2Routes(server, service);
    const multipartBody = createMultipartBody([
      {
        name: "file",
        file: {
          filename: "connector.txt",
          contentType: "text/plain",
          body: "storage missing"
        }
      }
    ]);

    const response = await server.inject({
      method: "POST",
      url: `/v2/connections/${seed.connections[0]!.id}/attachments`,
      headers: { "content-type": multipartBody.contentType },
      payload: multipartBody.body
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: "service_unavailable" }
    });
    await server.close();
  });
});
