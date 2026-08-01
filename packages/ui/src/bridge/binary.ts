/** 从响应 data 中提取所有 Uint8Array 字节(支持 {exports:[{bytes}]}、{exports:{id:{bytes}}} 或 {bytes}) */
export function extractBytes(data: unknown): Uint8Array[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (d.exports && typeof d.exports === 'object') {
    const exports_ = d.exports as Record<string, unknown>;
    const items = Array.isArray(exports_) ? exports_ : Object.values(exports_);
    const list: Uint8Array[] = [];
    for (const e of items) {
      const b = (e as Record<string, unknown>)?.bytes;
      if (b instanceof Uint8Array) list.push(b);
    }
    return list.length > 0 ? list : [];
  }
  if (d.bytes instanceof Uint8Array) return [d.bytes];
  return [];
}

/** 移除 data 中的 bytes 字段,meta 帧只留元数据 */
export function stripBytes(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const d = data as Record<string, unknown>;
  if (d.exports && typeof d.exports === 'object') {
    const exports_ = d.exports as Record<string, unknown>;
    const stripped = Array.isArray(exports_)
      ? exports_.map((e) => {
          const { bytes: _b, ...rest } = e as Record<string, unknown>;
          return rest;
        })
      : Object.fromEntries(
          Object.entries(exports_).map(([k, e]) => {
            const { bytes: _b, ...rest } = e as Record<string, unknown>;
            return [k, rest];
          }),
        );
    return { ...d, exports: stripped };
  }
  const { bytes: _b, ...rest } = d;
  return rest;
}
