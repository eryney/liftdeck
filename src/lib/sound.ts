/** Retro square-wave beeps via WebAudio. Degrades silently if unavailable. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a user gesture once so iOS unlocks audio for later timer beeps. */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, gain = 0.08): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.setValueAtTime(gain, start + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function beepTimerDone(): void {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  tone(c, 880, t, 0.12);
  tone(c, 880, t + 0.18, 0.12);
  tone(c, 1320, t + 0.36, 0.22);
}

export function beepTick(): void {
  const c = getCtx();
  if (!c) return;
  tone(c, 660, c.currentTime, 0.06, 0.05);
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
