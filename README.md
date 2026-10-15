# GEE TASKS

Gee Graphics production tracker with localStorage for offline work and an optional Google Sheets database. Orders, tasks, notes, labels, activity and settings survive browser reloads. Existing records in the former IndexedDB database migrate on first open; the original database is retained.

## Run

Requires Node.js 22.x and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. npm install / npm run dev also work. The Vite runner configuration loader avoids Windows parent-directory access errors. The initial workspace contains the supplied production names, with no invented prices, quantities or deadlines. Starter IDs are stable across devices so a new browser does not duplicate starter records during sync.

## Teams, photos and print assets

- **All Teams & Photos** is the complete team register, including finished, cancelled and archived orders. Register a team using the same order form as All Orders.
- Each team's order keeps its own designs, photos and task links. Two orders for the same team keep separate assets and references.
- Open **Manage team assets** to upload a **Design mockup** or **Team photo**, including photos collected after production. Images get visible previews and downloads.
- Tasks support the same attachments during creation and in **Details**, including completed or archived tasks linked from the register.
- Choose **Ready to print**, paste the Google Drive sharing URL and attach it. This keeps original print-quality files in Drive. The app never treats compressed previews as original print assets.
- Uploaded images accept PNG/JPEG/WEBP up to 15 MB and become small JPEG previews up to 900 px / 100,000 data-URL characters. LocalStorage has finite browser quota. Failed saves preserve existing records; export backups regularly. Use Drive links for originals and larger collections.

## Connect the Google Sheets database

The running app needs a Google OAuth Web client ID. The account used in the app must have edit access to the selected Sheet. ChatGPT's connected Google account does not automatically authorize this separate web app.

1. In a Google Cloud project, enable **Google Sheets API** and **Google Drive API**.
2. Configure Google Auth Platform / OAuth consent. For an app in testing, add the accounts that will use it as test users.
3. Create an OAuth **Web application** client. Add the app's exact JavaScript origins, e.g. `http://localhost:3000`, `http://127.0.0.1:3000`, and your deployed HTTPS origin. No client secret belongs in this app.
4. Open **Settings → Google Sheets**. Paste the public client ID and an editable Sheet's URL/ID, or leave the Sheet blank to create a new one. Click **Save Google settings**, then **Connect Google**, and allow Sheets and Drive access.
5. If necessary, click **Create new Google Sheet**, then **Sync now**.

Optional default configuration is in `.env.example`: `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_SHEET_ID`. The settings form can override these. After saving default values in the form, connect Google normally.

Google documents [OAuth client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), the [browser token flow](https://developers.google.com/identity/oauth2/web/guides/use-token-model), and [Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

### Record behavior

- **Sync now** reads remote records, merges local and remote changes by stable ID and most recent timestamp, then saves the merged database to Google Sheets and this browser.
- **Load records from Google** reads and merges remote records without publishing local work. Newer local records remain pending until a full sync.
- The canonical database is **GEE Records**, with one typed JSON record per row. **GEE Teams**, **GEE Orders**, **GEE Tasks**, **GEE Assets** and **GEE Notes** are readable tracking views generated from that database. Edit business records in the app; editing the tracking views does not edit the canonical database. Other Sheet tabs are kept.
- Deletion markers prevent older devices from resurrecting deleted orders, tasks, notes or labels. Archives retain their records and media.
- Optional automatic sync runs after edits or network reconnection while the app is open and Google authorization remains valid. After reloading or session expiration, click **Connect Google** again. Access tokens remain in memory and are excluded from browser backups and Sheets.
- Photos, mockup previews and legacy PDF attachments upload to private Google Drive files. Sheets stores their links; no image base64 goes into Sheet cells. On another device, connect Google to preview synced images if that account has Drive access. Drive sharing permissions remain under your control.
- Failed/offline sync leaves local work saved and displays an error with a retry path. A record above Google's cell-size limit is rejected clearly instead of being truncated.
- **Sync devices one at a time.** The browser merge uses device timestamps and an atomic Sheets batch, not a server transaction across concurrent browsers. Simultaneous syncs can overwrite a newer sheet snapshot; local changes remain available to sync again. Keep device clocks accurate. This is suitable for a small shop's tracking workflow, not high-concurrency database workloads.

## Backup and recovery

**Settings → Data & backup → Export full JSON** downloads local records and image previews. Import merges records and skips existing matches. CSV is a readable order export, not a complete media backup. Local data belongs to this browser/origin; clearing site data removes the local copy. Google data exists only after a completed sync.

Legacy migration writes the complete workspace atomically. If quota or permissions prevent migration, the original database stays intact and startup displays recovery guidance. Do not clear site data to resolve such an error.

## Verification

```sh
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

For an installed Chrome instead of downloaded Chromium, set `PLAYWRIGHT_CHANNEL=chrome` before the E2E command. Tests cover local persistence/migration/quota rollback, media/Drive link validation, team and task flows, responsive layouts, Google success/failure/retry and remote record/deletion loading. Google browser tests use mocked OAuth and Google HTTP endpoints; they do not prove live credentials or Google consent configuration.

## Deploy

Import `katto-1204/ordersgee` in Vercel with the repository root as the Root Directory and `main` as the production branch. The committed `vercel.json` selects Vite, installs with `npx --yes pnpm@11.25.0 install --frozen-lockfile`, builds with `npm run build`, serves `dist`, and rewrites SPA deep links to `/index.html`. `package.json` selects Node.js 22.x. No manual build overrides are required.

Google setup is optional for launching the localStorage app. For shared records, add `VITE_GOOGLE_CLIENT_ID` and optionally `VITE_GOOGLE_SHEET_ID` in Vercel's environment variables before building, or configure them in app Settings. Add the final deployed HTTPS origin to the Google OAuth client's authorized JavaScript origins, then connect Google in the app. Environment files and `.vercel` account metadata are ignored by Git. Localhost localStorage does not transfer to a new Vercel origin: export/import JSON or load previously synced Google records when moving devices/origins.

HTTPS enables PWA install; offline launch requires the app shell to have been cached. This repository preparation does not create a live Vercel deployment. See the official [Vite SPA deployment guide](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas) and [Vercel package manager guide](https://vercel.com/docs/package-managers).
