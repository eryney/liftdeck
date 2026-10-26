import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const TUESDAY = new Date('2026-09-01T10:00:00');

async function boot(page: Page, time: Date = TUESDAY) {
  await page.clock.install({ time });
  await page.goto('/');
}

async function onboard(page: Page, calibrate = false) {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Where are you starting?' })).toBeVisible();
  if (calibrate) await page.getByRole('button', { name: 'Set my starting rungs' }).click();
  else await page.getByRole('button', { name: 'Skip, use the defaults' }).click();
  await expect(page.getByTestId('recommended')).toBeVisible();
}

const exName = (page: Page) => page.locator('h2.ex-name');
const tab = (page: Page, name: string) => page.locator('nav').getByRole('button', { name, exact: true });

/** Walk prev/next until the exercise card shows `exercise`. */
async function goTo(page: Page, exercise: string) {
  for (let guard = 0; guard < 12; guard++) {
    if ((await exName(page).textContent()) === exercise) return;
    const next = page.getByRole('button', { name: 'next exercise' });
    const prev = page.getByRole('button', { name: 'previous exercise' });
    // try forward first, fall back to backward at the end
    if (await next.isEnabled()) await next.click();
    else await prev.click();
    await page.waitForTimeout(50);
    if ((await exName(page).textContent()) === exercise) return;
    if (!(await next.isEnabled())) {
      // walk back to the start
      while (await prev.isEnabled()) {
        await prev.click();
        if ((await exName(page).textContent()) === exercise) return;
      }
    }
  }
  throw new Error(`never reached ${exercise}`);
}

