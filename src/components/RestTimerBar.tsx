import { useEffect, useRef, useState } from 'react';
import { store } from '../store/store';
import type { RestTimer } from '../store/store';
import { formatClock } from '../lib/dates';
import { beepTimerDone, vibrate } from '../lib/sound';

export function RestTimerBar({ timer, solo }: { timer: RestTimer; solo?: boolean }) {
  const [now, setNow] = useState(Date.now());
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(iv);
  }, []);

  const remaining = Math.max(0, (timer.endsAt - now) / 1000);
  const done = remaining <= 0;

  useEffect(() => {
    if (done && firedFor.current !== timer.key) {
      firedFor.current = timer.key;
      const { soundOn, vibrateOn } = store.state.settings;
      if (soundOn) beepTimerDone();
      if (vibrateOn) vibrate([120, 80, 120, 80, 240]);
    }
  }, [done, timer.key]);

  const pct = Math.min(100, ((timer.totalSec - remaining) / timer.totalSec) * 100);

  return (
    <div className={`rest-bar ${solo ? 'rest-bar--solo' : ''}`} data-testid="rest-bar">
      <div className={`rest-bar__inner ${done ? 'done' : ''}`}>
        {done ? (
          <>
            <div className="rest-time green">Go</div>
            <div className="green small bold grow">Rest done</div>
            <button className="btn btn--small btn--ghost" onClick={() => store.clearRest()}>
              OK
            </button>
          </>
        ) : (
          <>
            <div className="rest-time">{formatClock(remaining)}</div>
            <div className="rest-track" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </div>
            <button className="btn btn--small btn--ghost" onClick={() => store.extendRest(30)}>
              +30
            </button>
            <button className="btn btn--small btn--ghost" onClick={() => store.clearRest()}>
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
