import { WS_PORT } from 'text-to-design-shared';
import { ConnectionManager } from './connection';
import { EventBus } from './events';
import { Router } from './router';
import { Scanner } from './scanner';
import type { BridgeEvent, BridgeStatus, Conn } from './types';

export type { BridgeEvent, BridgeStatus } from './types';

/** 门面:组合扫描器/连接管理器/路由器,单连接,对外 API 固定 */
export class BridgeSocket {
  private conn: Conn;
  private events = new EventBus();
  private router: Router;
  private connection: ConnectionManager;
  private scanner: Scanner;

  constructor(port = WS_PORT) {
    this.conn = { port, ws: null, status: 'disconnected', binaryIn: null };
    this.router = new Router(this.conn, (line) =>
      this.events.emit({ type: 'log', line }),
    );
    this.connection = new ConnectionManager(
      this.conn,
      this.router,
      this.events,
    );
    this.scanner = new Scanner({
      isConnected: () => this.connection.isOpen,
      open: () => this.connection.open(),
    });
    this.connection.onStatusChange = () => this.scanner.refresh();
    window.addEventListener('message', this.router.onCodeMessage);
  }

  get isOpen(): boolean {
    return this.connection.isOpen;
  }

  get currentStatus(): BridgeStatus {
    return this.connection.status;
  }

  subscribe(cb: (e: BridgeEvent) => void): () => void {
    return this.events.subscribe(cb);
  }

  connect(): void {
    this.connection.resume();
    this.scanner.connect();
  }

  rescan(): void {
    this.connection.resume();
    this.scanner.connect();
  }

  disconnect(): void {
    this.scanner.abort();
    this.router.rejectAll(new Error('手动断开连接'));
    this.connection.close();
  }

  pingPlugin(): Promise<unknown> {
    return this.router.pingPlugin();
  }
}
