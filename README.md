# LIFTDECK

A personal workout-tracking PWA: StrongLifts-style progression for a dumbbell/cable home gym, one-tap class attendance, and a calendar that keeps you honest. 1980s terminal aesthetic. All data lives on your device.

Ships with a default hybrid program (**PROGRAM 01**: boxing attendance Mon/Wed/Sat/Sun, Strength A Tue, Strength B Thu, optional accessory work Fri), fully editable under PLAN.

## Stack

- React 18 + TypeScript + Vite
- IndexedDB (via `idb`) for all persistence, with schema versioning
- `vite-plugin-pwa` service worker: fully offline after first load
- No server, no accounts, no external services. Charts are hand-rolled SVG.

## Run locally

```
npm install
npm run dev
```

Open the printed URL. `npm run dev -- --host` exposes it on your LAN so you can try it from your phone before deploying.

## Tests

```
npm test        # unit tests: progression, adherence, backup/CSV (vitest)
npm run e2e     # end-to-end flows in Chromium (playwright; run `npx playwright install chromium` once)
```

The e2e suite covers the full loop: onboarding → workout → rep logging → rest timer → completion → progression suggestion, plus boxing, body weight, persistence across reloads, and backup export/wipe/import.

## Build + deploy

```
npm run build   # outputs dist/ (regenerates icons, typechecks, bundles, builds the service worker)
```

`dist/` is plain static files. Deploy it to any static host:

- **Netlify / Vercel / Cloudflare Pages**: point at the repo, build command `npm run build`, output `dist`. Done.
- **GitHub Pages** (served under `/repo-name/`): build with `BASE_PATH=/repo-name/ npm run build`, then publish `dist/`.
- Any dumb file server over **HTTPS** works. HTTPS is required for the service worker (localhost is exempt).

## Install on iPhone

1. Open the deployed URL in Safari.
2. Share button → **Add to Home Screen**.
3. Launch from the icon: it runs standalone, fullscreen, offline.

Because storage is per-origin, install from the URL you plan to keep. iOS can evict storage for sites you never visit; a Home Screen app you open regularly is safe, but export a backup now and then (Settings → EXPORT BACKUP). Restore it anytime with IMPORT BACKUP, including on a new phone.

## Where things live

- `src/lib/progression.ts` — the progression rule: all prescribed sets at the top of the rep range → +increment next time; otherwise keep the weight. Suggestions derive from what you actually lifted last session, so manual overrides and history edits are respected automatically.
- `src/lib/adherence.ts` — calendar day status, weekly/monthly stats, streak. Optional sessions never count against you.
- `src/data/seedPlan.ts` / `src/data/exercises.ts` — the default plan and the ~95-exercise library.
- `src/store/store.ts` — in-memory state with write-through persistence to IndexedDB; every logged set is saved immediately.
- Session records are snapshots: editing a template later never rewrites history.

## Resetting to a clean state

Settings → DANGER ZONE → RESET ALL DATA (type `RESET` to confirm). This wipes everything and reseeds the default plan.
