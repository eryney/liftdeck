# LIFTDECK

A bodyweight strength PWA for people with a pull-up bar and not much else. All data lives on your phone.

Ships with one program, **Bar Strength**: four ~45-minute sessions a week in a fixed rotation Upper A → Lower A → Upper B → Lower B, plus an optional Flow session. Every exercise sits on a **progression chain** of harder variations (pull-up → archer → typewriter → one-arm). Hit the rep ceiling on every set and the next session serves the next rung. Stall for three sessions and the app offers a deload or a volume block one rung down.

## Stack

- React 18 + TypeScript + Vite
- IndexedDB (via `idb`) for all persistence, app-level schema version 4
- `vite-plugin-pwa` service worker: fully offline after first load
- No server, no accounts, no external services. Charts are hand-rolled SVG.

## Run locally

```
npm install
npm run dev
```

`npm run dev -- --host` exposes it on your LAN so you can try it from your phone before deploying.

## Tests

```
npm test        # unit tests (vitest): chains, prescription, progression, stalls, calibration, weekly goals, recommendation, backup/migration, store
npm run e2e     # end-to-end flows in Chromium (playwright; run `npx playwright install chromium` once)
```

The e2e suite covers onboarding and calibration, the Today preview, a full Upper A with antagonist pairing and ✓ target logging, chain advance on the next session, a hold session, a three-session stall with deload and the easier-rung exit, manual step up/down, timed holds, resume after reload, program editing, weigh-ins, and offline use.

## Build + deploy

```
npm run build   # outputs dist/ (regenerates icons, typechecks, bundles, builds the service worker)
```

`dist/` is plain static files. GitHub Pages deploys on push to `main` (`.github/workflows/deploy.yml`, built with `BASE_PATH=/liftdeck/`). Any HTTPS static host works.

## Install on iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**. Storage is per-origin, so install from the URL you plan to keep, and export a backup now and then (Settings → Export backup).

## The program

| Session | Pairs (alternate sets, rest between) | Sets × reps |
|---|---|---|
| **Upper A** · pull-up + push-up | Pull-up chain ⇄ Push-up chain · Handstand push-up chain ⇄ Row chain · Front lever chain ⇄ Planche chain · Hanging core chain | 3×5–8 · 3×5–8 · 3×5–8 · 3×6–10 · 3×10–20 s · 3×10–20 s · 3×8–12 |
| **Lower A** · squat + Nordic | Squat chain ⇄ Nordic chain · Cossack squat ⇄ Calf chain · L-sit chain ⇄ Side plank chain | 4×5–8 · 4×5–8 · 3×8–12 · 3×12–20 · 3×15–30 s · 2×20–40 s |
| **Upper B** · chin-up + dip | Chin-up chain ⇄ Dip chain · Row chain ⇄ Push-up chain · Dragon flag chain ⇄ Wall handstand hold · Prone Y raise | 3×6–10 · 3×6–10 · 3×6–10 · 3×5–8 · 3×5–8 · 3×20–45 s · 2×12–20 |
| **Lower B** · lunge + hip thrust | Lunge chain ⇄ Hip thrust chain · Nordic chain ⇄ Calf chain · Hanging core chain ⇄ Arch raise | 4×8–12 · 4×10–15 · 3×5–8 · 3×12–20 · 3×8–12 · 2×12–15 |
| **Flow** (optional, 0–2/wk) | Bear crawl, monkey, frogger, deep squat hold, dead hang, wall handstand hold | 3×30–45 s |

Weekly goal: minimum 3, target 4, soft max 5, sessions at least 20 h apart (upper and lower alternate, so back-to-back days are fine). Every muscle gets two exposures and 12–18 hard sets a week. Rest is 90 s between paired primaries, 60–75 s elsewhere, which works out to ~3 min per muscle.

**Chains** (18 of them): pull-up, chin-up, muscle-up (library only, needs a bar with clearance), row, front lever, planche, push-up, handstand push-up, dip, squat, lunge, Nordic, hip thrust, calf, hanging core, L-sit, side plank, dragon flag. Each ends with a "top of chain" note (backpack load, pauses, slower lowering).

