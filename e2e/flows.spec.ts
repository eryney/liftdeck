import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LEGACY_SEED_PLAN, LEGACY_SEED_TEMPLATES } from '../src/data/seedPlan';

const TUESDAY = new Date('2026-09-01T10:00:00');
const MONDAY = new Date('2026-08-31T10:00:00');

async function boot(page: Page, time: Date) {
  await page.clock.install({ time });
  await page.goto('/');
}

async function onboard(page: Page) {
  await page.getByRole('button', { name: 'BOXER CUT // FLEX' }).click();
  await page.getByRole('button', { name: "LET'S GO" }).click();
  await expect(page.getByRole('heading', { name: 'THIS WEEK' })).toBeVisible();
}

async function dismissOverlays(page: Page) {
  const rirSkip = page.locator('.sheet').getByRole('button', { name: 'SKIP' });
  if (await rirSkip.isVisible().catch(() => false)) await rirSkip.click();
  const skip = page.locator('.rest-bar').getByRole('button', { name: 'SKIP' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const ok = page.locator('.rest-bar').getByRole('button', { name: 'OK' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
}

/** Log every remaining set at the top of the rep range (first `.max` grid button = repMax). */
async function crushAllSets(page: Page) {
  for (let guard = 0; guard < 60; guard++) {
    await dismissOverlays(page);
    if (await page.getByRole('button', { name: /COMPLETE WORKOUT/ }).isVisible().catch(() => false)) return;
    const next = page.locator('.set-row--next').first();
    await next.waitFor({ state: 'visible', timeout: 5000 });
    await next.click();
    await page.locator('.rep-grid button.max').first().click();
    await page.waitForTimeout(450); // allow auto-advance
  }
  throw new Error('never finished workout');
}

test('Flow A+B: full Strength A, double progression, RIR, calendar record, history, next-session suggestion', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);

  // Flex Today: weekly panel, no weekday judgement, strength floor recommended first
  await expect(page.getByText('LIFTDECK // BOXER CUT')).toBeVisible();
  await expect(page.getByTestId('week-status')).toContainText('FOUNDATION IN PROGRESS');
  await expect(page.getByTestId('recommended')).toContainText('STRENGTH A // FULL BODY');
  await expect(page.getByRole('button', { name: 'BOXING DONE ✓' })).toBeVisible(); // boxing always available

  await page.getByRole('button', { name: 'START STRENGTH A' }).click();

  // First exercise, no previous data, per-hand load is explicit
  await expect(page.getByText('DUMBBELL BULGARIAN SPLIT SQUAT')).toBeVisible();
  await expect(page.getByText('FIRST TIME')).toBeVisible();
  await expect(page.locator('.weight-display')).toContainText('/ HAND');

  // Log set 1 at top of range → rest timer starts automatically
  await page.locator('.set-row--next').first().click();
  await page.locator('.rep-grid button.max').first().click();
  await expect(page.locator('.rest-bar')).toBeVisible();
  await expect(page.locator('.rest-time')).toHaveText(/\d:\d\d/);

  // Timer completes visibly when time passes
  await page.clock.fastForward(155_000);
  await expect(page.getByText('REST COMPLETE')).toBeVisible();
  await dismissOverlays(page);

  // Final prescribed set (2 of 2) → optional one-tap RIR prompt
  await page.locator('.set-row--next').first().click();
  await page.locator('.rep-grid button.max').first().click();
  await expect(page.getByRole('heading', { name: 'RIR?' }).or(page.getByText('RIR?'))).toBeVisible();
  await page.getByRole('button', { name: 'rir 2' }).click();

  // Crush everything else at the top of each rep range (RIR prompts are skipped)
  await crushAllSets(page);
  await page.getByRole('button', { name: /COMPLETE WORKOUT/ }).click();

  // Completion overlay with INCREASE language, never "failed"
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible();
  await expect(page.getByText(/INCREASE ON 6 EXERCISES/)).toBeVisible();
  await expect(page.locator('.complete-card')).toContainText('RIR 2');
  await page.getByRole('button', { name: 'DONE' }).click();

  // Today: strength 1/2, boxing now the recommendation (below minimum), lift summarised
  await expect(page.getByTestId('goal-rotation')).toContainText('1');
  await expect(page.getByTestId('recommended')).toContainText('BOXING');
  await expect(page.getByText('DONE TODAY')).toBeVisible();

  // Calendar is a training record: the day shows "A"; blank days are neutral, nothing is "missed"
  await page.getByRole('button', { name: 'CALENDAR' }).click();
  await expect(page.getByRole('button', { name: '2026-09-01 a' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2026-08-31 no training logged' })).toBeVisible();
  await expect(page.locator('.cal-grid')).not.toContainText('×');
  await expect(page.locator('[data-testid="week-row"]').first()).toContainText('STR 1/2');

  // History shows the session
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('.list-row', { hasText: 'STRENGTH A' })).toBeVisible();

  // Flow B: next Strength A suggests increased weight (split squat 20 → 25 per hand) and shows last performance
  await page.getByRole('button', { name: 'TODAY' }).click();
  await page.getByRole('button', { name: 'START SOMETHING ELSE' }).click();
  await expect(page.locator('.sheet')).toContainText('RECENT STRENGTH SESSION'); // warning, not a block
  await page.locator('.sheet .list-row', { hasText: 'STRENGTH A' }).click();
  await expect(page.getByText('DUMBBELL BULGARIAN SPLIT SQUAT')).toBeVisible();
  await expect(page.locator('.weight-display')).toContainText('25');
  await expect(page.getByText(/LAST · 2026-09-01/)).toBeVisible();
  await expect(page.locator('.last-block')).toContainText('increase');
});

test('Flow B (hold case): a mediocre workout HOLDs the weight — neutral language, no failure', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);
  await page.getByRole('button', { name: 'START STRENGTH A' }).click();

  // Log both split squat sets at repMin (6) → HOLD
  for (let i = 0; i < 2; i++) {
    await dismissOverlays(page);
    await page.locator('.set-row--next').first().click();
    await page.getByRole('button', { name: '6 reps', exact: true }).click();
    await page.waitForTimeout(450);
  }
  await dismissOverlays(page);
  await page.getByRole('button', { name: /FINISH EARLY/ }).click();
  await page.getByRole('button', { name: 'FINISH', exact: true }).click();
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible();
  await expect(page.locator('.complete-card')).toContainText('= HOLD');
  await expect(page.locator('.complete-card')).not.toContainText(/FAIL/);
  await page.getByRole('button', { name: 'DONE' }).click();

  // Next session: same 20 lb suggestion
  await page.getByRole('button', { name: 'START SOMETHING ELSE' }).click();
  await page.locator('.sheet .list-row', { hasText: 'STRENGTH A' }).click();
  await expect(page.locator('.weight-display')).toContainText('20');
});

test('Flow C: boxing is one tap, details are optional, recovery note is a warning only', async ({ page }) => {
  await boot(page, MONDAY);
  await onboard(page);

  await page.getByRole('button', { name: 'BOXING DONE ✓' }).click();
  // attendance is saved immediately; the details sheet is optional
  await expect(page.getByText('ADD DETAILS?')).toBeVisible();
  await page.getByRole('button', { name: 'SPAR' }).click();
  await page.locator('.sheet').getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: 'rpe 8' }).click();
  await expect(page.locator('.sheet')).toContainText('LOAD 480');
  await page.locator('.sheet').getByRole('button', { name: 'DONE' }).click();

  await expect(page.getByText('BOXING LOGGED ✓')).toBeVisible();
  await expect(page.getByText('SPARRING · 60 MIN · RPE 8')).toBeVisible();
  await expect(page.getByTestId('goal-boxing')).toContainText('1');
  // hard boxing → subtle note on the strength recommendation, still startable
  await expect(page.getByTestId('recommended')).toContainText('HARD BOXING RECENTLY');
  await expect(page.getByRole('button', { name: 'START STRENGTH A' })).toBeEnabled();
  await expect(page.getByText('BOXING THIS WEEK')).toBeVisible(); // secondary telemetry

  await page.getByRole('button', { name: 'CALENDAR' }).click();
  await expect(page.getByRole('button', { name: '2026-08-31 box' })).toBeVisible();

  // Undo works
  await page.getByRole('button', { name: 'TODAY' }).click();
  await page.getByRole('button', { name: 'UNDO' }).click();
  await expect(page.getByRole('button', { name: 'BOXING DONE ✓' })).toBeVisible();

  // one-tap again, dismiss details instantly
  await page.getByRole('button', { name: 'BOXING DONE ✓' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'SKIP' }).click();
  await expect(page.getByText('BOXING LOGGED ✓')).toBeVisible();
  await expect(page.getByText('no details')).toBeVisible();
});