async function dismissOverlays(page: Page) {
  const skip = page.getByTestId('rest-bar').getByRole('button', { name: 'Skip' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  const ok = page.getByTestId('rest-bar').getByRole('button', { name: 'OK' });
  if (await ok.isVisible().catch(() => false)) await ok.click();
}

/** Log every remaining set at the ceiling of its range (the grid button marked .max). */
async function crushAllSets(page: Page) {
  for (let guard = 0; guard < 60; guard++) {
    await dismissOverlays(page);
    if (await page.getByRole('button', { name: /Complete workout/ }).isVisible().catch(() => false)) return;
    const next = page.locator('.set-row--next .set-row__main').first();
    await next.waitFor({ state: 'visible', timeout: 5000 });
    await next.click();
    await page.locator('.rep-grid button.max').first().click();
    await page.waitForTimeout(450); // allow auto-advance
  }
  throw new Error('never finished workout');
}

/** Log the current exercise's next set with an exact number via the picker, then return to it if the pair moved us. */
async function logOn(page: Page, exercise: string, reps: number) {
  await dismissOverlays(page);
  await goTo(page, exercise);
  await page.locator('.set-row--next .set-row__main').first().click();
  await page.getByRole('button', { name: `${reps} reps`, exact: true }).click();
  await page.waitForTimeout(450);
  await dismissOverlays(page);
  await goTo(page, exercise);
}

test('Upper A end to end: pairing, exact targets, chain advance, chains view, next session rung', async ({ page }) => {
  await boot(page);
  await onboard(page);

  // Today: the first session of the rotation, with a full preview
  await expect(page.getByTestId('recommended')).toContainText('Next up');
  await expect(page.getByTestId('recommended')).toContainText('Upper A');
  await expect(page.getByTestId('week-dots')).toHaveAttribute('aria-label', '0 of 4 sessions this week');
  await expect(page.getByTestId('preview')).toContainText('Pull-up');
  await expect(page.getByTestId('preview')).toContainText('Pull-up · rung 4 of 9');
  await expect(page.getByTestId('preview')).toContainText('5 · 5 · 5');
  await expect(page.getByTestId('preview')).toContainText('Tuck front lever');
  await expect(page.getByTestId('preview')).toContainText('10s · 10s · 10s');

  await page.getByRole('button', { name: 'Start Upper A' }).click();

  // warm-up, first rung, chain position, pairing
  await expect(page.getByTestId('warmup')).toContainText('Bear crawl');
  await expect(exName(page)).toHaveText('Pull-up');
  await expect(page.getByTestId('chain')).toContainText('Pull-up chain · rung 4 of 9');
  await expect(page.getByTestId('chain-basis')).toContainText('Starting rung');
  await expect(page.getByTestId('pair-note')).toContainText('Paired with Push-up');
  await expect(page.locator('.cue')).toContainText('Dead-hang start');
  await expect(page.getByTestId('targets')).toContainText('5 · 5 · 5');
  await expect(page.getByText('First time · no previous data')).toBeVisible();

  // ✓ logs the target in one tap, starts the rest timer, and flips to the paired exercise
  await page.getByRole('button', { name: 'hit 5' }).click();
  await expect(page.getByTestId('rest-bar')).toBeVisible();
  await expect(exName(page)).toHaveText('Push-up');
  await expect(page.getByTestId('chain')).toContainText('Push-up chain · rung 2 of 8');
  await page.getByRole('button', { name: 'previous exercise' }).click();
  await expect(page.locator('.set-row--done .set-row__value')).toHaveText('5');
  await page.getByRole('button', { name: 'next exercise' }).click();

  await page.getByTestId('rest-bar').getByRole('button', { name: 'Skip' }).click();
  await crushAllSets(page);
  await page.getByRole('button', { name: /Complete workout/ }).click();

  // completion: pull-ups 5, 8, 8 hit their targets but not the ceiling → hold; the other six chains advance
  await expect(page.getByRole('heading', { name: 'Upper A ✓' })).toBeVisible();
  await expect(page.locator('.complete-card')).toContainText('6 chains advanced');
  await expect(page.locator('.complete-card')).toContainText('next: Diamond push-up');
  await expect(page.locator('.complete-card')).toContainText('Hold');
  await expect(page.locator('.complete-card')).not.toContainText(/fail/i);
  await page.getByRole('button', { name: 'Done' }).click();

  // Today reflects it
  await expect(page.getByText('Done today')).toBeVisible();
  await expect(page.getByTestId('week-dots')).toHaveAttribute('aria-label', '1 of 4 sessions this week');
  await expect(page.getByTestId('recommended')).toContainText('Rest');
  await expect(page.getByTestId('recommended')).toContainText('Done for today');

  // Chains: push-up chain now points at rung 3, pull-up chain still at rung 4
  await tab(page, 'Chains').click();
  await expect(page.getByTestId('chain-push')).toContainText('Rung 3 of 8 · Diamond push-up');
  await expect(page.getByTestId('chain-push')).toContainText('new rung next');
  await expect(page.getByTestId('chain-pull')).toContainText('Rung 4 of 9 · Pull-up');
  await page.getByTestId('chain-push').click();
  await expect(page.getByRole('heading', { name: 'Push-up chain' })).toBeVisible();
  await expect(page.locator('.rung--now')).toContainText('Diamond push-up');
  await expect(page.locator('.rung--past', { hasText: 'best 8, 8, 8' })).toContainText('Push-up');
  await page.getByRole('button', { name: '‹ Chains' }).click();

  // History: the day is marked
  await tab(page, 'History').click();
  await page.getByRole('button', { name: '2026-09-01, Upper A' }).click();
  await expect(page.locator('.sheet')).toContainText('Upper A');
  await expect(page.locator('.sheet')).toContainText('Advance');
  await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });

  // Next Upper A: pull-ups hold with +1 per set (clamped at the ceiling); push chain serves the new rung
  await tab(page, 'Today').click();
  await page.getByRole('button', { name: 'Start something else…' }).click();
  await page.locator('.sheet .list-row', { hasText: 'Upper A' }).click();
  await expect(exName(page)).toHaveText('Pull-up');
  await expect(page.getByTestId('chain-basis')).toContainText('Same rung');
  await expect(page.getByTestId('targets')).toContainText('6 · 8 · 8');
  await page.getByRole('button', { name: 'next exercise' }).click();
  await expect(exName(page)).toHaveText('Diamond push-up');
  await expect(page.getByTestId('chain-basis')).toContainText('New rung');
  await expect(page.getByText(/First time on this rung/)).toBeVisible();
  await expect(page.getByTestId('targets')).toContainText('5 · 5 · 5');
});

