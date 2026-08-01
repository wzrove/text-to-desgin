import type { PluginRequest } from '@jsdesign/shared'

export type BridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type BridgeEvent =
  | { type: 'status'; status: BridgeStatus }
  | { type: 'log'; line: string }

export type Conn = {
  port: number
  ws: WebSocket | null
  status: BridgeStatus
  binaryIn: { msg: PluginRequest; buffers: Uint8Array[]; expected: number } | null
}

export type Pending = {
  resolve?: (data: unknown) => void
  reject?: (err: Error) => void
  timer: number
}

/** UI 侧超时必须小于服务器侧(30s),保证 UI 先超时先回错误包,不留孤儿 */
export const TIMEOUT = 25000
export const SCAN_INTERVAL = 1000
