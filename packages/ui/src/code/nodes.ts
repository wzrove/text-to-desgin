import type { FindParams } from 'text-to-design-shared';
import { serializeNode } from './serialize';
import { findNode } from './utils';

export function findNodes(params: FindParams): Record<string, unknown> {
  const page = jsDesign.currentPage;
  let nodes: SceneNode[];
  if (params.type != null) {
    nodes = page.findAllWithCriteria({
      types: [params.type as NodeType],
    }) as SceneNode[];
  } else {
    nodes = page.findAll() as SceneNode[];
  }
  const name = params.name;
  if (name != null) {
    nodes = nodes.filter((n) => n.name.includes(name));
  }
  return {
    nodes: nodes.slice(0, 100).map((n) => serializeNode(n, params.depth ?? 1)),
    total: nodes.length,
  };
}

export function setSelection(ids: string[]): Record<string, unknown> {
  const nodes = findNode(ids);
  if (nodes.length === 0) {
    throw new Error('没有找到要选中的节点');
  }
  jsDesign.currentPage.selection = nodes;
  return { selected: nodes.map((n) => n.id) };
}

export function removeNodes(params: {
  ids?: string[];
  matchName?: string;
}): Record<string, unknown> {
  let nodes: SceneNode[];
  if (params.ids != null && params.ids.length > 0) {
    nodes = findNode(params.ids);
  } else {
    nodes = [...jsDesign.currentPage.selection];
  }
  if (params.matchName != null) {
    nodes = nodes.filter((n) => n.name === params.matchName);
  }
  if (nodes.length === 0) {
    throw new Error('没有要删除的节点');
  }
  const removed = nodes.map((n) => n.id);
  for (const n of nodes) {
    n.remove();
  }
  return { removed };
}

export function cloneNodes(ids: string[]): Record<string, unknown> {
  const nodes = findNode(ids);
  if (nodes.length === 0) {
    throw new Error('没有找到要复制的节点');
  }
  const page = jsDesign.currentPage;
  const created: SceneNode[] = [];
  for (const n of nodes) {
    const c = n.clone() as SceneNode;
    c.x = n.x + 24;
    c.y = n.y + 24;
    page.appendChild(c);
    created.push(c);
  }
  jsDesign.viewport.scrollAndZoomIntoView(created);
  return { created: created.map((n) => serializeNode(n)) };
}

export function groupNodes(params: {
  ids: string[];
  name?: string;
  ungroup?: boolean;
}): Record<string, unknown> {
  if (params.ungroup) {
    const nodes = findNode(params.ids);
    const grouped = nodes.filter((n) => n.type === 'GROUP');
    for (const g of grouped) {
      (g as unknown as { ungroup: () => void }).ungroup();
    }
    return { ungrouped: grouped.map((n) => n.id) };
  }
  const nodes = findNode(params.ids);
  if (nodes.length < 2) {
    throw new Error('分组至少需要 2 个节点');
  }
  const page = jsDesign.currentPage;
  const group = jsDesign.group(nodes, page);
  if (params.name != null) group.name = params.name;
  return { created: serializeNode(group) };
}

export function flattenNodes(ids: string[]): Record<string, unknown> {
  const nodes = findNode(ids);
  if (nodes.length < 2) {
    throw new Error('flatten 至少需要 2 个节点');
  }
  const vector = jsDesign.flatten(nodes, jsDesign.currentPage);
  jsDesign.viewport.scrollAndZoomIntoView([vector]);
  return { created: serializeNode(vector) };
}

export function outlineStrokeNodes(ids: string[]): Record<string, unknown> {
  const nodes = findNode(ids);
  if (nodes.length === 0) {
    throw new Error('没有找到要转描边的节点');
  }
  const created: SceneNode[] = [];
  for (const n of nodes) {
    const v = (n as { outlineStroke(): VectorNode | null }).outlineStroke();
    if (v) created.push(v);
  }
  if (created.length === 0) {
    throw new Error('所选节点没有可转换的描边');
  }
  jsDesign.viewport.scrollAndZoomIntoView(created);
  return { created: created.map((n) => serializeNode(n)) };
}

export function reparentNodes(params: {
  ids: string[];
  parentId?: string;
  index?: number;
}): Record<string, unknown> {
  const nodes = findNode(params.ids);
  if (nodes.length === 0) {
    throw new Error('没有找到要移动的节点');
  }
  const parent =
    params.parentId != null
      ? findNode([params.parentId])[0]
      : jsDesign.currentPage.selection[0];
  if (!parent) {
    throw new Error('没有找到目标父节点');
  }
  const container = parent as BaseNode & ChildrenMixin;
  for (const n of nodes) {
    if (params.index != null) container.insertChild(params.index, n);
    else container.appendChild(n);
  }
  return { moved: nodes.map((n) => serializeNode(n)) };
}
