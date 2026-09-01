import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const TUESDAY = new Date('2026-09-01T10:00:00'); // Strength A day
const MONDAY = new Date('2026-08-31T10:00:00'); // Boxing day

async function boot(page: Page, time: Date) {
  await page.clock.install({ time });
  await page.goto('/');
}

async function onboard(page: Page) {
  await page.getByRole('button', { name: 'PROGRAM 01' }).click();
  await page.getByRole('button', { name: "LET'S GO" }).click();
  await expect(page.getByText('THIS WEEK')).toBeVisible();
}

async function dismissRest(page: Page) {
  const skip = page.locator('.rest-bar').getByRole('button', { name: 'SKIP' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const ok = page.locator('.rest-bar').getByRole('button', { name: 'OK' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
}

/** Log every remaining set at the top of the rep range (first `.max` grid button = repMax). */
async function crushAllSets(page: Page) {
  for (let guard = 0; guard < 60; guard++) {
    if (await page.getByRole('button', { name: /COMPLETE WORKOUT/ }).isVisible().catch(() => false)) return;
    await dismissRest(page);
    const next = page.locator('.set-row--next').first();
    await next.waitFor({ state: 'visible', timeout: 5000 });
    await next.click();
    await page.locator('.rep-grid button.max').first().click();
    await page.waitForTimeout(450); // allow auto-advance
  }
  throw new Error('never finished workout');
}

test('Flow A+B: full workout, progression, calendar, history, next-session suggestion', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);

  // Today screen shows the planned strength session
  await expect(page.getByText('TUESDAY')).toBeVisible();
  await expect(page.getByText('STRENGTH A')).toBeVisible();

  await page.getByRole('button', { name: 'START WORKOUT' }).click();

  // First exercise, no previous data
  await expect(page.getByText('DUMBBELL BULGARIAN SPLIT SQUAT')).toBeVisible();
  await expect(page.getByText('FIRST TIME')).toBeVisible();

  // Log set 1 at top of range → rest timer starts automatically
  await page.locator('.set-row--next').first().click();
  await page.locator('.rep-grid button.max').first().click();
  await expect(page.locator('.rest-bar')).toBeVisible();
  await expect(page.locator('.rest-time')).toHaveText(/\d:\d\d/);

  // Timer completes visibly when time passes
  await page.clock.fastForward(125_000);
  await expect(page.getByText('REST COMPLETE')).toBeVisible();
  await dismissRest(page);

  // Crush everything at the top of each rep range
  await crushAllSets(page);
  await page.getByRole('button', { name: /COMPLETE WORKOUT/ }).click();

  // Completion overlay with progression
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible();
  await expect(page.getByText(/PROGRESSION ACHIEVED ON 7 EXERCISES/)).toBeVisible();
  await page.getByRole('button', { name: 'DONE' }).click();

  // Today shows complete + summary
  await expect(page.getByText('✓ COMPLETE')).toBeVisible();

  // Calendar shows the day completed
  await page.getByRole('button', { name: 'CALENDAR' }).click();
  await expect(page.getByRole('button', { name: '2026-09-01 completed' })).toBeVisible();

  // History shows the session
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('.list-row', { hasText: 'STRENGTH A' })).toBeVisible();

  // Flow B: next session suggests increased weight (split squat 20 → 25) and shows last performance
  await page.getByRole('button', { name: 'TODAY' }).click();
  await page.getByRole('button', { name: 'START A DIFFERENT SESSION' }).click();
  await page.locator('.sheet .list-row', { hasText: 'STRENGTH A' }).click();
  await expect(page.getByText('DUMBBELL BULGARIAN SPLIT SQUAT')).toBeVisible();
  await expect(page.locator('.weight-display')).toContainText('25');
  await expect(page.getByText(/LAST · 2026-09-01/)).toBeVisible();
  await expect(page.getByText('▲ progressed')).toBeVisible();
});

test('Flow B (failure case): mediocre workout keeps the weight', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);
  await page.getByRole('button', { name: 'START WORKOUT' }).click();

  // Log all 3 split squat sets below repMax (12): pick the repMin button (8)
  for (let i = 0; i < 3; i++) {
    await dismissRest(page);
    await page.locator('.set-row--next').first().click();
    await page.getByRole('button', { name: '8 reps', exact: true }).click();
    await page.waitForTimeout(450);
  }
  // Now on exercise 2 (auto-advanced); finish early
  await dismissRest(page);
  await page.getByRole('button', { name: /FINISH EARLY/ }).click();
  await page.getByRole('button', { name: 'FINISH', exact: true }).click();
  await expect(page.getByText('SESSION COMPLETE')).toBeVisible();
  await expect(page.getByText(/KEEP 20/)).toBeVisible();
  await page.getByRole('button', { name: 'DONE' }).click();

  // Next session: same 20 lb suggestion
  await page.getByRole('button', { name: 'START A DIFFERENT SESSION' }).click();
  await page.locator('.sheet .list-row', { hasText: 'STRENGTH A' }).click();
  await expect(page.locator('.weight-display')).toContainText('20');
});

