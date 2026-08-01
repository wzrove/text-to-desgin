import type { ChildNode } from 'domhandler';
import { type Element, isTag, type Text } from 'domhandler';
import { parseDocument } from 'htmlparser2';

interface CssStyle {
  [key: string]: string;
}

interface Box {
  tag: string;
  text?: string;
  style: CssStyle;
  children: Box[];
  isText: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

const SKIP_TAGS = new Set([
  'script',
  'style',
  'head',
  'meta',
  'link',
  'title',
  'noscript',
]);

const COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  gray: '#808080',
  grey: '#808080',
  transparent: 'none',
};

const FALLBACK_BG = '#f3f4f6';

function parseStyle(attr?: string): CssStyle {
  const out: CssStyle = {};
  if (!attr) return out;
  for (const part of attr.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function num(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const m = value.match(/^(-?[\d.]+)(px)?$/);
  return m ? parseFloat(m[1]) : undefined;
}

function color(
  value: string | undefined,
  fallback?: string,
): string | undefined {
  if (value == null || value === '') return fallback;
  const v = value.trim();
  if (v === 'transparent') return 'none';
  const named = COLORS[v.toLowerCase()];
  if (named) return named;
  if (v.startsWith('#') || v.startsWith('rgb')) return v;
  return fallback;
}

function parseMargin(style: CssStyle): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const s = style.margin;
  const parts = (s ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => num(p) ?? 0);
  let top = 0,
    right = 0,
    bottom = 0,
    left = 0;
  if (parts.length === 1) top = right = bottom = left = parts[0];
  else if (parts.length === 2) {
    top = bottom = parts[0];
    right = left = parts[1];
  } else if (parts.length === 4) {
    top = parts[0];
    right = parts[1];
    bottom = parts[2];
    left = parts[3];
  }
  top = num(style['margin-top']) ?? top;
  right = num(style['margin-right']) ?? right;
  bottom = num(style['margin-bottom']) ?? bottom;
  left = num(style['margin-left']) ?? left;
  return { top, right, bottom, left };
}

function parsePadding(style: CssStyle): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const s = style.padding;
  const parts = (s ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => num(p) ?? 0);
  let top = 0,
    right = 0,
    bottom = 0,
    left = 0;
  if (parts.length === 1) top = right = bottom = left = parts[0];
  else if (parts.length === 2) {
    top = bottom = parts[0];
    right = left = parts[1];
  } else if (parts.length === 4) {
    top = parts[0];
    right = parts[1];
    bottom = parts[2];
    left = parts[3];
  }
  top = num(style['padding-top']) ?? top;
  right = num(style['padding-right']) ?? right;
  bottom = num(style['padding-bottom']) ?? bottom;
  left = num(style['padding-left']) ?? left;
  return { top, right, bottom, left };
}

function parseBorder(style: CssStyle): { width: number; color: string } {
  const none = { width: 0, color: '#000000' };
  const s = style.border;
  if (s && s !== 'none' && s !== '0') {
    const m = s.match(/([\d.]+)(?:px)?(?:\s+[^ ]+)?\s+(.+)$/);
    if (m)
      return { width: parseFloat(m[1]) || 1, color: color(m[2]) ?? '#000000' };
    const m2 = s.match(/([\d.]+)(?:px)?/);
    if (m2) return { width: parseFloat(m2[1]), color: '#000000' };
  }
  if (
    style['border-width'] &&
    style['border-width'] !== '0' &&
    style['border-width'] !== 'none'
  ) {
    return {
      width: num(style['border-width']) ?? 1,
      color: color(style['border-color']) ?? '#000000',
    };
  }
  return none;
}

function px(style: CssStyle, key: string): number | undefined {
  return num(style[key]);
}

function fontSize(style: CssStyle): number {
  return num(style['font-size']) ?? 16;
}

function fontWeight(style: CssStyle): number {
  const w = style['font-weight'];
  if (w === 'bold') return 700;
  const n = num(w);
  return n ?? 400;
}

function lineHeight(style: CssStyle, fs: number): number {
  const lh = style['line-height'];
  const n = num(lh);
  if (n != null) return n;
  if (lh != null && !lh.endsWith('px')) return parseFloat(lh) * fs;
  return fs * 1.4;
}

