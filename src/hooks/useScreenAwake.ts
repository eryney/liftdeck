import { useEffect, useRef, useState } from 'react';
import { ScreenAwake } from '../lib/wakeLock';
import type { ScreenLockAPI, WakeStatus } from '../lib/wakeLock';

export function useScreenAwake(enabled: boolean) {
  const [status, setStatus] = useState<WakeStatus>('off');
  const controller = useRef<ScreenAwake | null>(null);
  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: ScreenLockAPI }).wakeLock;
    const awake = new ScreenAwake(api, () => document.visibilityState === 'visible', setStatus);
    controller.current = awake;
    document.addEventListener('visibilitychange', awake.sync);
    document.addEventListener('pointerdown', awake.sync, { passive: true });
    window.addEventListener('pageshow', awake.sync);
    awake.setEnabled(enabled);
    return () => {
      document.removeEventListener('visibilitychange', awake.sync);
      document.removeEventListener('pointerdown', awake.sync);
      window.removeEventListener('pageshow', awake.sync);
      awake.dispose();
      controller.current = null;
    };
  }, [enabled]);
  return { status, retry: () => controller.current?.sync() };
}
