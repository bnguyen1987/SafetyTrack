import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "safety-contacts";
const SETTINGS_PASSWORD = "727StWorth!";

const DEFAULTS: Record<string, any> = {
  Ontario: {
    location: "Ontario",
    shifts: [
      { id: "shift1", name: "1st Shift", start: "06:00", end: "14:30", days: [1, 2, 3, 4, 5] },
      { id: "shift2", name: "2nd Shift", start: "14:30", end: "23:00", days: [1, 2, 3, 4, 5] }
    ],
    supervisors: [
      { name: "Tony Sanchez", shiftId: "shift1", cell: "" },
      { name: "Conrado Sotelo", shiftId: "shift1", cell: "" },
      { name: "Miguel Villalvazo", shiftId: "shift2", cell: "" }
    ],
    otherContacts: [
      { name: "Brian Nguyen", roleEn: "Plant Manager", roleEs: "Gerente de Planta", cell: "", afterHours: true },
      { name: "Israel Sanchez", roleEn: "Production / Scheduling", roleEs: "Producción / Programación", cell: "", afterHours: false },
      { name: "Jess Goodrich", roleEn: "Maintenance Manager", roleEs: "Gerente de Mantenimiento", cell: "", afterHours: false },
      { name: "Ramon Flores", roleEn: "Shipping Manager", roleEs: "Gerente de Envíos", cell: "", afterHours: false }
    ]
  }
};

function defaultFor(loc: string) {
  return DEFAULTS[loc] || { location: loc, shifts: [], supervisors: [], otherContacts: [] };
}

export default async (req: Request, context: Context) => {
  const store = getStore(STORE_NAME);
  const url = new URL(req.url);
  const loc = url.searchParams.get("loc") || "Ontario";

  if (req.method === "GET") {
    const data = await store.get(loc, { type: "json" });
    return new Response(JSON.stringify(data || defaultFor(loc)), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  if (req.method === "PUT") {
    const requester = (url.searchParams.get("requester") || "").trim().toLowerCase();
    const password = url.searchParams.get("password") || "";
    if (requester !== "brian nguyen" || password !== SETTINGS_PASSWORD) {
      return new Response(JSON.stringify({ error: "Not authorized to save" }), {
        status: 403,
        headers: { "content-type": "application/json" }
      });
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    const record = { ...body, location: loc, updatedAt: new Date().toISOString() };
    await store.setJSON(loc, record);
    return new Response(JSON.stringify(record), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/contacts"
};
