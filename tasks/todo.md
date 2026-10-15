# Local storage, teams and Google Sheets

## Scope

Replace Supabase completely with browser localStorage. Preserve existing production, order, task, notes and settings flows and migrate existing IndexedDB records without deleting the source. Keep every customer/team record discoverable after completion. Associate team photos, design mockups and print-ready Google Drive links with their specific order/task. Implement an authenticated Google Sheets database with bidirectional record sync, clear connection, failure and retry states; local saves must continue offline.

## Plan

- [x] Inspect persistence, routes, attachments, backup/import and existing tests.
- [x] Replace persistence with atomic localStorage writes and legacy migration; verify quota and rollback behavior.
- [x] Remove Supabase client, dependencies, configuration, migration and obsolete documentation.
- [x] Add all-team records, post-production photos, task/order mockup previews and validated print-ready Drive links.
- [x] Add Google authorization, sheet selection/creation and repeatable sync of all records plus Drive-backed media.
- [x] Verify build, unit tests and Playwright flows on desktop/mobile, including reload, offline, attachment isolation, Sheets failures/retry and browser diagnostics.
- [x] Document setup and verified results; distinguish mocked integration from live Google verification.

## Verification plan

Run the existing unit/E2E suites and focused new checks for localStorage persistence/migration/rollback, team and task assets, finished/archived teams and Google API sync behavior. Inspect browser screenshots at desktop/mobile sizes and inspect console errors/failed requests. Live Google testing depends on a configured OAuth client and consent; report this explicitly if unavailable.

## Review

- Local database: one localStorage workspace key, atomic writes, cross-tab Web Locks where supported, quota rollback, safe native IndexedDB migration, retained legacy source, timestamps and deletion tombstones. All existing transaction callers use the scoped transaction database.
- Teams/assets: complete register includes finished/cancelled/archive records; each order retains its own photos/designs and linked tasks. Task create/detail support compressed uploads, full previews/downloads and original print-ready Drive links. Synced private Drive previews use authenticated temporary blob URLs, revoked on disconnect/unmount.
- Google database: OAuth public client ID + account consent, selectable/new Sheet, bidirectional stable-ID/timestamp merge, deletion tracking, duplicate-label consolidation, readable tracking tabs, private media upload, foreground automatic sync and explicit retry. No access token is persisted. Shared shop settings have their own timestamps so a theme/connection change cannot overwrite newer remote shop details.
- Browser checks found and fixed the existing global-load unmount bug (notes editor disappearing on save) and mobile CSS hiding task Details. Note images now use bounded previews under localStorage; remote note links remain usable.
- `npm test`: 48 tests passed across 6 files, including quota rollback, migration protection, time-zone-aware merging, deduplication, in-flight edits/retry, Drive validation and preview cleanup.
- `npm run build`: passed TypeScript and production/PWA build. Rollup removes two unsupported pure annotations in dependency comments; the build completes successfully.
- Final production Playwright run: **20/20 passed in 52.3 seconds** with `node --env-file=.env.playwright.local node_modules/@playwright/test/cli.js test`, using installed Chrome across desktop and Pixel 7 viewports against production preview on port 3000. All runtime/console warnings/errors and failed-request checks passed; the intentionally mocked Google 403 is recorded separately and its retry succeeds. Verified task upload/link validation/removal/reload, isolated finished/archive team images, actual legacy migration retaining source data, notes with compressed image persistence, production-stage approval/override/reload, offline saves, Google media upload/download, remote merge/deletion and token non-persistence.
- Visually inspected desktop and mobile team register screenshots and the production sidebar screenshot (`tasks/sidebar-production.png`). The incomplete desktop sidebar seen during development was a hot-refresh artifact; the production sidebar has correct width, visible icons and full active navigation styling.
- Setup, architecture, concurrency/storage limits and deployment instructions are in README.md. The original pnpm toolchain/lockfile is retained and regenerated without removed dependencies.

## External setup still required

- [ ] Configure/provide a real Google OAuth Web client ID and authorized app origin, connect the intended Google account, and select/create its Sheet in Settings. No client ID or target Sheet was supplied in this session. Google tests use mocked identity/API responses; no live Google sync or deployment is claimed.

## Dashboard guide layout correction

- [x] Reproduce the unstyled first-run guide in Playwright.
- [x] Add scoped styles for the dashboard guide, Guide button and full Guide dialog; preserve instructions and actions.
- [x] Verify desktop/mobile layout, hide persistence, reopen/navigation and browser diagnostics, then run the existing suite and build.
- [x] Review screenshots and record results.

Correction review: the GettingStarted components had no matching stylesheet, including the header Guide button. Reproduced against the production app (card border radius was 0px and content ran together). Added a component stylesheet with responsive numbered cards, separate headings/descriptions, inline actions, readable dialog steps and nonoverlapping dialog footer. Updated stale demo backup copy. Added Playwright checks for layout geometry, no horizontal overflow, persistent dismissal, reopening and production navigation. The complete suite passed 22/22 in 35 seconds; after the final dialog-footer adjustment, the two focused desktop/mobile guide tests passed again. Production build passed. Reviewed dashboard and mobile dialog screenshots, including `tasks/dashboard-guide-fixed.png`. Lesson captured in tasks/lessons.md.

## Vercel preparation and requested GitHub publication

- [x] Verify the exact workspace and requested remote; initialize a standalone project repository.
- [x] Configure Vite, pinned pnpm install, production build/output, Node 22.x and SPA deep-link fallback for Vercel; document Google configuration and origin-specific data migration.
- [x] Verify frozen lockfile compatibility, tests and production build; check publication excludes for generated files and environment data.
- [x] Commit as `first commit`, set `main`, add the supplied origin and push without rewriting remote history.
- [x] Verify the remote branch matches the local commit and record handoff results.

Publication preparation: the pinned pnpm 11.25.0 accepted `install --lockfile-only --frozen-lockfile --ignore-scripts`; all 48 unit tests passed and the TypeScript/Vite/PWA production build passed. Local checks ran under Node 24.13.0; Vercel is pinned to Node 22.x. No secrets or private keys were found by the targeted filename-only source scan. The environment files, dependency directory, build output and Vercel account metadata are excluded. Staged-file review and commit/push verification follow below. A live Vercel deployment itself is not claimed.

Publication result: reviewed all 85 staged project files and `git diff --cached --check` passed. Created initial commit `4f01a40` (`first commit`), renamed the branch to `main`, and configured `origin` exactly as `https://github.com/katto-1204/ordersgee.git`. A normal push created `main` and set its upstream to `origin/main`. A remote `ls-remote` check returned the same full initial commit hash as local HEAD, and the working tree was clean. This documentation update records the successful handoff without changing application code. Import the repository in Vercel to create the actual deployment; Google authorization still requires the configured client/account and deployed origin.
