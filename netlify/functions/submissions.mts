import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "safety-inspections";
const MAX_LIST = 500;

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
    if (!body || !body.formId || !body.employeeName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 8);
    const record = { ...body, submittedAt: new Date().toISOString() };
    await store.setJSON(id, record);
    return new Response(JSON.stringify({ id, ...record }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const formId = url.searchParams.get("formId");

    const { blobs } = await store.list();
    const sortedKeys = blobs.map((b) => b.key).sort().reverse().slice(0, MAX_LIST);

    const items = await Promise.all(
      sortedKeys.map(async (key) => {
        const data = await store.get(key, { type: "json" });
        return data ? { id: key, ...data } : null;
      })
    );

    let results = items.filter(Boolean);
    if (formId) results = results.filter((i: any) => i.formId === formId);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/submissions"
};
