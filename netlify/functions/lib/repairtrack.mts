import { getStore } from "@netlify/blobs";

// Same public web config already used by RepairTrack's own client — not a secret,
// it's already present in RepairTrack's deployed source. Anonymous auth (matching
// how RepairTrack's own UI writes issues) is used to get a token for the REST call.
const RT_API_KEY = "AIzaSyAAE-Qyk1WCHG8oujpprQnPX1AyZb_C4H0";
const RT_DB_URL = "https://repairtrack-c251c-default-rtdb.firebaseio.com";

// Maps a SafetyTrack formId to the RepairTrack machine *name* its flagged items
// should file under. "Facility / General" covers forms that don't correspond to
// one specific machine (confirmed with Brian).
const FORM_MACHINE_NAME: Record<string, string> = {
  "corrugated-warehouse": "Warehouse",
  "office": "Office",
  "yard": "Yard",
  "fire-extinguisher": "Facility / General",
  "design": "Facility / General",
  "maintenance": "Facility / General",
  "receiving": "Facility / General",
  "shipping": "Facility / General",
  "ladder": "Facility / General",
  "report-issue": "Facility / General"
};

// RepairTrack machine ids for every name this integration can target.
const MACHINE_NAME_TO_ID: Record<string, string> = {
  "Warehouse": "M-015",
  "Office": "M-032",
  "Yard": "M-026",
  "Forklift 7": "M-009",
  "Forklift 10": "M-018",
  "Forklift 12": "M-019",
  "Forklift 13": "M-020",
  "Forklift 14": "M-021",
  "Forklift 15": "M-022",
  "Facility / General": "M-033"
};

function resolveMachineName(submission: any): string | null {
  const formId = submission.formId;
  if (formId === "daily-forklift") {
    const unitRaw = submission.data?.header?.unitNo || "";
    const match = String(unitRaw).match(/\d+/);
    const name = match ? `Forklift ${match[0]}` : null;
    return name && MACHINE_NAME_TO_ID[name] ? name : "Facility / General";
  }
  // null = this form type never pushes to RepairTrack (e.g. machine/orientation acknowledgments)
  return FORM_MACHINE_NAME[formId] || null;
}

async function getAnonymousIdToken(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${RT_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true })
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.idToken || null;
  } catch {
    return null;
  }
}

async function photosToDataUrls(photos: { key: string }[] | undefined): Promise<string[]> {
  if (!photos || photos.length === 0) return [];
  const store = getStore("safety-inspection-photos");
  const out: string[] = [];
  for (const p of photos.slice(0, 3)) {
    try {
      const result = await store.getWithMetadata(p.key, { type: "arrayBuffer" });
      if (!result) continue;
      const contentType = (result.metadata as any)?.contentType || "image/jpeg";
      const base64 = Buffer.from(result.data as ArrayBuffer).toString("base64");
      out.push(`data:${contentType};base64,${base64}`);
    } catch {
      // skip this one photo, keep going
    }
  }
  return out;
}

function priorityFor(overallResult: string | undefined): string {
  if (overallResult === "CorrectiveActionRequired" || overallResult === "ReInspectionRequired") return "high";
  return "medium";
}

/**
 * Best-effort push of a SafetyTrack submission's flagged items into RepairTrack
 * as individual issues. Never throws — a RepairTrack outage or mapping gap must
 * never break the underlying SafetyTrack save.
 */
export async function pushFlaggedItemsToRepairTrack(submission: any): Promise<number> {
  try {
    const machineName = resolveMachineName(submission);
    if (!machineName) return 0;
    const machineId = MACHINE_NAME_TO_ID[machineName];
    if (!machineId) return 0;

    const idToken = await getAnonymousIdToken();
    if (!idToken) return 0;

    const location = submission.location || "Ontario";
    const reporter = submission.employeeName || "SafetyTrack";
    const data = submission.data || {};
    const issues: any[] = [];

    if (submission.template === "report") {
      const photos = await photosToDataUrls(data.photos);
      issues.push({
        machineId,
        location,
        description: `[SafetyTrack hazard report${data.area ? " — " + data.area : ""}] ${data.description || ""}`.trim(),
        originalText: null,
        priority: "medium",
        reporter,
        timestamp: Date.now(),
        resolved: false,
        updates: [],
        photos: photos.length ? photos : null
      });
    } else if (data.items) {
      const priority = priorityFor(data.overallResult);
      for (const [key, rec] of Object.entries<any>(data.items)) {
        if (!rec || rec.status !== "ATTN") continue;
        const itemLabel = key.split("||")[1] || key;
        const photos = await photosToDataUrls(rec.photos);
        issues.push({
          machineId,
          location,
          description: `[SafetyTrack: ${submission.formTitle}] ${itemLabel}${rec.comment ? " — " + rec.comment : ""}`,
          originalText: null,
          priority,
          reporter,
          timestamp: Date.now(),
          resolved: false,
          updates: [],
          photos: photos.length ? photos : null
        });
      }
    }

    let pushed = 0;
    for (const issue of issues) {
      try {
        const res = await fetch(`${RT_DB_URL}/issues.json?auth=${idToken}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(issue)
        });
        if (res.ok) pushed++;
      } catch {
        // best-effort; keep trying remaining issues
      }
    }
    return pushed;
  } catch (e) {
    console.error("pushFlaggedItemsToRepairTrack failed", e);
    return 0;
  }
}