test('a mediocre session holds the rung in neutral language; the next session asks for one more rep', async ({ page }) => {
  await boot(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Start Upper A' }).click();
  for (let i = 0; i < 3; i++) {
    await logOn(page, 'Pull-up', 5);
    await logOn(page, 'Push-up', 5);
  }
  await dismissOverlays(page);
  await page.getByRole('button', { name: /Finish early/ }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Upper A ✓' })).toBeVisible();
  await expect(page.locator('.complete-card')).toContainText('Hold');
  await expect(page.locator('.complete-card')).toContainText('same rung');
  await expect(page.locator('.complete-card')).not.toContainText(/fail|step back/i);
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Start something else…' }).click();
  await page.locator('.sheet .list-row', { hasText: 'Upper A' }).click();
  await expect(exName(page)).toHaveText('Pull-up');
  await expect(page.getByTestId('chain-basis')).toContainText('Same rung');
  await expect(page.getByTestId('targets')).toContainText('6 · 6 · 6');
});

test('three flat sessions flag a stall; a one-tap deload drops the targets to the floor', async ({ page }) => {
  await boot(page);
  await onboard(page);
  for (let s = 0; s < 3; s++) {
    if (s === 0) await page.getByRole('button', { name: 'Start Upper A' }).click();
    else {
      await page.getByRole('button', { name: 'Start something else…' }).click();
      await page.locator('.sheet .list-row', { hasText: 'Upper A' }).click();
    }
    await expect(page.getByTestId('stall')).toHaveCount(0);
    await logOn(page, 'Pull-up', 6);
    await logOn(page, 'Pull-up', 6);
    await logOn(page, 'Pull-up', 5);
    await dismissOverlays(page);
    await page.getByRole('button', { name: /Finish early/ }).click();
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
  }
  await tab(page, 'Chains').click();
  await expect(page.getByTestId('chain-pull')).toContainText('stalled');
  await tab(page, 'Today').click();
  await page.getByRole('button', { name: 'Start something else…' }).click();
  await page.locator('.sheet .list-row', { hasText: 'Upper A' }).click();
  await expect(page.getByTestId('stall')).toContainText('Stalled · 3 sessions without progress');
  await expect(page.getByTestId('stall')).toContainText('17 → 17');
  await expect(page.getByTestId('targets')).toContainText('6 · 6 · 6');
  await page.getByTestId('stall').getByRole('button', { name: 'Deload today' }).click();
  await expect(page.getByTestId('deload')).toContainText('Deload session');
  await expect(page.getByTestId('targets')).toContainText('5 · 5 · 5');
  await expect(page.getByTestId('stall')).toHaveCount(0);
  // undo brings the ordinary targets back
  await page.getByTestId('deload').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('targets')).toContainText('6 · 6 · 6');
  // the other way out
  await page.getByTestId('stall').getByRole('button', { name: 'Easier rung' }).click();
  await expect(exName(page)).toHaveText('Band-assisted pull-up');
  await expect(page.getByTestId('chain-basis')).toContainText('You picked this rung');
});

test('step up/down by hand before the first set; timed holds run a countdown and log seconds', async ({ page }) => {
  await boot(page);
  await onboard(page);
  await page.getByRole('button', { name: 'Start Upper A' }).click();
  await page.getByRole('button', { name: '↑ Harder' }).click();
  await expect(exName(page)).toHaveText('Archer pull-up');
  await expect(page.getByTestId('chain-basis')).toContainText('You picked this rung');
  await page.getByRole('button', { name: '↓ Easier' }).click();
  await page.getByRole('button', { name: '↓ Easier' }).click();
  await expect(exName(page)).toHaveText('Band-assisted pull-up');
  await expect(page.getByText('Needs: pull-up bar + band')).toBeVisible();
  await logOn(page, 'Band-assisted pull-up', 8);
  await expect(page.getByRole('button', { name: '↑ Harder' })).toBeDisabled();

  // timed rung: ▶ runs a countdown and logs the target when it ends
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'next exercise' }).click();
  await expect(exName(page)).toHaveText('Tuck front lever');
  await expect(page.getByTestId('targets')).toContainText('10s · 10s · 10s');
  await page.getByRole('button', { name: 'start hold 10 seconds' }).click();
  await expect(page.getByTestId('hold')).toBeVisible();
  await page.clock.fastForward(10_500);
  await page.waitForTimeout(400);
  await expect(exName(page)).toHaveText('Planche lean'); // the pair flipped
  await page.getByRole('button', { name: 'previous exercise' }).click();
  await expect(page.locator('.set-row--done .set-row__value')).toHaveText('10s');

  // leaving keeps the session open; it survives a reload
  await page.getByRole('button', { name: 'Exit' }).click();
  await page.getByRole('button', { name: 'Keep it open, resume later' }).click();
  await expect(page.getByTestId('recommended')).toContainText('In progress');
  await page.reload();
  await expect(page.getByTestId('recommended')).toContainText('In progress');
  await page.getByRole('button', { name: 'Resume workout' }).click();
  await expect(exName(page)).toHaveText('Band-assisted pull-up');
  await page.getByRole('button', { name: 'Exit' }).click();
  await page.getByRole('button', { name: 'Discard this workout' }).click();
  await expect(page.getByTestId('recommended')).toContainText('Next up');
});

