import { describe, expect, it, vi } from 'vitest';
import { ScreenAwake } from '../src/lib/wakeLock';
import type { ScreenLock } from '../src/lib/wakeLock';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function lock(): ScreenLock {
  let listener = () => {};
  const s = { released: false, release: vi.fn(async () => { s.released = true; listener(); }), addEventListener: vi.fn((_t, l: () => void) => { listener = l; }) };
  return s;
}
function fixture() {
  let visible = true;
  const locks: ScreenLock[] = [];
  const request = vi.fn(async () => { const s = lock(); locks.push(s); return s; });
  const report = vi.fn();
  const awake = new ScreenAwake({ request }, () => visible, report);
  return { awake, report, request, locks, visibility: (v: boolean) => { visible = v; awake.sync(); } };
}
describe('screen stays awake', () => {
  it('holds one lock across repeated interactions, releases when hidden and reacquires on return', async () => {
    const f = fixture(); f.awake.setEnabled(true); await flush();
    f.awake.sync(); f.awake.sync(); await flush();
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(f.report).toHaveBeenLastCalledWith('active');
    f.visibility(false); await flush();
    expect(f.locks[0].release).toHaveBeenCalledTimes(1);
    expect(f.report).toHaveBeenLastCalledWith('paused');
    f.visibility(true); await flush();
    expect(f.request).toHaveBeenCalledTimes(2);
    f.awake.setEnabled(false); await flush();
    expect(f.locks[1].released).toBe(true);
    f.awake.sync(); expect(f.request).toHaveBeenCalledTimes(2);
    expect(f.report).toHaveBeenLastCalledWith('off');
  });
  it('handles OS revocation without a retry loop and can retry on the next interaction', async () => {
    const f = fixture(); f.awake.setEnabled(true); await flush();
    await f.locks[0].release(); await flush();
    expect(f.report).toHaveBeenLastCalledWith('paused');
    expect(f.request).toHaveBeenCalledTimes(1);
    f.awake.sync(); await flush(); expect(f.request).toHaveBeenCalledTimes(2);
    f.awake.dispose(); await flush(); expect(f.locks[1].released).toBe(true);
  });
  it('releases a late request after disabling or disposing, without reporting active', async () => {
    let resolve!: (s: ScreenLock) => void;
    const report = vi.fn();
    const awake = new ScreenAwake({ request: () => new Promise((r) => { resolve = r; }) }, () => true, report);
    awake.setEnabled(true); awake.dispose();
    const s = lock(); resolve(s); await flush();
    expect(s.release).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalledWith('active');
  });
  it('handles hide/show while requesting without retaining the stale lock or requesting twice', async () => {
    let visible = true;
    const pending: ((s: ScreenLock) => void)[] = [];
    const request = vi.fn(() => new Promise<ScreenLock>((r) => { pending.push(r); }));
    const awake = new ScreenAwake({ request }, () => visible, vi.fn());
    awake.setEnabled(true); visible = false; awake.sync(); visible = true; awake.sync();
    const stale = lock(); pending[0](stale); await flush();
    awake.sync(); awake.sync();
    expect(stale.released).toBe(true); expect(request).toHaveBeenCalledTimes(2);
    const current = lock(); pending[1](current); await flush();
    awake.dispose(); expect(current.release).toHaveBeenCalledTimes(1);
  });
  it('retries a stale rejection after returning to the app', async () => {
    let visible = true;
    let reject!: (reason: Error) => void;
    const current = lock();
    const request = vi.fn().mockImplementationOnce(() => new Promise((_r,j) => { reject = j; })).mockResolvedValue(current);
    const report = vi.fn();
    const awake = new ScreenAwake({ request }, () => visible, report);
    awake.setEnabled(true); visible = false; awake.sync(); visible = true; awake.sync();
    reject(new Error('hidden document')); await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith('active');
    awake.dispose();
  });
  it('reports unsupported and denied states without throwing or retrying indefinitely', async () => {
    const report = vi.fn(); const unsupported = new ScreenAwake(undefined, () => true, report);
    unsupported.setEnabled(true); expect(report).toHaveBeenLastCalledWith('unsupported');
    const request = vi.fn(async () => { throw new Error('power saving'); });
    const denied = new ScreenAwake({ request }, () => true, report);
    denied.setEnabled(true); await flush();
    expect(report).toHaveBeenLastCalledWith('unavailable'); expect(request).toHaveBeenCalledTimes(1);
    denied.setEnabled(false); expect(report).toHaveBeenLastCalledWith('off');
  });
});
