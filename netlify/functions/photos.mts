import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "safety-inspection-photos";

export default async (req: Request, context: Context) => {
  const store = getStore(STORE_NAME);

  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    const match = /^data:([^;]+);base64,(.+)$/.exec(body?.imageBase64 || "");
    if (!match) {
      return new Response(JSON.stringify({ error: "imageBase64 must be a data: URL" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");

    if (buffer.byteLength > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Image too large (max 8MB)" }), {
        status: 413,
        headers: { "content-type": "application/json" }
      });
    }

    const key =
      new Date().toISOString().replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 8);

    await store.set(key, buffer, { metadata: { contentType } });

    return new Response(JSON.stringify({ key }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  }

  if (req.method === "GET") {
    const key = context.params.key;
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing photo key" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) {
      return new Response("Not found", { status: 404 });
    }
    const contentType = (result.metadata as any)?.contentType || "application/octet-stream";
    return new Response(result.data, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/photos", "/api/photos/:key"]
};
