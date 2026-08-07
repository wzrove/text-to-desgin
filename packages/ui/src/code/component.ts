import type { SerializedNode } from 'text-to-design-shared';
import { serializeNode } from './serialize';
import { findNode } from './utils';

export function createComponentNodes(params: {
  ids: string[];
  name?: string;
}): { created: SerializedNode } {
  const nodes = findNode(params.ids);
  if (nodes.length === 0) {
    throw new Error('没有找到要固化为组件的节点');
  }
  const component = jsDesign.createComponent();
  for (const n of nodes) {
    component.appendChild(n);
  }
  component.name = params.name ?? 'component';
  jsDesign.viewport.scrollAndZoomIntoView([component]);
  return { created: serializeNode(component) };
}

export function createInstances(ids: string[]): { created: SerializedNode[] } {
  const nodes = findNode(ids);
  const components = nodes.filter((n) => n.type === 'COMPONENT');
  if (components.length === 0) {
    throw new Error('没有找到可实例化的组件节点');
  }
  const page = jsDesign.currentPage;
  const created: InstanceNode[] = [];
  const center = jsDesign.viewport.center;
  for (const c of components) {
    const inst = (c as ComponentNode).createInstance();
    page.appendChild(inst);
    inst.x = center.x - inst.width / 2;
    inst.y = center.y - inst.height / 2;
    created.push(inst);
  }
  jsDesign.viewport.scrollAndZoomIntoView(created);
  return { created: created.map((n) => serializeNode(n)) };
}

export function swapComponents(params: {
  ids: string[];
  componentId: string;
}): { swapped: SerializedNode[] } {
  const component = findNode([params.componentId]).find(
    (n) => n.type === 'COMPONENT',
  ) as ComponentNode | undefined;
  if (!component) {
    throw new Error(`没有找到组件: ${params.componentId}`);
  }
  const instances = findNode(params.ids).filter(
    (n) => n.type === 'INSTANCE',
  ) as InstanceNode[];
  if (instances.length === 0) {
    throw new Error('没有找到要交换的实例节点');
  }
  for (const inst of instances) {
    inst.swapComponent(component);
  }
  return { swapped: instances.map((n) => serializeNode(n)) };
}

export function setInstanceProperties(params: {
  ids: string[];
  properties: Record<string, string>;
}): { updated: SerializedNode[] } {
  const instances = findNode(params.ids).filter(
    (n) => n.type === 'INSTANCE',
  ) as InstanceNode[];
  if (instances.length === 0) {
    throw new Error('没有找到要设置的实例节点');
  }
  for (const inst of instances) {
    inst.setProperties(params.properties);
  }
  return { updated: instances.map((n) => serializeNode(n)) };
}

export async function importComponentNodes(params: {
  key: string;
  name?: string;
}): Promise<{ created: SerializedNode }> {
  const component = await jsDesign.importComponentByKeyAsync(params.key);
  const page = jsDesign.currentPage;
  page.appendChild(component);
  const center = jsDesign.viewport.center;
  component.x = center.x - component.width / 2;
  component.y = center.y - component.height / 2;
  if (params.name != null) component.name = params.name;
  jsDesign.viewport.scrollAndZoomIntoView([component]);
  return { created: serializeNode(component) };
}

export function combineAsVariantsNodes(params: {
  ids: string[];
  name?: string;
}): { created: SerializedNode } {
  const components = findNode(params.ids).filter(
    (n) => n.type === 'COMPONENT',
  ) as ComponentNode[];
  if (components.length < 2) {
    throw new Error('combine_as_variants 至少需要 2 个组件节点');
  }
  const set = jsDesign.combineAsVariants(components, jsDesign.currentPage);
  if (params.name != null) set.name = params.name;
  jsDesign.viewport.scrollAndZoomIntoView([set]);
  return { created: serializeNode(set) };
}

export function detachInstanceNodes(ids: string[]): {
  created: SerializedNode[];
} {
  const instances = findNode(ids).filter(
    (n) => n.type === 'INSTANCE',
  ) as InstanceNode[];
  if (instances.length === 0) {
    throw new Error('没有找到要解绑的实例节点');
  }
  const detached = instances.map((n) => n.detachInstance());
  jsDesign.viewport.scrollAndZoomIntoView(detached);
  return { created: detached.map((n) => serializeNode(n)) };
}
