# LIFTDECK

A bodyweight and resistance-band strength PWA for people with a pull-up bar. All data lives on your phone.

Ships with **Full Body · 3 days**: alternate A/B/A, then B/A/B the following week. Leave a recovery day between strength sessions. Use up to 2 other sessions for accessories, cardio, or one of each. Strength work takes roughly an hour, depending on rest and exercise variations.

Exercises with progression chains advance when every prescribed set reaches the rep ceiling. Band resistance and floor core progress without automatic pound increases. Three stalled sessions trigger a deload suggestion.

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

The e2e suite covers onboarding and calibration, the Today preview, a complete Full Body A with paired sets and ✓ target logging, chain advance on the next session, a hold session, a three-session stall with deload and the easier-rung exit, manual step up/down, timed holds, resume after reload, program editing, weigh-ins, and offline use.

## Build + deploy

```
npm run build   # outputs dist/ (regenerates icons, typechecks, bundles, builds the service worker)
```

`dist/` is plain static files. GitHub Pages deploys on push to `main` (`.github/workflows/deploy.yml`, built with `BASE_PATH=/liftdeck/`). Any HTTPS static host works.

## Install on iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**. Storage is per-origin, so install from the URL you plan to keep, and export a backup now and then (Settings → Export backup).

## Your equipment

Both full-body workouts use band bent-over rows, 3×8–15, with the band held under both feet. The band row chain advances to a 2-second pause, then a 4-second return using the same band and grip. At the top, use a stronger band and log the reps you complete. Band resistance never gets automatic pound increases.

The exercise picker includes seated band rows, pull-aparts, chest presses, shoulder presses, front squats, Romanian deadlifts, and overhead triceps extensions. These don't need a table or a separate anchor. Anchored exercises list their anchor in the gear notes. Some other program exercises still use chairs, a couch, a wall, or a step.

Existing table and low-bar row slots switch to band rows once on upgrade, including restored older backups. Slot IDs and custom set counts stay intact. Completed workouts stay intact. The later equipment update also replaces unlogged suspended-core and gymnastic exercises in active workouts. Partially logged exercises keep their original name and sets; the remaining sets move to the replacement.

The default program uses upright bar work, bands, and floor core exercises. Front levers, hanging core, planches, and handstands stay in the optional library and never follow automatically from a default slot. Shoulder work uses standing band presses; suspended core uses dead bugs and floor reverse crunches. Floor core progresses by reps or hold time without automatic weight increases. Use the bar only as allowed by its manufacturer and installation instructions.

## The program

Adapted from the [r/bodyweightfitness Recommended Routine](https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/) for bands, a pull-up bar, and a chair or couch.

| Session | Strength pairs, 3 sets each | Core, 2 sets each |
|---|---|---|
| Full Body A | Pull-up + split squat; band shoulder press + band Romanian deadlift; band row + push-up | Dead bug, side plank, arch raise |
| Full Body B | Chin-up + reverse lunge; chair dip + sliding leg curl; band row + push-up | Floor reverse crunch, side plank, arch raise |
| Accessories (optional) | 2 sets each: band curls, triceps extensions, lateral raises, pull-aparts, single-leg glute bridges and calf raises | |
| Cardio (optional) | Log completed minutes for a walk, run, cycle, swim or other cardio | |

Example week: strength Monday, Wednesday and Friday; optional sessions Tuesday and Thursday. The strength target and cap are both 3. Accessories and cardio share a separate cap of 2 sessions. Optional sessions don't advance the strength rotation or restart its recovery clock.

The app recommends a full recovery day between strength sessions, plus at least 24 hours since the previous session finished. Paired strength sets have 90 seconds of rest between exercises; core and accessories use 60 seconds. Starting variations depend on calibration and recorded progress.

Existing installs switch once to this plan. The old split templates are archived, completed and active workouts stay intact, and calibrated starting variations carry over. Cardio minutes appear in History, JSON backups and CSV exports.

## How the logic works

**Calibration** (`src/lib/calibrate.ts`). Three questions on day one (pull-ups, push-ups, single-leg squats, plus whether you own bands) rewrite the starting rung on each chain. After that only what you log matters.

**Progression chains** (`src/data/exercises.ts`, `src/data/progressions.ts`, `src/lib/variation.ts`). Exercises carry a `progressionId` and `level`. When a session starts, each chain slot looks at the most recent completed exposure of *any* rung in that chain and applies the double-progression verdict: every prescribed set at the rep ceiling → **advance** to the next rung; second consecutive complete exposure with a set below the floor → **step back** one rung (a suggestion); otherwise **hold**. On the last rung the verdict becomes **top of chain** and the added-load suggestion steps up instead (backpack). Decisions derive from what was actually performed, so stepping up/down by hand (available until the first set) or swapping within a chain is respected next time. A slot can be `lockVariation` to pin a rung.

**Exact targets** (`src/lib/prescribe.ts`). Every set gets a number, not a range, and the set row has a ✓ that logs it in one tap. A fresh rung starts at the floor on every set. Every target hit → +1 rep on every set; otherwise +1 rep in total, front-loaded; a set under the floor → the same session again. Timed holds move in 5-second steps. Targets reset to the floor on a new rung or a new load.

**Stalls and deloads** (`src/lib/stall.ts`). Three consecutive complete sessions on the same rung and load with no net gain in total prescribed reps flag a stall. The session card offers two exits: **Deload today** (every target drops to the floor, the exposure can never advance the chain, and the climb restarts one above the floor next time) or **Easier rung** (the previous variation for a block of volume). A deload also resets the stall window.

**Paired sets.** A slot flagged `superset` shares a pair group with the slot after it. After every logged set the workout screen jumps to the partner with the fewest logged sets.

**Weekly goals** (`src/lib/flex.ts`, `src/lib/recommend.ts`). Weeks are Mon–Sun and judged on totals. The rotation is driven by the most recently completed rotation session and never resets on Monday. The recommendation is a fixed rule list: next session if below target and rested → rest otherwise (the next session is still one tap away) → a bonus session up to the soft max → rest. Nothing is ever blocked.

**Body** (`src/lib/body.ts`): raw weight, 7-day moving average, 7-day and 4-week change of the average, regression lb/week over the trailing 28 days. Waist is tracked too. No body-fat estimates, no calorie advice.

## Where things live

- `src/data/exercises.ts` — the library: every chain in order, with cues and household gear notes.
- `src/data/progressions.ts` — chain names, patterns, and what to do at the top of each.
- `src/data/seedPlan.ts` — legacy split templates and exports of the current defaults.
- `src/data/fullBodyPlan.ts`: full-body A/B, accessories, cardio, weekly goals and migration helpers.
- `src/lib/variation.ts` — which rung today, and why. `src/lib/prescribe.ts` — exact per-set targets. `src/lib/stall.ts` — stall detection.
- `src/lib/calibrate.ts` — onboarding answers → starting rungs.
- `src/store/store.ts` — in-memory state with write-through persistence to IndexedDB; every logged set is saved immediately. Upgrades older installs in place (library resync, legacy plan swap); session records are snapshots and never rewritten.
- `src/screens/` — Today, Workout, Chains, History, Settings, Onboarding.

## Resetting to a clean state

Settings → Danger zone → Reset all data (type `RESET` to confirm). This wipes everything and reseeds the default program.