test('calibration sets the starting rungs; settings edit the program; body weigh-ins trend', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('radio', { name: /None yet/ }).click();
  await page.getByRole('radio', { name: /0 to 4/ }).click();
  await page.getByRole('radio', { name: /Two-leg squats/ }).click();
  await page.getByRole('button', { name: 'Set my starting rungs' }).click();
  await expect(page.getByTestId('preview')).toContainText('Negative pull-up');
  await expect(page.getByTestId('preview')).toContainText('Incline push-up');
  await expect(page.getByTestId('preview')).toContainText('Pull-up · rung 2 of 9');

  // Settings → program → edit Lower A: it starts on bodyweight squats after calibration
  await tab(page, 'Settings').click();
  await page.locator('.list-row', { hasText: 'Lower A' }).click();
  await expect(page.locator('.list-row', { hasText: 'Bodyweight squat' })).toBeVisible();
  await page.locator('.list-row', { hasText: 'Bodyweight squat' }).locator('button.grow').click();
  await expect(page.locator('.sheet')).toContainText('Squat chain · this is the starting rung only');
  await page.getByRole('button', { name: 'increase sets' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.list-row', { hasText: 'Bodyweight squat' })).toContainText('5 × 5–8');
  await page.getByRole('button', { name: '‹ Settings' }).click();
  await page.getByRole('button', { name: 'Weekly targets' }).click();
  await page.getByRole('button', { name: 'decrease target' }).click();
  await expect(page.locator('.sheet')).toContainText('3');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.card', { hasText: 'Bar Strength' })).toContainText('target 3');

  // History → weigh in
  await tab(page, 'History').click();
  await page.getByRole('button', { name: 'Weigh in' }).click();
  await page.getByLabel('weight in pounds').fill('181.4');
  await page.getByLabel('waist in inches').fill('34');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('181.4 lb')).toBeVisible();
  await expect(page.getByText(/Waist 34 in/)).toBeVisible();
  await tab(page, 'Today').click();
  await expect(page.locator('.stat', { hasText: '7-day average' })).toContainText('181.4');
});

test('works offline after first load', async ({ page, context }) => {
  await boot(page);
  await onboard(page);
  await page.waitForTimeout(1500); // let the service worker precache
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('recommended')).toContainText('Upper A');
  await context.setOffline(false);
});
