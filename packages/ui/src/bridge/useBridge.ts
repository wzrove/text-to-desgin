import { createSignal, onMount } from 'solid-js'
import type { Accessor } from 'solid-js'
import { WS_PORT } from '@jsdesign/shared'
import { BridgeSocket } from './BridgeSocket'
import type { BridgeStatus } from './BridgeSocket'

const [status, setStatus] = createSignal<BridgeStatus>('disconnected')
const [log, setLog] = createSignal<string[]>([])

let bridge: BridgeSocket | undefined
let subscribed = false
let started = false

function pushLog(line: string): void {
  setLog((l) => [...l.slice(-49), line])
}

function getBridge(): BridgeSocket {
  if (!bridge) bridge = new BridgeSocket()
  return bridge
}

function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  const b = getBridge()
  b.subscribe((e) => {
    if (e.type === 'status') setStatus(e.status)
    else pushLog(e.line)
  })
  setStatus(b.currentStatus)
}

export interface BridgeStore {
  status: Accessor<BridgeStatus>
  port: Accessor<number>
  log: Accessor<string[]>
  connect: () => void
  disconnect: () => void
  rescan: () => void
  ping: () => void
}

export function useBridge(): BridgeStore {
  onMount(() => {
    ensureSubscribed()
    if (!started) {
      started = true
      connect()
    }
  })

  const connect = () => {
    getBridge().connect()
  }

  const disconnect = () => {
    getBridge().disconnect()
  }

  const rescan = () => {
    getBridge().rescan()
  }

  const ping = async () => {
    connect()
    try {
      const data = await getBridge().pingPlugin()
      pushLog(`ping 插件成功: ${JSON.stringify(data)}`)
    } catch (e) {
      pushLog(`ping 插件失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { status, port: createSignal(WS_PORT)[0], log, connect, disconnect, rescan, ping }
}
