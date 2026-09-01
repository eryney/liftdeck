import { useRef, useState } from 'react';
import { store, useAppState } from '../store/store';
import { buildBackup, downloadFile, measurementsToCSV, parseBackup, sessionsToCSV } from '../lib/backup';
import { Confirm, Sheet } from '../components/Sheet';
import { todayISO } from '../lib/dates';
import { trimNum } from '../lib/format';

export function SettingsScreen() {
  const state = useAppState();
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [resetStage, setResetStage] = useState(0);
  const [resetText, setResetText] = useState('');
  const [note, setNote] = useState<string | null>(null);

  function toggle(key: 'soundOn' | 'vibrateOn') {
    store.updateSettings({ [key]: !s[key] });
  }

  function numRow(label: string, key: 'defaultIncrement' | 'compoundRestSec' | 'isolationRestSec' | 'maWindowDays', step: number, min: number) {
    return (
      <div className="spread mt8 panel" style={{ padding: '8px 14px' }}>
        <span className="small">{label}</span>
        <div className="stepper">
          <button style={{ width: 44, height: 44 }} onClick={() => store.updateSettings({ [key]: Math.max(min, s[key] - step) })}>
            −
          </button>
          <span style={{ minWidth: 48, textAlign: 'center', fontWeight: 800 }}>{trimNum(s[key])}</span>
          <button style={{ width: 44, height: 44 }} onClick={() => store.updateSettings({ [key]: s[key] + step })}>
            +
          </button>
        </div>
      </div>
    );
  }

  function exportJSON() {
    const backup = buildBackup(store.exportShape());
    downloadFile(`liftdeck-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2));
    setNote('Backup exported.');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      parseBackup(text); // validate before asking to replace
      setImportPending(text);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read file.');
    }
  }

  return (
    <div className="screen">
      <div className="topline">SYSTEM</div>
      <h1 className="title">SETTINGS</h1>

      <h2 className="section">TIMERS + PROGRESSION</h2>
      {numRow('DEFAULT INCREMENT (LB)', 'defaultIncrement', 2.5, 2.5)}
      {numRow('COMPOUND REST (SEC)', 'compoundRestSec', 15, 30)}
      {numRow('ISOLATION REST (SEC)', 'isolationRestSec', 15, 30)}
      {numRow('BODY AVG WINDOW (DAYS)', 'maWindowDays', 1, 3)}

      <h2 className="section">FEEDBACK</h2>
      <div className="spread panel mt8" style={{ padding: '10px 14px' }}>
        <span className="small">TIMER SOUND</span>
        <button className={`toggle ${s.soundOn ? 'on' : ''}`} onClick={() => toggle('soundOn')} aria-label="toggle sound">
          <i />
        </button>
      </div>
      <div className="spread panel mt8" style={{ padding: '10px 14px' }}>
        <span className="small">VIBRATION (if supported)</span>
        <button className={`toggle ${s.vibrateOn ? 'on' : ''}`} onClick={() => toggle('vibrateOn')} aria-label="toggle vibration">
          <i />
        </button>
      </div>

      <h2 className="section">DATA</h2>
      <div className="panel">
        <div className="tiny dim" style={{ lineHeight: 1.6 }}>
          All data lives on this device only — there's no cloud account. Export a backup now and then
          (after a good training week, say) and stash it somewhere safe.
        </div>
        <button className="btn mt16" style={{ width: '100%' }} onClick={exportJSON}>
          EXPORT BACKUP (JSON)
        </button>
        <button className="btn mt8" style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
          IMPORT BACKUP…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        <div className="row mt8" style={{ gap: 8 }}>
          <button
            className="btn btn--ghost"
            style={{ flex: 1 }}
            onClick={() => {
              downloadFile(`liftdeck-workouts-${todayISO()}.csv`, sessionsToCSV(store.state.sessions), 'text/csv');
              setNote('Workout CSV exported.');
            }}
          >
            WORKOUTS CSV
          </button>
          <button
            className="btn btn--ghost"
            style={{ flex: 1 }}
            onClick={() => {
              downloadFile(`liftdeck-body-${todayISO()}.csv`, measurementsToCSV(store.state.measurements), 'text/csv');
              setNote('Body CSV exported.');
            }}
          >
            BODY CSV
          </button>
        </div>
      </div>

      <h2 className="section">DANGER ZONE</h2>
      <button className="btn btn--danger" style={{ width: '100%' }} onClick={() => setResetStage(1)}>
        RESET ALL DATA
      </button>

      <div className="center faint tiny mt16">
        LIFTDECK v1.0 · {state.sessions.filter((x) => x.status === 'completed').length} workouts ·{' '}
        {state.boxing.length} boxing sessions on record
      </div>

      {note && (
        <Sheet onClose={() => setNote(null)}>
          <div className="green small">{note}</div>
          <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setNote(null)}>
            OK
          </button>
        </Sheet>
      )}

      {importError && (
        <Sheet onClose={() => setImportError(null)}>
          <div className="red small">IMPORT FAILED: {importError}</div>
          <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setImportError(null)}>
            OK
          </button>
        </Sheet>
      )}

      {importPending && (
        <Confirm
          title="Replace all data with this backup?"
          body="Your current data will be overwritten. Consider exporting first."
          confirmLabel="IMPORT"
          danger
          onConfirm={async () => {
            const backup = parseBackup(importPending);
            setImportPending(null);
            await store.importBackup(backup);
            setNote('Backup imported.');
          }}
          onCancel={() => setImportPending(null)}
        />
      )}

      {resetStage === 1 && (
        <Sheet onClose={() => setResetStage(0)}>
          <div className="red" style={{ fontWeight: 800, letterSpacing: '0.1em' }}>
            RESET ALL DATA
          </div>
          <p className="dim small">
            This permanently deletes every workout, boxing session, and measurement on this device. Type{' '}
            <span className="red">RESET</span> to confirm.
          </p>
          <input value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="type RESET" autoFocus />
          <div className="row mt16" style={{ gap: 10 }}>
            <button
              className="btn btn--ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setResetStage(0);
                setResetText('');
              }}
            >
              CANCEL
            </button>
            <button
              className="btn btn--danger"
              style={{ flex: 1 }}
              disabled={resetText.trim().toUpperCase() !== 'RESET'}
              onClick={async () => {
                setResetStage(0);
                setResetText('');
                await store.resetAll();
              }}
            >
              WIPE EVERYTHING
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
