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

## Known v1 limitations

- No login/roles — anyone can submit under any typed name.
- The monthly re-acknowledgment tracking grid from the original paper forms
  isn't automated; submissions just log a date, so overdue sign-offs need to
  be checked manually in History.
- No delete/edit of submitted records from the UI yet.
