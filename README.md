# LIFTDECK

A personal training PWA for a boxer who lifts. Boxing is the sport; two short full-body strength sessions keep strength and muscle while cutting. Weeks are judged on totals, never on which weekday something happened. 1980s terminal aesthetic. All data lives on your device.

Ships with **BOXER CUT // FLEX**: boxing minimum 2 / target 4 per week, strength minimum 1 / target 2 per week as an A ↔ B full-body rotation, plus an optional upper + abs session that never affects adherence. The legacy fixed-weekday plan (**PROGRAM 01**) still works for anyone who has one.

## Stack

- React 18 + TypeScript + Vite
- IndexedDB (via `idb`) for all persistence, with an app-level schema version (currently 2)
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
npm test        # unit tests (vitest): progression, flex adherence, recommendation engine, body trends, boxing, strength trends, plan bundles, backup/migration, store
npm run e2e     # end-to-end flows in Chromium (playwright; run `npx playwright install chromium` once)
```

The e2e suite covers onboarding → workout → rep logging → rest timer → RIR prompt → completion → progression suggestion, boxing one-tap + details, body weight/waist trends, persistence across reloads, backup export/wipe/import, in-place migration of a v1 install, plan import/export, and offline use.

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

## How the program logic works

**Flex plans** (`mode: 'flex'`) have weekly goals instead of a weekday schedule. Each week (Mon–Sun) is a FOUNDATION week when every non-optional goal hits its minimum, and a TARGET week when every one hits its target. There is no "missed Wednesday". The A/B rotation is driven by the most recently completed A or B session and never resets on Monday.

**Recommendation engine** (`src/lib/recommend.ts`) is a fixed rule list, in order: strength floor (0 this week and ≥36h since the last lift) → boxing below minimum → second strength exposure (rested) → boxing toward target → optional session (only once A+B are done, boxing is at its minimum, and no hard boxing in the last 24h) → recovery. Boxing is always available; nothing is ever blocked. Under 36h since a lift, or hard boxing (RPE ≥ 8 or ≥30 min sparring) in the last 24h, shows a note.

**Double progression** (`src/lib/progression.ts`): only the prescribed sets count. Every prescribed set at repMax → INCREASE by the slot's increment. Otherwise HOLD (not a failure). REDUCE is suggested only after two consecutive complete exposures at the same load with a prescribed set below repMin; an incomplete exposure, a load change, or a clean exposure in between resets that. Suggestions derive from the load actually lifted, so manual overrides are respected. RIR is optional telemetry and never affects progression.

**Body** (`src/lib/body.ts`): raw weight, 7-day moving average, 7-day and 4-week change of the average, and a regression-based lb/week and %/week trend over the trailing 28 days. Waist is a first-class graph. No body-fat estimates, no calorie advice.

**Strength maintenance** (`src/lib/strength.ts`): estimated 1RM (Epley, 1–12 rep sets only), rolling mean of the last 3 exposures vs the 3 before. Labels are IMPROVING / MAINTAINED / TRENDING DOWN, and TRENDING DOWN needs a persistent decline. Bodyweight lifts use total system load (bodyweight + added) when a weigh-in is within a week.

## Where things live

- `src/data/seedPlan.ts` — BOXER CUT // FLEX templates + plan, and the legacy PROGRAM 01 seed (for migration detection).
- `src/lib/flex.ts` — weekly attainment, foundation streak, rotation, calendar training record.
- `src/lib/adherence.ts` — legacy weekday adherence for fixed plans only.
- `src/lib/planBundle.ts` — `liftdeck-plan` export/import with validation and collision handling. Import only adds.
- `src/lib/migrate.ts` + `Store.migrateExisting` — v1 → v2 migration; adds the flex plan once and activates it only if the untouched default plan was active.
- `src/store/store.ts` — in-memory state with write-through persistence to IndexedDB; every logged set is saved immediately.
- Session records are snapshots: editing a template later never rewrites history.

`boxer-cut-flex.liftdeck-plan.json` is the importable plan bundle (regenerate with `npx vite-node scripts/plan-bundle.ts`).

## Resetting to a clean state

Settings → DANGER ZONE → RESET ALL DATA (type `RESET` to confirm). This wipes everything and reseeds the default plan.
