import { useBridge } from './bridge/useBridge';

export default function App() {
  const { status, port, log, connect, disconnect, rescan, ping } = useBridge();

  return (
    <div class="min-h-screen flex flex-col gap-3 bg-base-200 p-4">
      <div class="flex items-center gap-2">
        <h1 class="text-lg font-bold text-base-content">
          text-to-design MCP Bridge
        </h1>
        <span
          class={`badge ${status() === 'connected' ? 'badge-success' : 'badge-error'}`}
        >
          {status()}
        </span>
      </div>

      <div class="flex items-center gap-2 text-sm">
        <span class="text-base-content/70">server</span>
        <span class="badge badge-sm badge-info font-mono">:{port()}</span>
      </div>

      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-sm btn-primary" onClick={connect}>
          连接
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onClick={rescan}>
          重扫
        </button>
        <button type="button" class="btn btn-sm btn-ghost" onClick={ping}>
          ping
        </button>
        <button
          type="button"
          class="btn btn-sm btn-error btn-outline"
          onClick={disconnect}
        >
          断开
        </button>
      </div>

      <div class="alert alert-info text-sm">
        流程: 1) opencode 会话自动拉起 daemon(单实例,ws://localhost:{port()})→
        2) 在 jsDesign 导入插件 (manifest.json)并运行 → 3) 插件自动轮询连接,1
        秒重试直至连上;daemon 空闲 5 分钟自动退出
      </div>

      <div class="flex-1 overflow-y-auto rounded-lg bg-base-100 p-2 font-mono text-xs">
        {log().length === 0 ? (
          <p class="text-base-content/50">暂无日志</p>
        ) : (
          log().map((line) => <p class="text-base-content">{line}</p>)
        )}
      </div>
    </div>
  );
}
