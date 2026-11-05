export type WakeStatus = 'off' | 'requesting' | 'active' | 'paused' | 'unavailable' | 'unsupported';
export interface ScreenLock {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}
export interface ScreenLockAPI { request(type: 'screen'): Promise<ScreenLock> }

/** One lock per visible app, including late requests and releases during navigation. */
export class ScreenAwake {
  private enabled = false;
  private disposed = false;
  private pending = false;
  private epoch = 0;
  private lock: ScreenLock | null = null;

  constructor(
    private api: ScreenLockAPI | undefined,
    private visible: () => boolean,
    private report: (status: WakeStatus) => void,
  ) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.sync();
  }

  sync = () => {
    if (this.disposed) return;
    if (!this.enabled || !this.visible()) {
      this.epoch++;
      this.release();
      this.report(this.enabled ? 'paused' : 'off');
      return;
    }
    if (!this.api) { this.report('unsupported'); return; }
    if (this.lock && !this.lock.released) { this.report('active'); return; }
    if (this.pending) return;
    void this.acquire();
  };

  private async acquire() {
    const epoch = this.epoch;
    let retry = false;
    this.pending = true;
    this.report('requesting');
    try {
      const lock = await this.api!.request('screen');
      if (this.disposed || !this.enabled || !this.visible() || epoch !== this.epoch) {
        await lock.release().catch(() => {});
        // Visibility may have returned while the old request was pending.
        retry = !this.disposed && this.enabled && this.visible();
        return;
      }
      this.lock = lock;
      lock.addEventListener('release', () => {
        if (this.lock !== lock || this.disposed) return;
        this.lock = null;
        this.report(this.enabled ? 'paused' : 'off');
      });
      this.report(lock.released ? 'paused' : 'active');
    } catch {
      if (!this.disposed && this.enabled && this.visible()) {
        if (epoch !== this.epoch) retry = true;
        else this.report('unavailable');
      }
    } finally {
      this.pending = false;
      if (retry) this.sync();
    }
  }

  private release() {
    const lock = this.lock;
    this.lock = null;
    if (lock) void lock.release().catch(() => {});
  }

  dispose() {
    this.disposed = true;
    this.epoch++;
    this.release();
  }
}

export const wakeStatusText: Record<WakeStatus, string> = {
  off: 'Screen follows phone settings',
  requesting: 'Keeping screen awake…',
  active: 'Screen stays awake',
  paused: 'Screen lock paused · tap to retry',
  unavailable: 'Phone declined screen lock · tap to retry',
  unsupported: 'Screen lock unavailable in this browser',
};
