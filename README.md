# LIFTDECK

A personal training PWA. Weeks are judged on totals, never on which weekday something happened. 1980s terminal aesthetic. All data lives on your device.

Ships with **CALISTHENICS CUT // FLEX**: bodyweight only (a pull-up bar, the floor, a table, a couple of chairs), four ~45-minute sessions a week in a fixed rotation UPPER A → LOWER A → UPPER B → LOWER B, plus an optional GMB-style FLOW session. Progressive overload comes from **progression chains**: hit the rep ceiling on every prescribed set and the next session serves the next, harder variation. The older **BOXER CUT // FLEX** (dumbbells + boxing) still works and ships as an importable plan file; the legacy fixed-weekday **PROGRAM 01** still works for anyone who has one.

## Stack

- React 18 + TypeScript + Vite
- IndexedDB (via `idb`) for all persistence, with an app-level schema version (currently 3)
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
npm test        # unit tests (vitest): chains/variation, progression, flex adherence, recommendation engine, body trends, boxing, strength trends, plan bundles, backup/migration, store
npm run e2e     # end-to-end flows in Chromium (playwright; run `npx playwright install chromium` once)
```

The e2e suite covers onboarding → today's card preview → UPPER A → antagonist pairing → ✓ target logging → rest timer → completion → chain ADVANCE on the next session, manual step up/down, timed holds, boxing as an added goal, body weight/waist trends, persistence across reloads, backup export/wipe/import, in-place migration of a v1 install, plan import/export, and offline use.

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

## The program

| Day | Pairs (A1 ⇄ B1, alternate sets) | Sets × reps |
|---|---|---|
| **UPPER A** · pull-up + push-up | Pull-up chain ⇄ Push-up chain · Handstand chain ⇄ Row chain · Hanging core chain ⇄ Prone Y raise | 3×5–8 · 3×8–12 · 3×6–10 · 3×8–12 · 3×8–12 · 2×12–20 |
| **LOWER A** · squat + Nordic | Squat chain ⇄ Nordic chain · Cossack squat ⇄ Calf chain · L-sit chain ⇄ Side chain | 3×6–10 · 3×6–10 · 3×8–12 · 3×12–20 · 3×15–30 s · 2×20–40 s |
| **UPPER B** · chin-up + dip | Chin-up chain ⇄ Dip chain · Row chain ⇄ Push-up chain · Dragon flag chain ⇄ Wall handstand hold | 3×5–8 · 3×8–12 · 3×8–12 · 3×8–12 · 3×5–8 · 2×20–45 s |
| **LOWER B** · lunge + hip thrust | Lunge chain ⇄ Hip thrust chain · Nordic chain ⇄ Calf chain · Hanging core chain ⇄ Arch raise | 3×8–12 · 3×10–15 · 3×6–10 · 3×12–20 · 3×8–12 · 2×12–15 |
| **FLOW** (optional, 0–2/wk) | Bear crawl, monkey, frogger, deep squat hold, dead hang, wall handstand hold | 3 × 30–60 s each |

Weekly goals: strength minimum 3 / target 4 / soft max 5, sessions at least 20 h apart (upper and lower alternate, so back-to-back days are fine). Every muscle gets two exposures and roughly 10–16 hard sets a week. Each session opens with a 5-minute warm-up checklist. Rest is 60–75 s between paired exercises, which works out to 2.5+ minutes per muscle.

The numbers lean on: hypertrophy is similar anywhere from ~6 to 30 reps when sets end near failure (Schoenfeld 2021; Lopez 2021), 10–20 weekly sets per muscle is the productive range for trained people (Schoenfeld 2017; Baz-Valle 2022), closer to failure grows more (Refalo 2023; Robinson 2024), push-ups matched to bench press grow the same muscle (Kikuchi & Nakazato 2017; Kotarsky 2018), and antagonist supersets cut session time by about a third with the same gains (Coleman 2024; Weakley 2025). Chain order and graduation rules follow the r/bodyweightfitness Recommended Routine and Overcoming Gravity. The push-up chain runs incline → push-up → diamond → Mike Tyson → decline → pseudo planche → archer → one-arm (elevated) → one-arm.

## How the program logic works

**Progression chains** (`src/data/exercises.ts`, `src/data/progressions.ts`, `src/lib/variation.ts`). Bodyweight exercises carry a `progressionId` and a `level`; a chain is the ordered ladder of rungs (e.g. incline push-up → push-up → diamond → decline → pseudo planche → archer → one-arm elevated → one-arm). When a session starts, each chain slot looks at the most recent completed exposure of **any** rung in that chain and applies the double-progression verdict: every prescribed set at the rep ceiling → **ADVANCE** to the next rung; second consecutive complete exposure with a set below the floor → **STEP BACK** one rung (a suggestion); otherwise **HOLD** and chase reps. On the last rung the verdict becomes **TOP OF CHAIN** and the added-load suggestion steps up instead (backpack). Decisions derive from what was actually performed, so stepping up/down by hand (↓ EASIER / ↑ HARDER, available until the first set) or substituting within a chain is respected next time. A slot can be `lockVariation` to pin a rung; an exercise outside any chain progresses by load as before.

**Exact rep targets** (`src/lib/prescribe.ts`). Every prescribed set gets a number, not a range, and the set row has a ✓ that logs it in one tap (tap the row to enter something else). A fresh rung starts at the floor of the range on every set. On the same rung the next targets come from what was actually done: every target hit → +1 rep on every set (8,8,8 → 9,9,9); a set under the floor → the same session again with that set back at the floor; otherwise +1 rep in total, front-loaded. Timed holds move in 5-second steps. Targets reset to the floor on a new rung or a new load. The Today screen previews the whole card (rung + targets per exercise) before you start. The RIR prompt is off by default (Settings → ASK RIR).

**Antagonist pairs**. A slot flagged `superset` shares a pair group with the slot after it. After every logged set the workout screen jumps to the partner with the fewest logged sets; when the partner is done it stays put. The rest timer still runs on every set.

**Timed holds** (`timed` on the exercise) log seconds instead of reps; the rep range, picker, and history all read in seconds. Chains are homogeneous: a chain is either all reps or all seconds.

**Flex plans** (`mode: 'flex'`) have weekly goals instead of a weekday schedule. Each week (Mon–Sun) is a FOUNDATION week when every non-optional goal hits its minimum, and a TARGET week when every one hits its target. There is no "missed Wednesday". The rotation is driven by the most recently completed rotation session and never resets on Monday. A plan may include a boxing goal (BOXER CUT does; CALISTHENICS CUT does not, add one in PLAN → EDIT WEEKLY TARGETS if you still box). Boxing UI only appears for plans with a boxing goal.

**Recommendation engine** (`src/lib/recommend.ts`) is a fixed rule list, in order: strength floor (0 this week and rested) → boxing below minimum → next strength exposure (rested) → boxing toward target → optional session once the week's targets are met → recovery. The optional session is also offered as a secondary choice whenever strength is not the call (not yet rested, or done for the week). Nothing is ever blocked.

**Double progression** (`src/lib/progression.ts`): only the prescribed sets count. Every prescribed set at repMax → INCREASE (or ADVANCE for chain exercises). Otherwise HOLD (not a failure). REDUCE / STEP BACK is suggested only after two consecutive complete exposures at the same load with a prescribed set below repMin; an incomplete exposure, a load change, or a clean exposure in between resets that. RIR is optional telemetry and never affects progression.

**Body** (`src/lib/body.ts`): raw weight, 7-day moving average, 7-day and 4-week change of the average, and a regression-based lb/week and %/week trend over the trailing 28 days. Waist is a first-class graph. No body-fat estimates, no calorie advice.

**Strength maintenance** (`src/lib/strength.ts`): estimated 1RM (Epley, 1–12 rep sets only) for loaded lifts; bodyweight lifts use total system load (bodyweight + added) when a weigh-in is within a week. Unloaded bodyweight work shows total reps per rung instead, and the CHAINS tab shows the ladder.

## Where things live

- `src/data/exercises.ts` — the library: v1 rows, v2 additions, and the v3 bodyweight chains with cues and gear notes.
- `src/data/progressions.ts` — chain names, patterns, and what to do at the top of each chain.
- `src/data/seedPlan.ts` — CALISTHENICS CUT // FLEX templates + plan, BOXER CUT // FLEX (v2), and the legacy PROGRAM 01 seed (for migration detection).
- `src/lib/variation.ts` — chain resolution: which rung today, and why.
- `src/lib/prescribe.ts` — exact per-set rep targets from the last exposure on that rung.
- `src/lib/flex.ts` — weekly attainment, foundation streak, rotation, calendar training record.
- `src/lib/planBundle.ts` — `liftdeck-plan` export/import with validation and collision handling. Import only adds.
- `src/lib/migrate.ts` + `Store.migrateExisting` — v1/v2 → v3 migration; adds missing library exercises, tags v1 bodyweight rows into their chains, adds each bundled plan once, and activates the newest only if the active plan was an untouched default seed.
- `src/store/store.ts` — in-memory state with write-through persistence to IndexedDB; every logged set is saved immediately.
- Session records are snapshots: editing a template later never rewrites history.

`calisthenics-cut.liftdeck-plan.json` and `boxer-cut-flex.liftdeck-plan.json` are the importable plan bundles (regenerate with `npx vite-node scripts/plan-bundle.ts [boxer-cut]`).

## Resetting to a clean state

Settings → DANGER ZONE → RESET ALL DATA (type `RESET` to confirm). This wipes everything and reseeds the default plan.
