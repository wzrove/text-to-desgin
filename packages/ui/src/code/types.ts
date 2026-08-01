export interface SpecLayout {
  mode?: 'HORIZONTAL' | 'VERTICAL'
  itemSpacing?: number
  padding?: number
}

export interface SpecShadow {
  color?: string
  x?: number
  y?: number
  radius?: number
  spread?: number
}

export interface SpecGradient {
  stops: { color: string; position: number }[]
  angle?: number
}

export interface Spec {
  op?: 'frame' | 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'vector' | 'text'
  name?: string
  x?: number
  y?: number
  w?: number
  h?: number
  fill?: string
  radius?: number
  radiusTopLeft?: number
  radiusTopRight?: number
  radiusBottomLeft?: number
  radiusBottomRight?: number
  rotation?: number
  opacity?: number
  stroke?: string
  strokeWeight?: number
  shadow?: SpecShadow
  gradient?: SpecGradient
  pointCount?: number
  innerRadius?: number
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  characters?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  layout?: SpecLayout
  children?: Spec[]
}

const OPS = ['frame', 'rect', 'ellipse', 'line', 'polygon', 'star', 'vector', 'text']

function toSpec(raw: unknown): Spec {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`无效的节点指令: 期望对象,收到 ${raw === null ? 'null' : typeof raw}`)
  }
  const spec = raw as Spec
  if (spec.op !== undefined && OPS.indexOf(spec.op) === -1) {
    throw new Error(`无效的 op: "${spec.op}"(支持 frame|rect|ellipse|line|polygon|star|vector|text)`)
  }
  return spec
}

export function toSpecs(ops: unknown): Spec[] {
  if (Array.isArray(ops)) {
    if (ops.length === 0) throw new Error('ops 为空数组,无可执行指令')
    return ops.map(toSpec)
  }
  return [toSpec(ops)]
}
