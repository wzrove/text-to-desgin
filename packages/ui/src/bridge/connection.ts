import type { EventBus } from './events';
import type { Router } from './router';
import type { BridgeEvent, BridgeStatus, Conn } from './types';

/** 单连接生命周期:一个 ws 的打开/关闭/错误处理、全局状态派生与事件发射 */
export class ConnectionManager {
  status: BridgeStatus = 'disconnected';
  private manualOff = false;
  private conn: Conn | null = null;
  private router: Router;
  private events: EventBus;

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
      conn.status = 'connecting';
      this.setStatus('connecting');
      socket.onopen = () => {
        conn.status = 'connected';
        this.setStatus('connected');
        this.emit('log', `MCP server 已连接: ws://localhost:${conn.port}`);
        settle(true);
      };
      socket.onmessage = (event) => this.onWsMessage(conn, event);
      socket.onclose = () => {
        if (conn.ws === socket) conn.ws = null;
        conn.status = 'disconnected';
        this.setStatus('disconnected');
        this.emit('log', `连接断开: ${conn.port}`);
        settle(false);
      };
      socket.onerror = () => {
        conn.status = 'error';
        this.setStatus('error');
        socket.close();
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
    if (conn) conn.status = 'disconnected';
    this.setStatus('disconnected');
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

  private setStatus(status: BridgeStatus): void {
    if (status === this.status) return;
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
