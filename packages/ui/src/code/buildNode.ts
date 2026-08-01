import { paint } from './color';
import { gradientPaint, makeShadowEffect } from './style';
import type { Spec } from './types';
import { loadFont } from './utils';

async function buildNode(
  spec: Spec,
  parent: BaseNode & ChildrenMixin,
): Promise<SceneNode> {
  const op = spec.op ?? 'frame';
  let node: SceneNode;
  switch (op) {
    case 'text':
      node = jsDesign.createText();
      break;
    case 'rect':
      node = jsDesign.createRectangle();
      break;
    case 'ellipse':
      node = jsDesign.createEllipse();
      break;
    case 'line':
      node = jsDesign.createLine();
      break;
    case 'polygon':
      node = jsDesign.createPolygon();
      break;
    case 'star':
      node = jsDesign.createStar();
      break;
    case 'vector':
      node = jsDesign.createVector();
      break;
    default:
      node = jsDesign.createFrame();
  }

  node.name = spec.name ?? 'node';
  node.x = spec.x ?? 0;
  node.y = spec.y ?? 0;

  if (spec.w != null && 'resize' in node)
    node.resize(spec.w, spec.h ?? node.height);
  if (spec.rotation != null) node.rotation = spec.rotation;
  if (spec.opacity != null && 'opacity' in node) node.opacity = spec.opacity;

  if (spec.fill && 'fills' in node) node.fills = gradientPaint(spec);
  else if (spec.gradient && 'fills' in node) node.fills = gradientPaint(spec);

  if (spec.stroke && 'strokes' in node) node.strokes = paint(spec.stroke);
  if (spec.strokeWeight != null && 'strokeWeight' in node)
    node.strokeWeight = spec.strokeWeight;

  if (spec.shadow && 'effects' in node)
    node.effects = makeShadowEffect(spec.shadow);

  if ('cornerRadius' in node) {
    if (spec.radius != null) node.cornerRadius = spec.radius;
    if (spec.radiusTopLeft != null) node.cornerRadius = spec.radiusTopLeft;
    if ('topLeftRadius' in node) {
      const r = node as RectangleNode;
      if (spec.radiusTopLeft != null) r.topLeftRadius = spec.radiusTopLeft;
      if (spec.radiusTopRight != null) r.topRightRadius = spec.radiusTopRight;
      if (spec.radiusBottomLeft != null)
        r.bottomLeftRadius = spec.radiusBottomLeft;
      if (spec.radiusBottomRight != null)
        r.bottomRightRadius = spec.radiusBottomRight;
    }
  }

  if (
    (node.type === 'POLYGON' || node.type === 'STAR') &&
    spec.pointCount != null
  ) {
    (node as PolygonNode).pointCount = spec.pointCount;
  }
  if (node.type === 'STAR' && spec.innerRadius != null) {
    (node as StarNode).innerRadius = spec.innerRadius;
  }

  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    const family = spec.fontFamily ?? 'PingFang SC';
    const style =
      spec.fontWeight != null && spec.fontWeight >= 600 ? 'Bold' : 'Regular';
    if (textNode.fontName !== jsDesign.mixed) {
      await loadFont(family, style);
      textNode.fontName = { family, style };
    }
    textNode.characters = spec.characters ?? 'text';
    textNode.fontSize = spec.fontSize ?? 16;
    if (spec.textAlign != null) {
      textNode.textAlignHorizontal =
        spec.textAlign.toUpperCase() as TextNode['textAlignHorizontal'];
    }
    if (spec.lineHeight != null)
      textNode.lineHeight = { value: spec.lineHeight, unit: 'PIXELS' };
    if (spec.letterSpacing != null)
      textNode.letterSpacing = { value: spec.letterSpacing, unit: 'PIXELS' };
  }

  if (node.type === 'FRAME' && spec.layout && 'layoutMode' in node) {
    const frame = node as FrameNode;
    frame.layoutMode =
      spec.layout.mode === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL';
    frame.itemSpacing = spec.layout.itemSpacing ?? 0;
    frame.paddingTop =
      frame.paddingRight =
      frame.paddingBottom =
      frame.paddingLeft =
        spec.layout.padding ?? 0;
  }

  parent.appendChild(node);
  for (const child of spec.children ?? []) {
    await buildNode(child, node as unknown as BaseNode & ChildrenMixin);
  }
  return node;
}

export default buildNode;
