import { openDB, type IDBPDatabase } from 'idb';
import type {
  AppSettings, BodyMeasurement, BoxingAttendance, Exercise,
  WorkoutPlan, WorkoutSession, WorkoutTemplate,
} from '../types';
import { SCHEMA_VERSION } from '../types';
import { todayISO } from './dates';

const DB_NAME = 'liftdeck';
const DB_VERSION = 1; // IndexedDB structural version; bump + migrate in upgrade() when stores change

export interface DBShape {
  settings: AppSettings | undefined;
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  boxing: BoxingAttendance[];
  measurements: BodyMeasurement[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('settings', { keyPath: 'id' });
          db.createObjectStore('exercises', { keyPath: 'id' });
          db.createObjectStore('templates', { keyPath: 'id' });
          db.createObjectStore('plans', { keyPath: 'id' });
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('date', 'date');
          const boxing = db.createObjectStore('boxing', { keyPath: 'id' });
          boxing.createIndex('date', 'date');
          const meas = db.createObjectStore('measurements', { keyPath: 'id' });
          meas.createIndex('date', 'date');
        }
        // future migrations: if (oldVersion < 2) { ... }
      },
    });
  }
  return dbPromise;
}

export function defaultSettings(): AppSettings {
  return {
    id: 'settings',
    schemaVersion: SCHEMA_VERSION,
    onboarded: false,
    activePlanId: null,
    startDate: todayISO(),
    units: 'lb',
    defaultIncrement: 5,
    compoundRestSec: 120,
    isolationRestSec: 90,
    maWindowDays: 7,
    soundOn: true,
    vibrateOn: true,
  };
}

export async function loadAll(): Promise<DBShape> {
  const db = await getDB();
  const [settings, exercises, templates, plans, sessions, boxing, measurements] = await Promise.all([
    db.get('settings', 'settings'),
    db.getAll('exercises'),
    db.getAll('templates'),
    db.getAll('plans'),
    db.getAll('sessions'),
    db.getAll('boxing'),
    db.getAll('measurements'),
  ]);
  return { settings, exercises, templates, plans, sessions, boxing, measurements };
}

export async function put(store: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put(store, value);
}

export async function del(store: string, key: string): Promise<void> {
  const db = await getDB();
  await db.delete(store, key);
}

export async function bulkPut(store: string, values: unknown[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(store, 'readwrite');
  await Promise.all(values.map((v) => tx.store.put(v)));
  await tx.done;
}

export async function clearAllStores(): Promise<void> {
  const db = await getDB();
  const names = ['settings', 'exercises', 'templates', 'plans', 'sessions', 'boxing', 'measurements'];
  const tx = db.transaction(names, 'readwrite');
  await Promise.all(names.map((n) => tx.objectStore(n).clear()));
  await tx.done;
}
