import type { BackupFile } from '../types';
import { SCHEMA_VERSION } from '../types';
import type { DBShape } from './db';
import { defaultSettings } from './db';

export function buildBackup(data: DBShape): BackupFile {
  return {
    app: 'liftdeck',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: data.settings ?? defaultSettings(),
    exercises: data.exercises,
    templates: data.templates,
    plans: data.plans,
    sessions: data.sessions,
    boxing: data.boxing,
    measurements: data.measurements,
  };
}

export function parseBackup(text: string): BackupFile {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  const b = obj as Partial<BackupFile>;
  if (b.app !== 'liftdeck') throw new Error('This file is not a LIFTDECK backup.');
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Backup was made by a newer app version.');
  }
  for (const key of ['exercises', 'templates', 'plans', 'sessions', 'boxing', 'measurements'] as const) {
    if (!Array.isArray(b[key])) throw new Error(`Backup is missing "${key}".`);
  }
  if (!b.settings || typeof b.settings !== 'object') throw new Error('Backup is missing settings.');
  // future: migrate older schemaVersions here
  return b as BackupFile;
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sessionsToCSV(sessions: BackupFile['sessions']): string {
  const rows: string[] = ['date,workout,exercise,set,weight_lb,reps,result'];
  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  for (const s of sorted) {
    if (s.status !== 'completed') continue;
    for (const es of s.exercises) {
      es.sets.forEach((set, i) => {
        if (set.reps == null) return;
        rows.push(
          [s.date, s.name, es.name, i + 1, set.weight, set.reps, es.result ?? ''].map(csvEscape).join(','),
        );
      });
    }
  }
  return rows.join('\n');
}

export function measurementsToCSV(measurements: BackupFile['measurements']): string {
  const rows = ['date,weight_lb,waist_in'];
  const sorted = [...measurements].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const m of sorted) rows.push([m.date, m.weightLb, m.waistIn ?? ''].map(csvEscape).join(','));
  return rows.join('\n');
}

export function downloadFile(filename: string, content: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
