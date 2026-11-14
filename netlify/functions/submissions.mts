import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { pushFlaggedItemsToRepairTrack } from "./lib/repairtrack.mts";

const STORE_NAME = "safety-inspections";
const MAX_LIST = 500;   // legacy full-list response only
const MAX_BATCH = 60;   // records per ?ids= request

const JSON_NO_STORE = { "content-type": "application/json", "cache-control": "no-store" };

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

    try {
      await pushFlaggedItemsToRepairTrack(record);
    } catch (e) {
      console.error("RepairTrack push failed (non-fatal)", e);
    }

    return new Response(JSON.stringify({ id, ...record }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const formId = url.searchParams.get("formId");

    // Incremental sync, step 1: just the ids of every submission (one cheap list call).
    // The app compares these with what it already has cached on the device.
    if (url.searchParams.has("keys")) {
      const { blobs } = await store.list();
      const keys = blobs.map((b) => b.key).sort().reverse();
      return new Response(JSON.stringify({ keys }), { status: 200, headers: JSON_NO_STORE });
    }

    // Incremental sync, step 2: only the records the device is missing, in small batches.
    const idsParam = url.searchParams.get("ids");
    if (idsParam !== null) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_BATCH);
      const batch = await Promise.all(
        ids.map(async (key) => {
          const data = await store.get(key, { type: "json" });
          return data ? { id: key, ...data } : null;
        })
      );
      return new Response(JSON.stringify(batch.filter(Boolean)), { status: 200, headers: JSON_NO_STORE });
    }

    // Legacy: newest MAX_LIST submissions in one response (kept for any older cached copy of the app).
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

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const requester = (url.searchParams.get("requester") || "").trim().toLowerCase();

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    // Server-side mirror of the client-side restriction — same trust model as
    // the rest of this app (typed names, no real auth), but it stops a stray
    // or scripted call from deleting records outside the UI's own guardrail.
    if (requester !== "brian nguyen") {
      return new Response(JSON.stringify({ error: "Not authorized to delete" }), {
        status: 403,
        headers: { "content-type": "application/json" }
      });
    }

    await store.delete(id);
    return new Response(JSON.stringify({ deleted: id }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/submissions"
};
