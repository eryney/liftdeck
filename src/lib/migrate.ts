import type { AppSettings, BackupFile, WorkoutPlan } from '../types';
import { SCHEMA_VERSION } from '../types';
import { defaultSettings } from './db';

/**
 * Application-level schema migrations. Historical sessions are never rewritten.
 *
 * v4 dropped boxing attendance, fixed weekday plans and the gym-equipment library. A backup from an
 * older version is accepted: its boxing records are ignored, fixed plans are dropped (the store then
 * activates the bundled program), and settings keys that no longer exist are left alone.
 */

export function migrateSettings(s: Partial<AppSettings> | undefined): AppSettings {
  const base = defaultSettings();
  const merged = { ...base, ...(s ?? {}), id: 'settings' } as AppSettings;
  merged.schemaVersion = SCHEMA_VERSION;
  if (!Array.isArray(merged.seedMarkers)) merged.seedMarkers = [];
  if (merged.units !== 'kg') merged.units = 'lb';
  if (typeof merged.maWindowDays !== 'number' || merged.maWindowDays < 1) merged.maWindowDays = base.maWindowDays;
  return merged;
}

/** Keep only weekly-goal plans; strip goal kinds (boxing) that no longer exist. */
export function normalizePlans(plans: unknown[]): WorkoutPlan[] {
  const out: WorkoutPlan[] = [];
  for (const p of plans) {
    const plan = p as Partial<WorkoutPlan> & { weeklyGoals?: Array<{ kind?: string }> };
    if (!plan || plan.mode !== 'flex' || !Array.isArray(plan.weeklyGoals) || typeof plan.id !== 'string') continue;
    const weeklyGoals = plan.weeklyGoals.filter((g) => g.kind === 'rotation' || g.kind === 'workout') as WorkoutPlan['weeklyGoals'];
    out.push({ id: plan.id, name: String(plan.name ?? 'Program'), mode: 'flex', weeklyGoals });
  }
  return out;
}

export function migrateBackup(b: BackupFile & { boxing?: unknown }): BackupFile {
  const { boxing: _boxing, ...rest } = b;
  return {
    ...rest,
    schemaVersion: SCHEMA_VERSION,
    settings: migrateSettings(b.settings),
    plans: normalizePlans(b.plans ?? []),
    measurements: Array.isArray(b.measurements) ? b.measurements : [],
  };
}
