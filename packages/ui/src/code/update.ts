import type { UpdateSelectionProps } from '@jsdesign/shared'
import { paint } from './color'
import { serializeNode } from './serialize'
import { findNode, loadFont, collectTargets } from './utils'
import { makeShadowEffect } from './style'

function textStyleName(weight: number | undefined): string {
  if (weight == null) return 'Regular'
  if (weight >= 700) return 'Bold'
  if (weight >= 600) return 'SemiBold'
  if (weight >= 500) return 'Medium'
  return 'Regular'
}

async function applyProps(node: SceneNode, props: UpdateSelectionProps): Promise<void> {
  if (props.name != null) node.name = props.name
  if (props.x != null) node.x = props.x
  if (props.y != null) node.y = props.y
  if (props.visible != null) node.visible = props.visible
  if (props.rotation != null) node.rotation = props.rotation
  if (props.opacity != null && 'opacity' in node) node.opacity = props.opacity
  if (props.w != null || props.h != null) {
    const w = props.w ?? node.width
    const h = props.h ?? node.height
    if ('resize' in node) node.resize(w, h)
  }
  if (props.fill != null && 'fills' in node) node.fills = paint(props.fill)
  if (props.stroke != null && 'strokes' in node) node.strokes = paint(props.stroke)
  if (props.strokeWeight != null && 'strokeWeight' in node) node.strokeWeight = props.strokeWeight
  if (props.strokeAlign != null && 'strokeAlign' in node) node.strokeAlign = props.strokeAlign
  if (props.cornerRadius != null && 'cornerRadius' in node) node.cornerRadius = props.cornerRadius
  if ('topLeftRadius' in node) {
    const r = node as RectangleNode
    if (props.radiusTopLeft != null) r.topLeftRadius = props.radiusTopLeft
    if (props.radiusTopRight != null) r.topRightRadius = props.radiusTopRight
    if (props.radiusBottomLeft != null) r.bottomLeftRadius = props.radiusBottomLeft
    if (props.radiusBottomRight != null) r.bottomRightRadius = props.radiusBottomRight
  }
  if (props.pointCount != null && (node.type === 'POLYGON' || node.type === 'STAR')) {
    ;(node as PolygonNode).pointCount = props.pointCount
  }
  if (props.shadow != null && 'effects' in node) {
    node.effects = makeShadowEffect(props.shadow)
  }

  if (node.type === 'TEXT') {
    const text = node as TextNode
    const needLoad = props.characters != null || props.fontSize != null || props.fontFamily != null || props.fontWeight != null
    if (needLoad) {
      const family = props.fontFamily ?? ((text.fontName as FontName).family ?? 'PingFang SC')
      const style = textStyleName(props.fontWeight)
      if (text.fontName !== jsDesign.mixed) {
        await loadFont(family, style)
        text.fontName = { family, style }
      }
    }
    if (props.characters != null) text.characters = props.characters
    if (props.fontSize != null) text.fontSize = props.fontSize
    if (props.textAlign != null) text.textAlignHorizontal = props.textAlign
    if (props.lineHeight != null) text.lineHeight = { value: props.lineHeight, unit: 'PIXELS' }
    if (props.letterSpacing != null) text.letterSpacing = { value: props.letterSpacing, unit: 'PIXELS' }
  }

  if (node.type === 'FRAME' && props.layoutMode != null && 'layoutMode' in node) {
    const frame = node as FrameNode
    frame.layoutMode = props.layoutMode
  }
  if (node.type === 'FRAME' && props.itemSpacing != null && 'itemSpacing' in node) {
    ;(node as FrameNode).itemSpacing = props.itemSpacing
  }
  if (node.type === 'FRAME' && props.padding != null) {
    const frame = node as FrameNode
    frame.paddingTop = frame.paddingRight = frame.paddingBottom = frame.paddingLeft = props.padding
  }
}

export async function updateSelection(params: {
  ids?: string[]
  matchName?: string
  recursive?: boolean
  props: UpdateSelectionProps
}): Promise<Record<string, unknown>> {
  const props = params.props ?? {}
  let base: readonly SceneNode[]
  if (params.ids != null && params.ids.length > 0) {
    base = findNode(params.ids)
  } else {
    base = jsDesign.currentPage.selection
  }
  if (base.length === 0) {
    throw new Error('没有可修改的节点: 请先选中节点,或传入有效的 ids')
  }
  const targets = collectTargets(base, params.matchName, params.recursive ?? false)
  if (targets.length === 0) {
    throw new Error(`没有命中 matchName="${params.matchName}" 的节点`)
  }
  for (const node of targets) {
    await applyProps(node, props)
  }
  return { updated: targets.map((n) => serializeNode(n)) }
}