test('Flow D+E: body weight + waist persist across reload, trends and waist graph render', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);

  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  for (const [d, w, waist] of [
    ['2026-08-18', '184.0', '36'], ['2026-08-21', '183.4', ''], ['2026-08-25', '182.9', '35.5'], ['2026-08-29', '182.2', ''], ['2026-09-01', '181.5', '35'],
  ]) {
    await page.getByLabel('body weight (lb)').fill(w);
    if (waist) await page.getByLabel('waist (inches)').fill(waist);
    await page.getByLabel('date').fill(d);
    await page.getByRole('button', { name: 'SAVE' }).click();
  }
  await expect(page.locator('.stat', { hasText: 'LATEST RAW' })).toContainText('181.5');
  await expect(page.locator('.stat', { hasText: 'TREND · LB / WEEK' })).toContainText('-');
  await expect(page.getByText(/% BODYWEIGHT \/ WEEK/)).toBeVisible();
  await expect(page.locator('.stat', { hasText: 'LATEST WAIST' })).toContainText('35"');
  await expect(page.getByRole('heading', { name: 'WAIST OVER TIME' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/BODY FAT|CALORIE/i);

  // Reload: data persists (IndexedDB)
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  await expect(page.locator('.stat', { hasText: 'LATEST RAW' })).toContainText('181.5');

  // Overview shows the cut dashboard
  await page.getByRole('button', { name: 'OVERVIEW' }).click();
  await expect(page.getByRole('heading', { name: /BODY · CUT → DEC 31 2026/ })).toBeVisible();
  await expect(page.locator('.stat', { hasText: 'WAIST · 4 WEEK' })).toBeVisible();
});

