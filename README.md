# SafetyTrack

Digital safety inspection checklists for GoldenWest Packaging Group (GWPG).
Employees pick a checklist, fill it out, and submit — no login beyond typing
their name. Submissions are stored via Netlify Blobs and browsable in the
in-app History tab (search, filter, print, CSV export).

## Stack

- Static single-page frontend: `public/index.html` (vanilla JS, no build step)
- Backend API: `netlify/functions/submissions.mts` (Netlify serverless function)
- Storage: Netlify Blobs (store name `safety-inspections`) — no external
  database or API keys needed; provisioned automatically by Netlify.

## Deploying

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project** and connect
   this repo. Netlify auto-detects `netlify.toml` (publish dir `public`,
   functions dir `netlify/functions`) — no build command needed.
3. Deploy. That's it — Netlify Blobs requires no configuration or API keys.

Every push to the connected branch auto-deploys (continuous deployment),
same as the tooling tracker.

## Local development

```bash
npm install
netlify dev
```

This runs the static site and the `/api/submissions` function together with
a local sandboxed Blobs store.

## Forms covered

20 checklists across 3 templates, defined in the `FORMS` data table at the
top of `public/index.html`:

- **Area Inspections** (7): Design, Maintenance, Office, Receiving, Shipping,
  Yard, Corrugated Warehouse — OK / Needs Attention / N/A grid, corrective
  action log, overall result.
- **Equipment Checks** (2): Ladder (adapts to Stepladder/Extension/Fixed),
  Daily Forklift.
- **Monthly Machine Safety Acknowledgments** (11): one per production
  machine — safety points + typed signature.

To add or edit a checklist, edit the `FORMS` array — the three render
templates (`zone`, `equipment`/`ladder`, `machine`) are generic and pick up
data-driven changes automatically.

## Notes & photos

Every checklist item (not just ones marked "Needs Attention") has a "🗨 Add
note" toggle and a "📷 Add photo" button — up to 3 photos per item. Photos
are compressed client-side (max 1280px wide, JPEG ~72% quality) before
upload, then stored via `netlify/functions/photos.mts` in a separate Netlify
Blobs store (`safety-inspection-photos`), keyed by a generated id. The
History detail view fetches them back at `/api/photos/{key}`.

## Supervisor contact page (NFC stickers / QR codes)

`public/contact.html` is a standalone, public page — no login, not part of
the main app's single-page shell — meant to be opened by tapping an NFC
sticker or scanning a QR code posted on the plant floor. Address:
`/contact.html?loc=Ontario` (or any other configured location).

- Shows the supervisor(s) on shift right now (based on the current day/time
  against each shift's configured days and hours) with one-tap Call and Text
  buttons, falls back to the after-hours contact when no shift is running,
  and always shows a 911 button.
- Bilingual (EN/ES toggle), and caches the last-loaded contact list to
  `localStorage` so it still shows numbers with no signal.
- Backed by `netlify/functions/contacts.mts` — `GET /api/contacts?loc=X`
  reads a location's contact list, `PUT` saves it (stored via Netlify Blobs,
  store name `safety-contacts`); saving requires `requester=Brian Nguyen`
  (same name-based trust model as deleting submissions below).

Shift times, supervisors, and other contacts (name, role, cell, email, after-hours
flag) are all edited from the in-app **Settings** tab, visible only when
logged in as "Brian Nguyen". Settings also shows the sticker link (with
Copy/Open buttons and a QR code) and a "Print Labels" button that prints six
bilingual "Tap or scan for your supervisor" labels to cut out and post next
to each sticker.

## Known v1 limitations

- No real login/roles — anyone can submit under any typed name; the handful
  of admin actions (deleting a submission, editing Settings) are gated only
  by typing the exact name "Brian Nguyen", enforced both client- and
  server-side but not a substitute for real authentication.
- The monthly re-acknowledgment tracking grid from the original paper forms
  isn't automated; the home screen flags Monthly Machine Safety Checklists
  and the Fire Extinguisher Inspection as overdue after 30 days with no new
  submission, but there's no automated reminder/notification beyond that.
