import type { GetSelectionParams, PluginRequest } from 'text-to-design-shared';
import { makeResponse } from 'text-to-design-shared';
import {
  cloneNodes,
  createSvgNode,
  executeOps,
  exportNodes,
  fillImageNode,
  findNodes,
  groupNodes,
  listFonts,
  removeNodes,
  setSelection,
  updateSelection,
} from './build';
import { serializeNode } from './serialize';

const UI_OPTIONS = { width: 360, height: 520 };

try {
  if (typeof __html__ === 'string' && __html__.trim() !== '') {
    jsDesign.showUI(__html__, UI_OPTIONS);
  } else {
    console.warn('[code] __html__ 未注入,UI 面板为空');
    jsDesign.showUI('', UI_OPTIONS);
  }
} catch (e) {
  console.error('[code] showUI 失败', e);
}

function send(id: string, ok: boolean, data?: unknown, error?: string): void {
  try {
    console.log(data, '----');
    jsDesign.ui.postMessage(makeResponse(id, ok, data, error));
  } catch (e) {
    console.error('[code] 发送响应失败', id, e);
  }
}

function fail(id: string, method: string, e: unknown): void {
  const reason = e instanceof Error ? e.message : String(e);
  send(id, false, undefined, `${method} 失败: ${reason}`);
}

function getSelection(
  params: GetSelectionParams = {},
): Record<string, unknown> {
  const selection = jsDesign.currentPage.selection;
  const depth = params.depth ?? 2;
  return {
    selection: selection.map((n) => serializeNode(n, depth)),
    pageName: jsDesign.currentPage.name,
  };
}

jsDesign.ui.onmessage = async (msg: PluginRequest) => {
  const id = msg.id;
  console.log(msg, '----');
  try {
    switch (msg.method) {
      case 'ping':
        send(id, true, { pong: true });
        break;
      case 'get_selection':
        send(id, true, getSelection(msg.params));
        break;
      case 'execute': {
        const r = await executeOps(msg.params.ops);
        send(id, true, r);
        break;
      }
      case 'create_svg': {
        const r = createSvgNode(msg.params.svg, msg.params.name);
        send(id, true, r);
        break;
      }
      case 'update_selection': {
        const r = await updateSelection(msg.params);
        send(id, true, r);
        break;
      }
      case 'find': {
        const r = findNodes(msg.params);
        send(id, true, r);
        break;
      }
      case 'set_selection': {
        const r = setSelection(msg.params.ids);
        send(id, true, r);
        break;
      }
      case 'remove': {
        const r = removeNodes(msg.params);
        send(id, true, r);
        break;
      }
      case 'clone': {
        const r = cloneNodes(msg.params.ids);
        send(id, true, r);
        break;
      }
      case 'group': {
        const r = groupNodes(msg.params);
        send(id, true, r);
        break;
      }
      case 'export': {
        const r = await exportNodes(msg.params);
        send(id, true, r);
        break;
      }
      case 'fill_image': {
        const bytes = msg.params.bytes ?? new Uint8Array(0);
        const r = await fillImageNode({ ids: msg.params.ids, bytes });
        send(id, true, r);
        break;
      }
      case 'list_fonts': {
        const r = await listFonts();
        send(id, true, r);
        break;
      }
      default:
        send(
          id,
          false,
          undefined,
          `未知方法: ${(msg as { method: string }).method}`,
        );
    }
  } catch (e) {
    console.error(e);
    fail(id, msg.method, e);
  }
};
