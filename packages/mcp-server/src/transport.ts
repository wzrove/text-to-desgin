import { WebSocketServer, WebSocket } from 'ws'
import type { Server as HttpServer } from 'node:http'
import { createServer } from 'node:http'
import { log } from './logger'

/** WSS/HTTP 生命周期(固定端口,被占即失败),消息透传上层 */
export class Transport {
  private wss: WebSocketServer | null = null
  private http: HttpServer | null = null
  private client: WebSocket | null = null
  private _port = 0

  onMessage: ((raw: Buffer, isBinary: boolean) => void) | null = null
  onDisconnect: ((err: Error) => void) | null = null

  get port(): number {
    return this._port
  }

  async start(port: number): Promise<void> {
    this.http = createServer()
    this.wss = new WebSocketServer({ server: this.http })
    this.wss.on('error', () => {
      // 端口冲突等错误由 tryListen 处理,此处避免未捕获异常
    })
    this.wss.on('connection', (ws) => {
      this.client = ws
      const line = '[jsdesign-mcp] 插件已连接\n'
      process.stderr.write(line)
      log('插件已连接')
      ws.on('message', (raw: Buffer, isBinary: boolean) => {
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer)
        log(`收到 WS 消息 len=${buf.length} bin=${isBinary}`)
        this.onMessage?.(buf, isBinary)
      })
      ws.on('close', () => {
        if (this.client === ws) this.client = null
        const line = '[jsdesign-mcp] 插件断开\n'
        process.stderr.write(line)
        log('插件断开')
        this.onDisconnect?.(new Error('plugin disconnected'))
      })
      ws.on('error', () => {
        if (this.client === ws) this.client = null
        this.onDisconnect?.(new Error('plugin connection error'))
      })
    })
    const ok = await this.tryListen(port)
    if (!ok) {
      this.http.close()
      throw new Error(`端口 ${port} 已被占用。已有 jsdesign-mcp 实例在运行?请检查残留进程后重试`)
    }
    this._port = port
  }

  stop(): void {
    this.wss?.close()
    this.http?.close()
  }

  get isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN
  }

  send(data: string | Buffer): void {
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.send(data)
    } else {
      log(`发送失败: 无客户端连接(${data.length} 字节被丢弃)`)
    }
  }

  private tryListen(p: number): Promise<boolean> {
    return new Promise((resolve) => {
      const onError = (): void => {
        cleanup()
        resolve(false)
      }
      const onListening = (): void => {
        cleanup()
        resolve(true)
      }
      const cleanup = (): void => {
        this.http!.off('error', onError)
        this.http!.off('listening', onListening)
      }
      this.http!.once('error', onError)
      this.http!.once('listening', onListening)
      this.http!.listen(p)
    })
  }
}
