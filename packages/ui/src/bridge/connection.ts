import type { EventBus } from './events';
import type { Router } from './router';
import type { BridgeEvent, BridgeStatus, Conn } from './types';

/** 单连接生命周期:一个 ws 的打开/关闭/错误处理、全局状态派生与事件发射 */
export class ConnectionManager {
  status: BridgeStatus = 'disconnected';
  /** 最近一次收到 daemon 状态确认的时间戳,0 = 从未确认 */
  lastConfirmedAt = 0;
  private manualOff = false;
  private conn: Conn | null = null;
  private router: Router;
  private events: EventBus;
  /** 当前连接的打开时刻(用于确认超时判定) */
  private openAt = 0;
  private confirmTimer: number | undefined;

  /** 状态变更回调(门面注入,用于驱动扫描器启停) */
  onStatusChange: ((status: BridgeStatus) => void) | null = null;

  constructor(conn: Conn, router: Router, events: EventBus) {
    this.conn = conn;
    this.router = router;
    this.events = events;
  }

  get isOpen(): boolean {
    return !!this.conn?.ws && this.conn.ws.readyState === WebSocket.OPEN;
  }

  open(): Promise<boolean> {
    const conn = this.conn;
    if (!conn || this.manualOff) return Promise.resolve(false);
    return new Promise((resolve) => {
      let done = false;
      const settle = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      const socket = new WebSocket(`ws://localhost:${conn.port}`);
      socket.binaryType = 'arraybuffer';
      conn.ws = socket;
      this.setStatus('connecting');
      socket.onopen = () => {
        if (conn.ws !== socket) return;
        this.openAt = Date.now();
        this.setStatus('connecting', true);
        this.emit(
          'log',
          `MCP server 已连接,等待服务确认: ws://localhost:${conn.port}`,
        );
        settle(true);
        // 延迟探测:绕开代理层「连接瞬间首条消息易丢」的窗口,主动 ping 确认双向可达
        setTimeout(() => this.router.probeServer(), 1000);
        // 确认超时:5s 内未收到 daemon 确认(status/pong)→ 关闭重连
        this.confirmTimer = window.setTimeout(() => {
          if (conn.ws !== socket) return;
          if (this.lastConfirmedAt < this.openAt) {
            this.emit('log', `服务确认超时,关闭重连: ${conn.port}`);
            socket.close();
          }
        }, 5000);
      };
      socket.onmessage = (event) => this.onWsMessage(conn, event);
      socket.onclose = () => {
        if (conn.ws !== socket) return;
        if (this.confirmTimer) clearTimeout(this.confirmTimer);
        this.confirmTimer = undefined;
        conn.ws = null;
        this.setStatus('disconnected', true);
        this.emit('log', `连接断开: ${conn.port}`);
        settle(false);
      };
      socket.onerror = () => {
        console.error('ws error', conn.port);
        // 不主动 close、不降级状态:代理层瞬时 error 不应误杀连接,
        // 真死连接由 onclose 兜底,确认超时由上述定时器兜底
      };
    });
  }

  close(): void {
    this.manualOff = true;
    const conn = this.conn;
    if (conn?.ws) {
      conn.ws.close();
      conn.ws = null;
    }
    this.setStatus('disconnected');
  }

  /** 收到 daemon 状态确认(连接双向可达)→ 已连接 */
  markConfirmed(): void {
    this.lastConfirmedAt = Date.now();
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmTimer = undefined;
    this.setStatus('connected', true);
  }

  /** 清除手动断开标记,允许自动/手动重连 */
  resume(): void {
    this.manualOff = false;
  }

  private onWsMessage(conn: Conn, event: MessageEvent): void {
    try {
      if (typeof event.data === 'string') {
        this.router.onWsText(conn, event.data);
        return;
      }
      this.router.onWsBinary(conn, event.data as ArrayBuffer);
    } catch (e) {
      this.emit(
        'log',
        `WS 消息处理失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private setStatus(status: BridgeStatus, force = false): void {
    if (!force && status === this.status) return;
    this.status = status;
    this.emit('status', status);
    this.onStatusChange?.(status);
  }

  private emit(type: 'status', status: BridgeStatus): void;
  private emit(type: 'log', line: string): void;
  private emit(type: 'status' | 'log', value: BridgeStatus | string): void {
    const event = (
      type === 'status' ? { type, status: value } : { type, line: value }
    ) as BridgeEvent;
    this.events.emit(event);
  }
}
