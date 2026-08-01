import { SCAN_INTERVAL } from './types'

export interface ScanDeps {
  isConnected: () => boolean
  open: () => Promise<boolean>
}

/** 单端口扫描:未连接时每 SCAN_INTERVAL 重试一次,连上即停 */
export class Scanner {
  private scanTimer: number | undefined
  private running = false
  private deps: ScanDeps

  constructor(deps: ScanDeps) {
    this.deps = deps
  }

  start(): void {
    if (this.deps.isConnected()) return
    if (this.scanTimer) return
    this.scanTimer = window.setInterval(() => void this.run(), SCAN_INTERVAL)
  }

  stop(): void {
    clearInterval(this.scanTimer)
    this.scanTimer = undefined
  }

  refresh(): void {
    if (this.deps.isConnected()) this.stop()
    else this.start()
  }

  connect(): void {
    this.start()
    void this.run()
  }

  abort(): void {
    this.stop()
    this.running = false
  }

  private async run(): Promise<void> {
    if (this.running || this.deps.isConnected()) return
    this.running = true
    try {
      const ok = await this.deps.open()
      if (ok) this.stop()
    } catch {
      // open 内部已处理错误
    } finally {
      this.running = false
    }
  }
}
