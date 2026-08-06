import type { GetSelectionParams, PluginRequest } from 'text-to-design-shared';
import { makeResponse } from 'text-to-design-shared';
import {
  cloneNodes,
  combineAsVariantsNodes,
  createComponentNodes,
  createInstances,
  createSvgNode,
  detachInstanceNodes,
  executeOps,
  exportNodes,
  fillImageNode,
  findNodes,
  flattenNodes,
  groupNodes,
  importComponentNodes,
  listFonts,
  outlineStrokeNodes,
  removeNodes,
  reparentNodes,
  setInstanceProperties,
  setSelection,
  swapComponents,
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

function pushSelection(): void {
  try {
    jsDesign.ui.postMessage({
      type: 'selection',
      data: getSelection({ depth: 1 }),
    });
  } catch (e) {
    console.error('[code] 推送选中失败', e);
  }
}

jsDesign.on('selectionchange', pushSelection);
setTimeout(pushSelection, 300);

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
      case 'node_op': {
        const p = msg.params;
        switch (p.op) {
          case 'select':
            send(id, true, setSelection(p.ids ?? []));
            break;
          case 'remove':
            send(id, true, removeNodes({ ids: p.ids, matchName: p.matchName }));
            break;
          case 'clone':
            send(id, true, cloneNodes(p.ids ?? []));
            break;
          case 'group':
            send(id, true, groupNodes({ ids: p.ids ?? [], name: p.name }));
            break;
          case 'ungroup':
            send(id, true, groupNodes({ ids: p.ids ?? [], ungroup: true }));
            break;
          case 'flatten':
            send(id, true, flattenNodes(p.ids ?? []));
            break;
          case 'outline_stroke':
            send(id, true, outlineStrokeNodes(p.ids ?? []));
            break;
          case 'reparent':
            send(
              id,
              true,
              reparentNodes({
                ids: p.ids ?? [],
                parentId: p.parentId,
                index: p.index,
              }),
            );
            break;
          default:
            send(
              id,
              false,
              undefined,
              `未知 node_op: ${String((p as { op?: string }).op)}`,
            );
            return;
        }
        break;
      }
      case 'component_op': {
        const p = msg.params;
        switch (p.op) {
          case 'create_component':
            send(
              id,
              true,
              createComponentNodes({ ids: p.ids ?? [], name: p.name }),
            );
            break;
          case 'create_instance':
            send(id, true, createInstances(p.ids ?? []));
            break;
          case 'detach_instance':
            send(id, true, detachInstanceNodes(p.ids ?? []));
            break;
          case 'import_component':
            send(
              id,
              true,
              await importComponentNodes({ key: p.key ?? '', name: p.name }),
            );
            break;
          case 'swap_component':
            send(
              id,
              true,
              swapComponents({
                ids: p.ids ?? [],
                componentId: p.componentId ?? '',
              }),
            );
            break;
          case 'set_instance_properties':
            send(
              id,
              true,
              setInstanceProperties({
                ids: p.ids ?? [],
                properties: p.properties ?? {},
              }),
            );
            break;
          case 'combine_as_variants':
            send(
              id,
              true,
              combineAsVariantsNodes({ ids: p.ids ?? [], name: p.name }),
            );
            break;
          default:
            send(
              id,
              false,
              undefined,
              `未知 component_op: ${String((p as { op?: string }).op)}`,
            );
            return;
        }
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
