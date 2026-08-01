import { createEffect, For, onCleanup } from 'solid-js';
import type { LogEntry } from '../bridge/useBridge';

function LogEntryItem(props: { entry: LogEntry }) {
  return (
    <p class="rounded px-1.5 py-0.5 hover:bg-base-200">
      <span class="text-base-content/40">{props.entry.time}</span>
      <span class="ml-1 text-base-content">
        {props.entry.line}
        {props.entry.count ? (
          <span class="badge badge-sm badge-ghost ml-1 border-base-300">
            ×{props.entry.count}
          </span>
        ) : null}
      </span>
    </p>
  );
}

/** 在底部时自动跟随最新日志;用户上滚则暂停,回到底部恢复 */
export default function LogPanel(props: { entries: LogEntry[] }) {
  let containerRef: HTMLDivElement | undefined;
  let atBottom = true;

  const followBottom = () => {
    const el = containerRef;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  };

  createEffect(() => {
    props.entries;
    followBottom();
  });

  const onScroll = () => {
    const el = containerRef;
    if (!el) return;
    atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  onCleanup(() => {
    containerRef = undefined;
  });

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-2 font-mono text-xs shadow-sm"
    >
      <For
        each={props.entries}
        fallback={<p class="text-base-content/70">暂无日志</p>}
      >
        {(entry) => <LogEntryItem entry={entry} />}
      </For>
    </div>
  );
}
