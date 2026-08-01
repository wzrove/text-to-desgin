import { log } from './logger';

export type PluginMethod =
  | 'ping'
  | 'get_selection'
  | 'execute'
  | 'create_svg'
  | 'update_selection'
  | 'find'
  | 'set_selection'
  | 'remove'
  | 'clone'
  | 'group'
  | 'export'
  | 'list_fonts'
  | 'fill_image';

export type PluginResponse = {
  type: 'response';
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  hasBinary?: boolean;
  binaryCount?: number;
};

type OutgoingRequest = {
  type: 'request';
  id: string;
  method: PluginMethod;
  params: unknown;
};

type PluginRequestFrame = {
  type: 'request';
  id: string;
  method: PluginMethod;
  params?: unknown;
};

type Pending = {
  id: string;
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  waitBinary: boolean;
  binaryCount: number;
  buffers: Buffer[];
};

const DEFAULT_TIMEOUT = 30000;

/** 请求关联:发出发送、pending 表、响应/二进制帧组装、超时与整体拒绝 */
export class PendingManager {
  private pending = new Map<string, Pending>();
  private seq = 0;
  private binaryTarget: Pending | null = null;
  private sendFn: (text: string, binary?: Buffer) => void;

  constructor(send: (text: string, binary?: Buffer) => void) {
    this.sendFn = send;
  }

  request(
    method: PluginMethod,
    params: unknown,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<unknown> {
    const id = `r${++this.seq}`;
    const binary =
      params &&
      typeof params === 'object' &&
      'bytes' in (params as Record<string, unknown>)
        ? ((params as Record<string, unknown>).bytes as Uint8Array)
        : null;
    const payload: OutgoingRequest =
      binary != null
        ? {
            type: 'request',
            id,
            method,
            params: {
              ...(params as Record<string, unknown>),
              hasBinary: true,
              bytes: undefined,
            },
          }
        : { type: 'request', id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        log(`请求超时: ${id} ${method}`);
        reject(new Error(`请求超时: ${method}`));
      }, timeout);
      this.pending.set(id, {
        id,
        resolve,
        reject,
        timer,
        waitBinary: false,
        binaryCount: 0,
        buffers: [],
      });
      log(
        `发出请求: ${id} ${method}${binary != null ? ` +binary(${binary.byteLength}B)` : ''}`,
      );
      this.sendFn(
        JSON.stringify(payload),
        binary != null ? Buffer.from(binary) : undefined,
      );
    });
  }

  onText(raw: Buffer): void {
    let msg: PluginResponse | PluginRequestFrame;
    try {
      msg = JSON.parse(raw.toString()) as PluginResponse | PluginRequestFrame;
    } catch {
      log(`WS 文本解析失败: ${raw.toString().slice(0, 100)}`);
      return;
    }
    if (msg.type === 'request') {
      if (msg.method === 'ping') {
        log(`收到 ping 请求: ${msg.id} (自动回 pong)`);
        this.sendFn(
          JSON.stringify({
            type: 'response',
            id: msg.id,
            ok: true,
            data: { pong: true },
          }),
        );
      } else {
        log(`收到未知请求: ${msg.id} ${msg.method} (忽略)`);
      }
      return;
    }
    if (msg.type !== 'response') {
      log(`收到非响应消息: type=${(msg as { type?: string }).type}`);
      return;
    }
    const pending = this.pending.get(msg.id);
    if (!pending) {
      log(`未匹配响应: id=${msg.id}(可能已超时或来源不明)`);
      return;
    }
    if (msg.hasBinary && (msg.binaryCount ?? 1) > 0) {
      log(`二进制响应开始: id=${msg.id} count=${msg.binaryCount ?? 1}`);
      pending.waitBinary = true;
      pending.binaryCount = msg.binaryCount ?? 1;
      this.binaryTarget = pending;
      return;
    }
    this.pending.delete(msg.id);
    clearTimeout(pending.timer);
    log(
      `匹配响应: id=${msg.id} ok=${msg.ok}${msg.ok ? '' : ` error=${msg.error ?? ''}`}`,
    );
    if (msg.ok) pending.resolve(msg.data);
    else pending.reject(new Error(msg.error ?? 'plugin error'));
  }

  onBinary(raw: Buffer): void {
    if (!this.binaryTarget) {
      log(`孤儿二进制帧 len=${raw.byteLength}(无待组装响应)`);
      return;
    }
    this.binaryTarget.buffers.push(raw);
    log(
      `二进制帧: id=${this.binaryTarget.id} ${this.binaryTarget.buffers.length}/${this.binaryTarget.binaryCount}`,
    );
    if (this.binaryTarget.buffers.length >= this.binaryTarget.binaryCount) {
      const target = this.binaryTarget;
      this.binaryTarget = null;
      log(`二进制组装完成: id=${target.id} ${target.buffers.length} 帧`);
      this.settle(target);
    }
  }

  rejectAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  clear(): void {
    for (const [, p] of this.pending) clearTimeout(p.timer);
    this.pending.clear();
    this.binaryTarget = null;
  }

  private settle(pending: Pending): void {
    this.pending.delete(pending.id);
    clearTimeout(pending.timer);
    const data =
      pending.buffers.length === 1 ? pending.buffers[0] : pending.buffers;
    pending.resolve(data);
  }
}
