import { useEffect, useState } from 'react';
import { store, useAppState } from './store/store';
import { TodayScreen } from './screens/TodayScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { PlanScreen } from './screens/PlanScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { Onboarding } from './screens/Onboarding';
import { RestTimerBar } from './components/RestTimerBar';
import { IconCalendar, IconPlan, IconProgress, IconSettings, IconToday } from './components/Icons';

type Tab = 'today' | 'calendar' | 'progress' | 'plan' | 'settings';

const TABS: { id: Tab; label: string; icon: () => JSX.Element }[] = [
  { id: 'today', label: 'TODAY', icon: IconToday },
  { id: 'calendar', label: 'CALENDAR', icon: IconCalendar },
  { id: 'progress', label: 'PROGRESS', icon: IconProgress },
  { id: 'plan', label: 'PLAN', icon: IconPlan },
  { id: 'settings', label: 'SETTINGS', icon: IconSettings },
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
        <div className="cyan blink" style={{ letterSpacing: '0.3em' }}>LOADING…</div>
      </div>
    );
  }

  if (!state.settings.onboarded) {
    return (
      <Onboarding
        onDone={(goToPlan) => {
          setTab(goToPlan ? 'plan' : 'today');
        }}
      />
    );
  }

  if (workoutId) {
    return (
      <>
        <WorkoutScreen sessionId={workoutId} onExit={() => setWorkoutId(null)} />
        {state.restTimer && <RestTimerBar timer={state.restTimer} />}
      </>
    );
  }

  return (
    <>
      {tab === 'today' && <TodayScreen onOpenWorkout={setWorkoutId} />}
      {tab === 'calendar' && <CalendarScreen />}
      {tab === 'progress' && <ProgressScreen />}
      {tab === 'plan' && <PlanScreen />}
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
