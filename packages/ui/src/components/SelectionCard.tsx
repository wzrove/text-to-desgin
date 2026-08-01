import { createMemo, createSignal, For, Show } from 'solid-js';
import { copyText } from '../utils/clipboard';

interface SelectedNode {
  id: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
}

const TYPE_DOT: Record<string, string> = {
  FRAME: 'bg-accent',
  GROUP: 'bg-neutral',
  RECTANGLE: 'bg-info',
  ELLIPSE: 'bg-warning',
  LINE: 'bg-neutral/60',
  POLYGON: 'bg-warning/70',
  STAR: 'bg-warning/70',
  VECTOR: 'bg-success/70',
  TEXT: 'bg-success',
  COMPONENT: 'bg-primary',
  COMPONENT_SET: 'bg-primary/60',
  INSTANCE: 'bg-primary/60',
  BOOLEAN_OPERATION: 'bg-warning/70',
  SLICE: 'bg-neutral/60',
};

function dotClass(type: string): string {
  return TYPE_DOT[type] ?? 'bg-neutral/40';
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export default function SelectionCard(props: { data: unknown }) {
  const nodes = createMemo<SelectedNode[]>(() => {
    const data = props.data as
      | { selection?: SelectedNode[] }
      | null
      | undefined;
    return Array.isArray(data?.selection) ? data.selection : [];
  });
  const payload = createMemo(() => JSON.stringify(props.data ?? {}));
  const size = createMemo(() => new TextEncoder().encode(payload()).length);

  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const copyId = (id: string) => {
    copyText(id);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div class="flex flex-col rounded-lg border border-base-300 bg-base-100 shadow-sm">
      <div class="flex items-center justify-between gap-2 border-b border-base-200 px-2.5 py-1.5">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-xs font-bold text-base-content/70">选中节点</span>
          <Show when={nodes().length > 0}>
            <span class="badge badge-sm badge-ghost border-base-300 font-mono text-[10px] text-base-content/60">
              序列化 {formatSize(size())}
            </span>
          </Show>
        </div>
        <Show when={nodes().length > 0}>
          <button
            type="button"
            class="btn btn-xs btn-primary shrink-0"
            onClick={() => copyText(payload())}
          >
            复制
          </button>
        </Show>
      </div>

      <div class="min-h-0 max-h-36 flex flex-col overflow-y-auto p-1">
        <Show
          when={nodes().length > 0}
          fallback={
            <p class="px-2.5 py-4 text-center text-xs text-base-content/70">
              未选中节点
            </p>
          }
        >
          <For each={nodes()}>
            {(n) => (
              <div class="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-base-200">
                <span
                  class={`inline-block size-1.5 shrink-0 rounded-full ${dotClass(n.type)}`}
                />
                <div class="min-w-0 flex-1 truncate font-mono text-xs">
                  <span class="text-base-content">{n.name}</span>
                  <span class="text-base-content/50">
                    {' '}
                    · {n.type}
                    {n.width != null ? ` · ${n.width}×${n.height}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  class={`btn btn-xs btn-ghost shrink-0 ${copiedId() === n.id ? 'text-success' : ''}`}
                  onClick={() => copyId(n.id)}
                >
                  {copiedId() === n.id ? '✓' : '复制'}
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>

      <Show when={nodes().length > 0}>
        <div class="border-t border-base-200 px-2.5 py-1 text-[10px] text-base-content/50">
          {nodes().length} 个节点
        </div>
      </Show>
    </div>
  );
}
