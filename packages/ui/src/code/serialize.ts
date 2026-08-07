import type { SerializedNode, SerializedNodeType } from 'text-to-design-shared';

export const MAX_SERIALIZE_DEPTH = 2;

function rgbToHex(c: { r: number; g: number; b: number }): string {
  return `#${[c.r, c.g, c.b]
    .map((v) => {
      const s = Math.round(v * 255).toString(16);
      return s.length < 2 ? `0${s}` : s;
    })
    .join('')}`;
}

function isMixed(v: unknown): boolean {
  return typeof v === 'string' && (v as string) === 'figma.mixed';
}

export function serializeNode(
  node: SceneNode,
  depth: number = MAX_SERIALIZE_DEPTH,
): SerializedNode {
  const base: SerializedNode = {
    id: node.id,
    name: node.name,
    type: node.type as SerializedNodeType,
    x: Math.round(node.x),
    y: Math.round(node.y),
  };
  if ('width' in node) {
    base.width = Math.round(node.width);
    base.height = Math.round(node.height);
  }
  if ('rotation' in node && node.rotation !== 0)
    base.rotation = Math.round(node.rotation);
  if (
    'opacity' in node &&
    typeof node.opacity === 'number' &&
    node.opacity !== 1
  )
    base.opacity = node.opacity;
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID') {
      base.fill = rgbToHex(fill.color);
    } else if (fill.type === 'GRADIENT_LINEAR') {
      const stops = fill.gradientStops;
      base.gradient = {
        type: 'GRADIENT_LINEAR',
        stops: stops.map(
          (s: {
            color: { r: number; g: number; b: number };
            position: number;
          }) => ({
            color: rgbToHex(s.color),
            position: s.position,
          }),
        ),
      };
    }
  }
  if (
    'strokes' in node &&
    Array.isArray(node.strokes) &&
    node.strokes.length > 0
  ) {
    const stroke = node.strokes[0];
    if (stroke.type === 'SOLID') {
      base.stroke = rgbToHex(stroke.color);
    }
    if (
      'strokeWeight' in node &&
      typeof node.strokeWeight === 'number' &&
      node.strokeWeight > 0
    ) {
      base.strokeWeight = node.strokeWeight;
    }
  }
  if ('effects' in node && Array.isArray(node.effects)) {
    const shadow = node.effects.find(
      (e) => e.type === 'DROP_SHADOW' && e.visible,
    );
    if (shadow && shadow.type === 'DROP_SHADOW') {
      base.shadow = {
        x: shadow.offset.x,
        y: shadow.offset.y,
        radius: shadow.radius,
        color: rgbToHex(shadow.color),
      };
    }
  }
  if (
    'cornerRadius' in node &&
    typeof node.cornerRadius === 'number' &&
    node.cornerRadius !== 0
  ) {
    base.cornerRadius = node.cornerRadius;
  }
  if ('topLeftRadius' in node) {
    const r = node as RectangleNode;
    base.radiusTopLeft =
      typeof r.topLeftRadius === 'number' ? r.topLeftRadius : undefined;
    base.radiusTopRight =
      typeof r.topRightRadius === 'number' ? r.topRightRadius : undefined;
    base.radiusBottomLeft =
      typeof r.bottomLeftRadius === 'number' ? r.bottomLeftRadius : undefined;
    base.radiusBottomRight =
      typeof r.bottomRightRadius === 'number' ? r.bottomRightRadius : undefined;
  }
  if ('pointCount' in node) {
    base.pointCount = (node as PolygonNode).pointCount;
  }
  if (node.type === 'VECTOR') {
    base.vectorPaths = (node as VectorNode).vectorPaths.map((p) => ({
      data: p.data,
      windingRule: p.windingRule,
    }));
  }
  if ('variantProperties' in node && node.variantProperties != null) {
    base.variantProperties = { ...(node as InstanceNode).variantProperties };
  }
  if (node.type === 'INSTANCE') {
    base.mainComponentId = (node as InstanceNode).mainComponent?.id;
  }
  if (node.type === 'COMPONENT_SET') {
    const set = node as ComponentSetNode;
    base.variantGroupProperties = Object.fromEntries(
      Object.entries(set.variantGroupProperties).map(([k, v]) => [
        k,
        [...v.values],
      ]),
    );
  }
  if (node.type === 'TEXT') {
    base.characters = node.characters;
    if (!isMixed(node.fontSize)) base.fontSize = node.fontSize as number;
    const f = node.fontName as FontName | undefined;
    if (f?.family) base.fontFamily = f.family;
    if (f?.style && f.style !== 'Regular') base.fontWeight = f.style;
  }
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    base.layout = {
      mode: node.layoutMode,
      itemSpacing: isMixed(node.itemSpacing) ? undefined : node.itemSpacing,
      padding: isMixed(node.paddingTop) ? undefined : node.paddingTop,
    };
  }
  if ('children' in node && node.children.length > 0) {
    if (depth > 0) {
      base.children = node.children.map((c) =>
        serializeNode(c as SceneNode, depth - 1),
      );
    } else {
      base.childCount = node.children.length;
    }
  }
  return base;
}
