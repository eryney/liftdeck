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
  await page.getByRole('button', { name: 'PROGRAM 01' }).click();
  await page.screenshot({ path: `${OUT}/02-schedule-preview.png` });
  await page.getByRole('button', { name: "LET'S GO" }).click();
  await page.screenshot({ path: `${OUT}/03-today.png` });

  await page.getByRole('button', { name: 'START WORKOUT' }).click();
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
  await page.screenshot({ path: `${OUT}/10-today-complete.png` });

  // body weight entries for chart
  await page.getByRole('button', { name: 'PROGRESS' }).click();
  await page.getByRole('button', { name: 'BODY' }).click();
  for (const [d, w] of [
    ['2026-08-20', '184.0'], ['2026-08-22', '183.2'], ['2026-08-24', '183.6'],
    ['2026-08-26', '182.4'], ['2026-08-28', '182.8'], ['2026-08-30', '181.9'], ['2026-09-01', '181.5'],
  ]) {
    await page.getByLabel('body weight (lb)').fill(w);
    await page.getByLabel('date').fill(d);
    await page.getByRole('button', { name: 'SAVE' }).click();
  }
  await page.screenshot({ path: `${OUT}/11-body.png`, fullPage: true });

  await page.getByRole('button', { name: 'LIFTS' }).click();
  await page.screenshot({ path: `${OUT}/12-lifts.png`, fullPage: true });

  await page.getByRole('button', { name: 'CALENDAR' }).click();
  await page.screenshot({ path: `${OUT}/13-calendar.png` });
  await page.getByRole('button', { name: '2026-09-01 completed' }).click();
  await page.screenshot({ path: `${OUT}/14-day-sheet.png` });
  await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });

  await page.getByRole('button', { name: 'PLAN', exact: true }).click();
  await page.screenshot({ path: `${OUT}/15-plan.png`, fullPage: true });
  await page.locator('.list-row', { hasText: 'STRENGTH A' }).getByRole('button').first().click();
  await page.screenshot({ path: `${OUT}/16-template-editor.png`, fullPage: true });

  await page.getByRole('button', { name: 'SETTINGS' }).click();
  await page.screenshot({ path: `${OUT}/17-settings.png`, fullPage: true });
});
