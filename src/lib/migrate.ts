import type { AppSettings, BackupFile, WorkoutPlan } from '../types';
import { SCHEMA_VERSION } from '../types';
import { defaultSettings } from './db';

/**
 * Application-level schema migrations. All v2 fields are optional additions, so v1 records
 * stay valid as-is; migrations only fill settings defaults and bump the version. Historical
 * sessions are never rewritten.
 */

export function migrateSettings(s: Partial<AppSettings> | undefined): AppSettings {
  const base = defaultSettings();
  const merged: AppSettings = { ...base, ...(s ?? {}), id: 'settings' };
  merged.schemaVersion = SCHEMA_VERSION;
  if (!Array.isArray(merged.seedMarkers)) merged.seedMarkers = [];
  return merged;
}

/** Plans without `mode` are fixed plans; leave them untouched (no field is added, so the record stays identical). */
export function normalizePlan(p: WorkoutPlan): WorkoutPlan {
  return p;
}

export function migrateBackup(b: BackupFile): BackupFile {
  if (b.schemaVersion >= SCHEMA_VERSION) return b;
  // v1 → v2: nothing structural changes. Settings get new optional defaults; everything else is byte-identical.
  return {
    ...b,
    schemaVersion: SCHEMA_VERSION,
    settings: migrateSettings(b.settings),
    plans: b.plans.map(normalizePlan),
  };
}