**Why these numbers.** Strength is best served by hard sets of ~5–8 on the primary movements, while hypertrophy is similar from ~6 to 30 reps when sets end near failure (Schoenfeld 2017, 2021; Lopez 2021). 10–20 weekly hard sets per muscle, twice a week, is the productive range for trained people (Schoenfeld 2016, 2017; Baz-Valle 2022). Closer to failure grows more (Refalo 2023; Robinson 2024), so every set has an exact target one rep above last time. 2–3 min rest beats 1 min for both strength and size (Schoenfeld 2016); antagonist supersets give each muscle that rest while the session stays short (Weakley 2017; Coleman 2024). Isometric holds build strength near the trained position (Lum & Barbosa 2019); the front lever and planche progressions are the straight-arm strength work a bar makes possible (Low, *Overcoming Gravity*). Chain order and graduation rules follow the r/bodyweightfitness Recommended Routine and *Overcoming Gravity*.

## How the logic works

**Calibration** (`src/lib/calibrate.ts`). Three questions on day one (pull-ups, push-ups, single-leg squats, plus whether you own bands) rewrite the starting rung on each chain. After that only what you log matters.

**Progression chains** (`src/data/exercises.ts`, `src/data/progressions.ts`, `src/lib/variation.ts`). Exercises carry a `progressionId` and `level`. When a session starts, each chain slot looks at the most recent completed exposure of *any* rung in that chain and applies the double-progression verdict: every prescribed set at the rep ceiling → **advance** to the next rung; second consecutive complete exposure with a set below the floor → **step back** one rung (a suggestion); otherwise **hold**. On the last rung the verdict becomes **top of chain** and the added-load suggestion steps up instead (backpack). Decisions derive from what was actually performed, so stepping up/down by hand (available until the first set) or swapping within a chain is respected next time. A slot can be `lockVariation` to pin a rung.

**Exact targets** (`src/lib/prescribe.ts`). Every set gets a number, not a range, and the set row has a ✓ that logs it in one tap. A fresh rung starts at the floor on every set. Every target hit → +1 rep on every set; otherwise +1 rep in total, front-loaded; a set under the floor → the same session again. Timed holds move in 5-second steps. Targets reset to the floor on a new rung or a new load.

**Stalls and deloads** (`src/lib/stall.ts`). Three consecutive complete sessions on the same rung and load with no net gain in total prescribed reps flag a stall. The session card offers two exits: **Deload today** (every target drops to the floor, the exposure can never advance the chain, and the climb restarts one above the floor next time) or **Easier rung** (the previous variation for a block of volume). A deload also resets the stall window.

**Antagonist pairs.** A slot flagged `superset` shares a pair group with the slot after it. After every logged set the workout screen jumps to the partner with the fewest logged sets.

**Weekly goals** (`src/lib/flex.ts`, `src/lib/recommend.ts`). Weeks are Mon–Sun and judged on totals. The rotation is driven by the most recently completed rotation session and never resets on Monday. The recommendation is a fixed rule list: next session if below target and rested → rest otherwise (the next session is still one tap away) → a bonus session up to the soft max → rest. Nothing is ever blocked.

**Body** (`src/lib/body.ts`): raw weight, 7-day moving average, 7-day and 4-week change of the average, regression lb/week over the trailing 28 days. Waist is tracked too. No body-fat estimates, no calorie advice.

## Where things live

- `src/data/exercises.ts` — the library: every chain in order, with cues and household gear notes.
- `src/data/progressions.ts` — chain names, patterns, and what to do at the top of each.
- `src/data/seedPlan.ts` — the Bar Strength templates + plan.
- `src/lib/variation.ts` — which rung today, and why. `src/lib/prescribe.ts` — exact per-set targets. `src/lib/stall.ts` — stall detection.
- `src/lib/calibrate.ts` — onboarding answers → starting rungs.
- `src/store/store.ts` — in-memory state with write-through persistence to IndexedDB; every logged set is saved immediately. Upgrades older installs in place (library resync, legacy plan swap); session records are snapshots and never rewritten.
- `src/screens/` — Today, Workout, Chains, History, Settings, Onboarding.

## Resetting to a clean state

Settings → Danger zone → Reset all data (type `RESET` to confirm). This wipes everything and reseeds the default program.