function displayFlex(style: CssStyle): boolean {
  return (style.display ?? '').includes('flex');
}

function flexDirection(style: CssStyle): 'row' | 'column' {
  const d = style['flex-direction'];
  return d === 'row' ? 'row' : 'column';
}

function gapValue(style: CssStyle): number {
  return num(style.gap) ?? num(style['row-gap']) ?? 0;
}

function textAlign(style: CssStyle): 'left' | 'center' | 'right' {
  const a = style['text-align'];
  if (a === 'center') return 'center';
  if (a === 'right') return 'right';
  return 'left';
}

function estTextWidth(text: string, fs: number): number {
  let w = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) > 0x2e80) w += fs;
    else w += fs * 0.55;
  }
  return w;
}

function collectText(node: ChildNode): string {
  if (node.type === 'text') return (node as Text).data;
  if (isTag(node)) {
    if (node.tagName === 'br') return '\n';
    return node.children.map(collectText).join('');
  }
  return '';
}

function trimCollapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseBox(parent: Element, root: boolean): Box {
  const style = parseStyle(parent.attribs.style);
  const box: Box = {
    tag: parent.tagName,
    style,
    children: [],
    isText: false,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
  if (parent.tagName === 'img') {
    box.w = px(style, 'width') ?? 120;
    box.h = px(style, 'height') ?? 120;
    return box;
  }
  for (const child of parent.children) {
    if (child.type === 'text') {
      const t = trimCollapse((child as Text).data);
      if (!t) continue;
      const last = box.children[box.children.length - 1];
      if (last?.isText) last.text = (last.text ?? '') + t;
      else
        box.children.push({
          tag: '#text',
          text: t,
          style: inheritTextStyle(style),
          children: [],
          isText: true,
          x: 0,
          y: 0,
          w: 0,
          h: 0,
        });
      continue;
    }
    if (!isTag(child)) continue;
    if (SKIP_TAGS.has(child.tagName)) continue;
    if (child.tagName === 'br') continue;
    box.children.push(parseBox(child, false));
  }
  if (root && box.children.length === 0) {
    const t = trimCollapse(parent.children.map(collectText).join(''));
    if (t)
      box.children.push({
        tag: '#text',
        text: t,
        style: inheritTextStyle(style),
        children: [],
        isText: true,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      });
  }
  return box;
}

function inheritTextStyle(parent: CssStyle): CssStyle {
  const out: CssStyle = {};
  const keys = [
    'color',
    'font-size',
    'font-weight',
    'font-family',
    'line-height',
    'text-align',
    'letter-spacing',
  ];
  for (const k of keys) {
    if (parent[k] != null) out[k] = parent[k];
  }
  return out;
}

interface LayoutResult {
  width: number;
  height: number;
}

function layout(box: Box, maxWidth: number): LayoutResult {
  const style = box.style;
  const pad = parsePadding(style);
  const margin = parseMargin(style);
  const border = parseBorder(style);
  const innerW = Math.max(
    0,
    maxWidth - pad.left - pad.right - border.width * 2,
  );

  if (box.tag === 'img') {
    box.w = px(style, 'width') ?? 120;
    box.h = px(style, 'height') ?? 120;
    return {
      width: box.w + margin.left + margin.right,
      height: box.h + margin.top + margin.bottom,
    };
  }

  let contentW = innerW;
  let contentH = 0;

  if (box.isText) {
    const fs = fontSize(style);
    const text = box.text ?? '';
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const textW = Math.min(
      innerW,
      Math.max(...lines.map((l) => estTextWidth(l, fs)), fs),
    );
    box.w = textW;
    box.h = lines.length * lineHeight(style, fs);
    contentH = box.h;
  } else {
    const flex = displayFlex(style);
    const direction = flexDirection(style);
    const gap = gapValue(style);
    const explicitW = px(style, 'width');
    const explicitH = px(style, 'height');

    if (explicitW != null)
      contentW = Math.max(
        0,
        explicitW - pad.left - pad.right - border.width * 2,
      );

    if (flex && direction === 'row') {
      let x = 0;
      let rowH = 0;
      for (const child of box.children) {
        const r = layout(child, contentW - x);
        child.x = x + pad.left + border.width;
        child.y = pad.top + border.width;
        if (child.isText && textAlign(child.style) !== 'left')
          child.w = contentW - x;
        x += r.width;
        x += gap;
        rowH = Math.max(rowH, r.height);
      }
      contentH = rowH;
      box.w = x - (box.children.length ? gap : 0);
    } else {
      let y = 0;
      let maxW = 0;
      for (const child of box.children) {
        const r = layout(child, contentW);
        child.x = pad.left + border.width;
        child.y = y + pad.top + border.width;
        if (child.isText && textAlign(child.style) !== 'left')
          child.w = contentW;
        y += r.height;
        y += gap;
        maxW = Math.max(maxW, r.width);
      }
      contentH = y - (box.children.length ? gap : 0);
      box.w = maxW;
    }

    box.w = explicitW ?? box.w;
    box.h = explicitH ?? contentH;
    contentH = explicitH ?? contentH;
  }

  const padW = pad.left + pad.right + border.width * 2;
  const padH = pad.top + pad.bottom + border.width * 2;
  if (px(style, 'width') == null) box.w += padW;
  if (px(style, 'height') == null && !box.isText) box.h += padH;
  return {
    width: box.w + margin.left + margin.right,
    height: box.h + margin.top + margin.bottom,
  };
}

function applyMarginOffset(box: Box): void {
  const margin = parseMargin(box.style);
  box.x += margin.left;
  box.y += margin.top;
}

function emitSvg(box: Box, rootWidth: number, rootHeight: number): string {
  const parts: string[] = [];
  emit(box, parts, 0, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${rootWidth}" height="${rootHeight}" viewBox="0 0 ${rootWidth} ${rootHeight}">${parts.join('')}</svg>`;
}

function emit(box: Box, parts: string[], ox: number, oy: number): void {
  const style = box.style;
  const x = ox + box.x;
  const y = oy + box.y;
  const w = box.w;
  const h = box.h;

  if (box.isText) {
    const fs = fontSize(style);
    const fill = color(style.color, '#000000');
    const family = style['font-family'] ?? 'sans-serif';
    const weight = fontWeight(style);
    const align = textAlign(style);
    const anchor =
      align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
    const lineH = lineHeight(style, fs);
    const lines = (box.text ?? '').split('\n').filter((l) => l.trim());
    lines.forEach((line, i) => {
      parts.push(
        `<text x="${tx.toFixed(1)}" y="${(y + lineH * i + fs).toFixed(1)}" font-size="${fs}" font-family="${family}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(line)}</text>`,
      );
    });
    return;
  }

  const bg = color(
    style.background ?? style['background-color'],
    box.tag === 'img' ? FALLBACK_BG : undefined,
  );
  const border = parseBorder(style);
  const radius = num(style['border-radius']) ?? 0;
  const visible = bg && bg !== 'none';

  if (box.tag === 'img' || visible || border.width > 0) {
    const attrs = [
      `x="${x.toFixed(1)}"`,
      `y="${y.toFixed(1)}"`,
      `width="${Math.max(0, w).toFixed(1)}"`,
      `height="${Math.max(0, h).toFixed(1)}"`,
    ];
    if (radius > 0) attrs.push(`rx="${radius}"`);
    if (visible) attrs.push(`fill="${bg}"`);
    if (border.width > 0)
      attrs.push(`stroke="${border.color}" stroke-width="${border.width}"`);
    parts.push(`<rect ${attrs.join(' ')} />`);
  }

  for (const child of box.children) {
    applyMarginOffset(child);
    emit(child, parts, x, y);
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function htmlToSvg(html: string): string {
  const doc = parseDocument(html, { decodeEntities: true });
  const rootEls = doc.children.filter((n): n is Element => isTag(n));
  const bodyEl = rootEls.find((el) => el.tagName === 'body') ?? rootEls[0];
  if (!bodyEl) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>`;
  }
  const root = parseBox(bodyEl, true);
  const rootStyle = parseStyle(bodyEl.attribs.style);
  const explicitW = px(rootStyle, 'width');
  const explicitH = px(rootStyle, 'height');
  const l = layout(root, explicitW ?? 800);
  const width = explicitW ?? Math.min(l.width, 1600);
  const height = explicitH ?? l.height;
  root.x = 0;
  root.y = 0;
  if (explicitW == null) root.w = width;
  if (explicitH == null) root.h = height;
  return emitSvg(root, width, height);
}