test('Flow E: mid-workout sets survive reload and can be resumed', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);
  await page.getByRole('button', { name: 'START STRENGTH A' }).click();
  await page.locator('.set-row--next').first().click();
  await page.getByRole('button', { name: '8 reps', exact: true }).click();

  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: 'RESUME WORKOUT' }).click();
  await expect(page.locator('.set-row--done .set-value')).toHaveText('8');
});

test('Flow F: export backup, wipe, import reconstructs data (v2 backup carries boxing metadata)', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);

  // create some data incl. boxing metadata
  await page.getByRole('button', { name: 'BOXING DONE ✓' }).click();
  await page.getByRole('button', { name: 'BAG' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'DONE' }).click();
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  await page.getByLabel('body weight (lb)').fill('179');
  await page.getByRole('button', { name: 'SAVE' }).click();

  // export
  await page.getByRole('button', { name: 'SETTINGS' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT BACKUP (JSON)' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const backup = JSON.parse(readFileSync(path!, 'utf-8'));
  expect(backup.app).toBe('liftdeck');
  expect(backup.schemaVersion).toBe(2);
  expect(backup.measurements[0].weightLb).toBe(179);
  expect(backup.boxing[0].sessionType).toBe('bag');
  expect(backup.plans[0].mode).toBe('flex');
  await page.getByRole('button', { name: 'OK' }).click();

  // wipe (guarded reset)
  await page.getByRole('button', { name: 'RESET ALL DATA' }).click();
  await page.getByPlaceholder('type RESET').fill('RESET');
  await page.getByRole('button', { name: 'WIPE EVERYTHING' }).click();
  await expect(page.getByRole('button', { name: 'BOXER CUT // FLEX' })).toBeVisible();

  // import the backup back
  await onboard(page);
  await page.getByRole('button', { name: 'SETTINGS' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'IMPORT BACKUP…' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path!);
  await page.getByRole('button', { name: 'IMPORT', exact: true }).click();
  await expect(page.getByText('Backup imported.')).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();

  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  await expect(page.locator('.stat', { hasText: 'LATEST RAW' })).toContainText('179');
  await page.getByRole('button', { name: 'BOXING', exact: true }).click();
  await expect(page.locator('.list-row', { hasText: 'BAG' })).toBeVisible();
});

test('Flow G: an existing v1 install migrates in place — history kept, flex plan added, legacy plan still works', async ({ page }) => {
  await boot(page, TUESDAY);
  // first load creates the DB; now overwrite it with a realistic v1 install
  await expect(page.getByRole('button', { name: 'BOXER CUT // FLEX' })).toBeVisible();
  const v1 = {
    settings: {
      id: 'settings', schemaVersion: 1, onboarded: true, activePlanId: 'plan_default', startDate: '2026-08-10', units: 'lb',
      defaultIncrement: 5, compoundRestSec: 120, isolationRestSec: 90, maWindowDays: 7, soundOn: true, vibrateOn: true,
    },
    templates: LEGACY_SEED_TEMPLATES,
    plans: [LEGACY_SEED_PLAN],
    sessions: [{
      id: 'ws_old', date: '2026-08-25', name: 'STRENGTH A', templateId: 'tpl_strength_a', status: 'completed', startedAt: 1756150000000, finishedAt: 1756153000000,
      exercises: [{
        id: 'es_old', exerciseId: 'db-incline-press', name: 'Dumbbell Incline Bench Press', perHand: true, targetSets: 3, repMin: 8, repMax: 15, restSec: 120,
        increment: 5, suggestedWeight: 45, weight: 45, result: 'progress', sets: [{ reps: 15, weight: 45 }, { reps: 15, weight: 45 }, { reps: 15, weight: 45 }],
      }],
    }],
    boxing: [{ id: 'bx_old', date: '2026-08-24', loggedAt: 1756060000000 }],
    measurements: [{ id: 'bm_old', date: '2026-08-24', weightLb: 184.2, waistIn: 35.5, loggedAt: 1756060000000 }],
  };
  await page.evaluate(async (data) => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('liftdeck', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const names = ['settings', 'templates', 'plans', 'sessions', 'boxing', 'measurements', 'exercises'];
    const tx = db.transaction(names, 'readwrite');
    for (const n of names) tx.objectStore(n).clear();
    tx.objectStore('settings').put(data.settings);
    for (const t of data.templates) tx.objectStore('templates').put(t);
    for (const p of data.plans) tx.objectStore('plans').put(p);
    for (const s of data.sessions) tx.objectStore('sessions').put(s);
    for (const b of data.boxing) tx.objectStore('boxing').put(b);
    for (const m of data.measurements) tx.objectStore('measurements').put(m);
    await new Promise((res) => (tx.oncomplete = res));
    db.close();
  }, v1);
  await page.reload();

  // untouched default plan → BOXER CUT activated; onboarding skipped; history intact
  await expect(page.getByText('LIFTDECK // BOXER CUT')).toBeVisible();
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('.list-row', { hasText: 'STRENGTH A' })).toBeVisible();
  await page.locator('.list-row', { hasText: 'STRENGTH A' }).click();
  await expect(page.locator('.sheet')).toContainText('45 × 15, 15, 15');
  await expect(page.locator('.sheet')).toContainText('▲'); // v1 'progress' rendered as INCREASE
  await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });
  await page.getByRole('button', { name: 'BODY' }).click();
  await expect(page.locator('.stat', { hasText: 'LATEST RAW' })).toContainText('184.2');

  // legacy plan is still there and still works as a fixed week
  await page.getByRole('button', { name: 'PLAN', exact: true }).click();
  await expect(page.locator('.list-row', { hasText: 'PROGRAM 01' })).toContainText('FIXED');
  await page.locator('.list-row', { hasText: 'PROGRAM 01' }).getByRole('button', { name: 'ACTIVATE' }).click();
  await page.getByRole('button', { name: 'TODAY' }).click();
  await expect(page.getByRole('heading', { name: 'TUESDAY' })).toBeVisible();
  await expect(page.locator('.today-hero')).toContainText('STRENGTH A');
  await page.getByRole('button', { name: 'CALENDAR' }).click();
  await expect(page.getByRole('button', { name: '2026-08-31 missed' })).toBeVisible(); // legacy semantics preserved for fixed plans
  await page.getByRole('button', { name: 'previous month' }).click();
  await expect(page.getByRole('button', { name: '2026-08-25 completed' })).toBeVisible();
});