test('Flow C: boxing day is one tap and lands on the calendar', async ({ page }) => {
  await boot(page, MONDAY);
  await onboard(page);
  await expect(page.getByText('MONDAY')).toBeVisible();
  await expect(page.locator('.today-hero').getByText('BOXING')).toBeVisible();

  await page.getByRole('button', { name: 'ATTENDED' }).click();
  await expect(page.getByText('✓ COMPLETE')).toBeVisible();
  await expect(page.getByText('Session logged')).toBeVisible();

  await page.getByRole('button', { name: 'CALENDAR' }).click();
  await expect(page.getByRole('button', { name: '2026-08-31 completed' })).toBeVisible();

  // Undo works
  await page.getByRole('button', { name: 'TODAY' }).click();
  await page.getByRole('button', { name: 'UNDO' }).click();
  await expect(page.getByRole('button', { name: 'ATTENDED' })).toBeVisible();
});

test('Flow D+E: body weight persists across reload and averages', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);

  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  await page.getByLabel('body weight (lb)').fill('181.5');
  await page.getByRole('button', { name: 'SAVE' }).click();
  await expect(page.locator('.stat', { hasText: 'LATEST' })).toContainText('181.5');
  await expect(page.locator('.stat', { hasText: 'AVG' })).toContainText('181.5');

  // Reload: data persists (IndexedDB)
  await page.waitForTimeout(300); // let the write-through commit
  await page.reload();
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  await expect(page.locator('.stat', { hasText: 'LATEST' })).toContainText('181.5');
});

test('Flow E: mid-workout sets survive reload and can be resumed', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);
  await page.getByRole('button', { name: 'START WORKOUT' }).click();
  await page.locator('.set-row--next').first().click();
  await page.getByRole('button', { name: '10 reps', exact: true }).click();

  await page.waitForTimeout(300); // let the write-through commit
  await page.reload();
  await page.getByRole('button', { name: 'RESUME WORKOUT' }).click();
  await expect(page.locator('.set-row--done .set-value')).toHaveText('10');
});

test('Flow F: export backup, wipe, import reconstructs data', async ({ page }) => {
  await boot(page, TUESDAY);
  await onboard(page);

  // create some data
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
  expect(backup.measurements).toHaveLength(1);
  expect(backup.measurements[0].weightLb).toBe(179);
  await page.getByRole('button', { name: 'OK' }).click();

  // wipe (guarded reset)
  await page.getByRole('button', { name: 'RESET ALL DATA' }).click();
  await page.getByPlaceholder('type RESET').fill('RESET');
  await page.getByRole('button', { name: 'WIPE EVERYTHING' }).click();
  await expect(page.getByRole('button', { name: 'PROGRAM 01' })).toBeVisible();

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
  await expect(page.locator('.stat', { hasText: 'LATEST' })).toContainText('179');
});
