// Visual inspection helper: captures key screens to /tmp shots dir.
// Run: npx playwright test e2e/screens.shots.ts --config playwright.shots.config.ts
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.skip(!process.env.SHOT_DIR, 'screenshot capture: set SHOT_DIR to run');

const OUT = process.env.SHOT_DIR || 'shots';
const TUESDAY = new Date('2026-09-01T10:00:00');

async function boot(page: Page) {
  await page.clock.install({ time: TUESDAY });
  await page.goto('/');
}

test('capture screens', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  await page.screenshot({ path: `${OUT}/01-onboarding.png` });
  await page.getByRole('button', { name: 'BOXER CUT // FLEX' }).click();
  await page.screenshot({ path: `${OUT}/02-plan-preview.png` });
  await page.getByRole('button', { name: "LET'S GO" }).click();
  await page.screenshot({ path: `${OUT}/03-today.png`, fullPage: true });

  await page.getByRole('button', { name: 'START STRENGTH A' }).click();
  await page.screenshot({ path: `${OUT}/04-workout.png` });
  await page.locator('.set-row--next').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/05-rep-picker.png` });
  await page.locator('.rep-grid button.max').first().click();
  await page.screenshot({ path: `${OUT}/06-rest-timer.png` });
  await page.clock.fastForward(125_000);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/07-rest-done.png` });

  // finish everything
  for (let guard = 0; guard < 60; guard++) {
    const rirSkip = page.locator('.sheet').getByRole('button', { name: 'SKIP' });
    if (await rirSkip.isVisible().catch(() => false)) {
      await page.screenshot({ path: `${OUT}/07b-rir-prompt.png` });
      await rirSkip.click();
    }
    if (await page.getByRole('button', { name: /COMPLETE WORKOUT/ }).isVisible().catch(() => false)) break;
    const skip = page.locator('.rest-bar').getByRole('button', { name: 'SKIP' });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    const ok = page.locator('.rest-bar').getByRole('button', { name: 'OK' });
    if (await ok.isVisible().catch(() => false)) await ok.click();
    const next = page.locator('.set-row--next').first();
    await next.waitFor({ state: 'visible' });
    await next.click();
    await page.locator('.rep-grid button.max').first().click();
    await page.waitForTimeout(450);
  }
  await page.screenshot({ path: `${OUT}/08-workout-done-state.png` });
  await page.getByRole('button', { name: /COMPLETE WORKOUT/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/09-completion.png` });
  await page.getByRole('button', { name: 'DONE' }).click();
  await page.screenshot({ path: `${OUT}/10-today-complete.png`, fullPage: true });

  // boxing one tap + details
  await page.getByRole('button', { name: 'BOXING DONE ✓' }).click();
  await page.screenshot({ path: `${OUT}/10b-boxing-details.png` });
  await page.getByRole('button', { name: 'SPAR' }).click();
  await page.locator('.sheet').getByRole('button', { name: '60', exact: true }).click();
  await page.getByRole('button', { name: 'rpe 8' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'DONE' }).click();
  await page.screenshot({ path: `${OUT}/10c-today-boxed.png`, fullPage: true });

  // body weight entries for chart
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  for (const [d, w, waist] of [
    ['2026-08-04', '185.2', '36.2'], ['2026-08-08', '184.6', ''], ['2026-08-12', '184.1', '36'], ['2026-08-16', '183.5', ''],
    ['2026-08-20', '184.0', '35.8'], ['2026-08-22', '183.2', ''], ['2026-08-24', '183.6', '35.7'],
    ['2026-08-26', '182.4', ''], ['2026-08-28', '182.8', ''], ['2026-08-30', '181.9', '35.4'], ['2026-09-01', '181.5', ''],
  ]) {
    await page.getByLabel('body weight (lb)').fill(w);
    if (waist) await page.getByLabel('waist (inches)').fill(waist);
    await page.getByLabel('date').fill(d);
    await page.getByRole('button', { name: 'SAVE' }).click();
  }
  await page.screenshot({ path: `${OUT}/11-body.png`, fullPage: true });

  await page.getByRole('button', { name: 'OVERVIEW' }).click();
  await page.screenshot({ path: `${OUT}/11b-overview.png`, fullPage: true });
  await page.getByRole('button', { name: 'LIFTS' }).click();
  await page.screenshot({ path: `${OUT}/12-lifts.png`, fullPage: true });
  await page.getByRole('button', { name: 'BOXING', exact: true }).click();
  await page.screenshot({ path: `${OUT}/12b-boxing.png`, fullPage: true });

  await page.getByRole('button', { name: 'CALENDAR' }).click();
  await page.screenshot({ path: `${OUT}/13-calendar.png`, fullPage: true });
  await page.getByRole('button', { name: '2026-09-01 box a' }).click();
  await page.screenshot({ path: `${OUT}/14-day-sheet.png` });
  await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });

  await page.getByRole('button', { name: 'PLAN', exact: true }).click();
  await page.screenshot({ path: `${OUT}/15-plan.png`, fullPage: true });
  await page.locator('.list-row', { hasText: 'STRENGTH A' }).getByRole('button').first().click();
  await page.screenshot({ path: `${OUT}/16-template-editor.png`, fullPage: true });

  await page.getByRole('button', { name: 'SETTINGS' }).click();
  await page.screenshot({ path: `${OUT}/17-settings.png`, fullPage: true });
});