test('Flow H: plan export/import adds a plan without touching history; ACTIVATE is offered', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);
  await page.getByRole('button', { name: 'BOXING DONE ✓' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'SKIP' }).click();

  await page.getByRole('button', { name: 'PLAN', exact: true }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT PLAN' }).click();
  const download = await dl;
  const path = (await download.path())!;
  const fs = await import('node:fs');
  const bundle = JSON.parse(fs.readFileSync(path, 'utf-8'));
  expect(bundle.app).toBe('liftdeck-plan');
  expect(bundle.schemaVersion).toBe(2);
  expect(bundle.templates).toHaveLength(3);
  expect(bundle.exercises.map((e: { id: string }) => e.id)).toEqual(['cable-leg-curl']);
  await page.getByRole('button', { name: 'OK' }).click();

  // a friend's variant: same template ids (identical → reused), new plan name
  bundle.plan.id = 'plan_friend';
  bundle.plan.name = 'FRIEND CUT';
  const friend = path.replace(/\.json$/, '') + '-friend.json';
  fs.writeFileSync(friend, JSON.stringify(bundle));

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'IMPORT PLAN…' }).click();
  await (await chooser).setFiles(friend);
  await expect(page.locator('.sheet')).toContainText('FRIEND CUT');
  await expect(page.locator('.sheet')).toContainText('Adds 0 templates');
  await page.getByRole('button', { name: 'IMPORT', exact: true }).click();
  await expect(page.getByText('PLAN IMPORTED')).toBeVisible();
  await page.getByRole('button', { name: 'ACTIVATE PLAN' }).click();
  await expect(page.locator('.list-row', { hasText: 'FRIEND CUT' })).toContainText('ACTIVE');

  // history untouched
  await page.getByRole('button', { name: 'TODAY' }).click();
  await expect(page.getByText('LIFTDECK // FRIEND CUT')).toBeVisible();
  await expect(page.getByText('BOXING LOGGED ✓')).toBeVisible();

  // a broken bundle produces a readable error, and a full backup is refused here
  const bad = { ...bundle, exercises: [] };
  bad.plan.id = 'plan_bad';
  bad.templates = bad.templates.map((t: any) => ({ ...t, id: t.id + '_x', exercises: t.exercises.map((e: any) => ({ ...e, exerciseId: e.exerciseId === 'cable-leg-curl' ? 'nope-curl' : e.exerciseId })) }));
  bad.plan.weeklyGoals = bad.plan.weeklyGoals.map((g: any) => g.kind === 'rotation' ? { ...g, templateIds: g.templateIds.map((x: string) => x + '_x') } : g.kind === 'workout' ? { ...g, templateId: g.templateId + '_x' } : g);
  const badPath = path.replace(/\.json$/, '') + '-bad.json';
  fs.writeFileSync(badPath, JSON.stringify(bad));
  await page.getByRole('button', { name: 'PLAN', exact: true }).click();
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'IMPORT PLAN…' }).click();
  await (await chooser2).setFiles(badPath);
  await expect(page.getByText('PLAN IMPORT FAILED')).toBeVisible();
  await expect(page.locator('.sheet')).toContainText('unknown exercise "nope-curl"');
});

test('Flow I: PWA works offline, data survives reload, and nothing leaves the device', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173')) external.push(r.url());
  });
  await boot(page, TUESDAY);
  await onboard(page);
  await page.getByRole('button', { name: 'BOXING DONE ✓' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'SKIP' }).click();

  // wait for the service worker to control the page, then go offline
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'THIS WEEK' })).toBeVisible();
  await expect(page.getByText('BOXING LOGGED ✓')).toBeVisible();
  await page.getByRole('button', { name: 'START STRENGTH A' }).click();
  await expect(page.getByText('DUMBBELL BULGARIAN SPLIT SQUAT')).toBeVisible();
  await context.setOffline(false);

  expect(external).toEqual([]);
});
