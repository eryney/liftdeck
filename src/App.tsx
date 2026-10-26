import { useEffect, useState } from 'react';
import { store, useAppState } from './store/store';
import { TodayScreen } from './screens/TodayScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { ChainsScreen } from './screens/ChainsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { Onboarding } from './screens/Onboarding';
import { RestTimerBar } from './components/RestTimerBar';
import { IconChains, IconHistory, IconSettings, IconToday } from './components/Icons';

type Tab = 'today' | 'chains' | 'history' | 'settings';

const TABS: { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: 'today', label: 'Today', icon: IconToday },
  { id: 'chains', label: 'Chains', icon: IconChains },
  { id: 'history', label: 'History', icon: IconHistory },
  { id: 'settings', label: 'Settings', icon: IconSettings },
];

export default function App() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('today');
  const [workoutId, setWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    void store.init();
  }, []);

  if (!state.ready) {
    return (
      <div className="screen center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="muted">Loading…</div>
      </div>
    );
  }

  if (!state.settings.onboarded) {
    return <Onboarding onDone={() => setTab('today')} />;
  }

  if (workoutId) {
    return (
      <>
        <WorkoutScreen sessionId={workoutId} onExit={() => setWorkoutId(null)} />
        {state.restTimer && <RestTimerBar timer={state.restTimer} solo />}
      </>
    );
  }

  return (
    <>
      {tab === 'today' && <TodayScreen onOpenWorkout={setWorkoutId} />}
      {tab === 'chains' && <ChainsScreen />}
      {tab === 'history' && <HistoryScreen />}
      {tab === 'settings' && <SettingsScreen />}

      {state.restTimer && <RestTimerBar timer={state.restTimer} />}

      <nav className="nav" aria-label="primary">
        <div className="nav__inner">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} aria-label={t.label}>
              <t.icon />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
