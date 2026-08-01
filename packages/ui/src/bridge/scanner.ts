import { MAX_SCAN_INTERVAL, SCAN_INTERVAL } from './types';

export interface ScanDeps {
  isConnected: () => boolean;
  open: () => Promise<boolean>;
}

/** 单端口扫描:未连接时按指数退避重试(1s→2s→…→封顶 10s),连上即停并重置 */
export class Scanner {
  private scanTimer: number | undefined;
  private running = false;
  private retryMs = SCAN_INTERVAL;
  private deps: ScanDeps;

  constructor(deps: ScanDeps) {
    this.deps = deps;
  }

  start(): void {
    if (this.deps.isConnected()) return;
    if (this.scanTimer) return;
    this.scanTimer = window.setTimeout(() => void this.run(), this.retryMs);
  }

  stop(): void {
    clearTimeout(this.scanTimer);
    this.scanTimer = undefined;
  }

  refresh(): void {
    if (this.deps.isConnected()) {
      this.stop();
      this.retryMs = SCAN_INTERVAL;
    } else {
      this.start();
    }
  }

  connect(): void {
    this.retryMs = SCAN_INTERVAL;
    this.start();
    void this.run();
  }

  abort(): void {
    this.stop();
    this.running = false;
    this.retryMs = SCAN_INTERVAL;
  }

  private async run(): Promise<void> {
    if (this.running || this.deps.isConnected()) return;
    this.running = true;
    try {
      const ok = await this.deps.open();
      if (ok) {
        this.stop();
        this.retryMs = SCAN_INTERVAL;
      } else {
        this.scheduleNext();
      }
    } catch {
      this.scheduleNext();
    } finally {
      this.running = false;
    }
  }

  private scheduleNext(): void {
    if (this.deps.isConnected()) return;
    this.stop();
    this.retryMs = Math.min(this.retryMs * 2, MAX_SCAN_INTERVAL);
    this.scanTimer = window.setTimeout(() => void this.run(), this.retryMs);
  }
}
