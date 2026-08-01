import type { Spec } from './types'
import { paint, rgb } from './color'

interface ShadowLike {
  color?: string
  x?: number
  y?: number
  radius?: number
  spread?: number
}

export function makeShadowEffect(shadow?: ShadowLike): Effect[] {
  if (!shadow) return []
  const color = rgb(shadow.color ?? '#000000')
  const alpha = shadow.color?.startsWith('#') && shadow.color.length === 9
    ? parseInt(shadow.color.slice(7, 9), 16) / 255
    : 0.15
  return [
    {
      type: 'DROP_SHADOW',
      color: { r: color.r, g: color.g, b: color.b, a: alpha },
      offset: { x: shadow.x ?? 0, y: shadow.y ?? 4 },
      radius: shadow.radius ?? 12,
      visible: true,
      blendMode: 'NORMAL',
      spread: shadow.spread ?? 0,
    },
  ]
}

function gradientTransform(angle: number): Transform {
  const rad = ((angle ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = 0.5 - cos * 0.5 + sin * 0.5
  const dy = 0.5 - sin * 0.5 - cos * 0.5
  return [
    [cos, -sin, dx],
    [sin, cos, dy],
  ]
}

export function gradientPaint(spec: Spec): Paint[] {
  if (!spec.gradient) return paint(spec.fill ?? '#000000')
  const stops = spec.gradient.stops.map((s) => ({
    position: s.position,
    color: { ...rgb(s.color), a: 1 },
  }))
  return [
    {
      type: 'GRADIENT_LINEAR',
      gradientTransform: gradientTransform(spec.gradient.angle ?? 0),
      gradientStops: stops,
    },
  ]
}
