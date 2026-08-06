export const WS_PORT = 47812;

export type PluginMethod =
  | 'ping'
  | 'get_selection'
  | 'execute'
  | 'create_svg'
  | 'update_selection'
  | 'find'
  | 'export'
  | 'list_fonts'
  | 'fill_image'
  | 'node_op'
  | 'component_op';

export type PingParams = Record<string, never>;

export interface GetSelectionParams {
  /** 序列化深度,0 表示只含节点自身属性;缺省 2 */
  depth?: number;
}

export interface ExecuteParams {
  ops: unknown;
}

export interface CreateSvgParams {
  svg: string;
  name?: string;
}

export interface UpdateSelectionProps {
  name?: string;
  fill?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  cornerRadius?: number;
  radiusTopLeft?: number;
  radiusTopRight?: number;
  radiusBottomLeft?: number;
  radiusBottomRight?: number;
  visible?: boolean;
  rotation?: number;
  opacity?: number;
  characters?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  lineHeight?: number;
  letterSpacing?: number;
  stroke?: string;
  strokeWeight?: number;
  strokeAlign?: 'CENTER' | 'INSIDE' | 'OUTSIDE';
  shadow?: ShadowProps;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  padding?: number;
  pointCount?: number;
}

export interface ShadowProps {
  color?: string;
  x?: number;
  y?: number;
  radius?: number;
  spread?: number;
}

export interface UpdateSelectionParams {
  ids?: string[];
  matchName?: string;
  recursive?: boolean;
  props: UpdateSelectionProps;
}

export interface FindParams {
  name?: string;
  type?: string;
  recursive?: boolean;
  /** 序列化深度,缺省 1 */
  depth?: number;
}

export interface NodeOpParams {
  op:
    | 'select'
    | 'remove'
    | 'clone'
    | 'group'
    | 'ungroup'
    | 'flatten'
    | 'outline_stroke'
    | 'reparent';
  ids?: string[];
  matchName?: string;
  name?: string;
  ungroup?: boolean;
  parentId?: string;
  index?: number;
}

export interface ComponentOpParams {
  op:
    | 'create_component'
    | 'create_instance'
    | 'detach_instance'
    | 'import_component'
    | 'swap_component'
    | 'set_instance_properties'
    | 'combine_as_variants';
  ids?: string[];
  name?: string;
  componentId?: string;
  key?: string;
  properties?: Record<string, string>;
}

export interface ExportParams {
  ids: string[];
  format?: 'PNG' | 'JPG' | 'SVG' | 'PDF';
  scale?: number;
  savePath?: string;
  includeDataUrl?: boolean;
}

export interface FillImageParams {
  ids: string[];
  bytes?: Uint8Array;
  hasBinary?: boolean;
}

export type ListFontsParams = Record<string, never>;

export type RequestParams<M extends PluginMethod> = M extends 'ping'
  ? PingParams
  : M extends 'get_selection'
    ? GetSelectionParams
    : M extends 'execute'
      ? ExecuteParams
      : M extends 'create_svg'
        ? CreateSvgParams
        : M extends 'update_selection'
          ? UpdateSelectionParams
          : M extends 'find'
            ? FindParams
            : M extends 'export'
              ? ExportParams
              : M extends 'fill_image'
                ? FillImageParams
                : M extends 'node_op'
                  ? NodeOpParams
                  : M extends 'component_op'
                    ? ComponentOpParams
                    : ListFontsParams;

export type PluginRequest = (
  | { type: 'request'; id: string; method: 'ping'; params: PingParams }
  | {
      type: 'request';
      id: string;
      method: 'get_selection';
      params: GetSelectionParams;
    }
  | { type: 'request'; id: string; method: 'execute'; params: ExecuteParams }
  | {
      type: 'request';
      id: string;
      method: 'create_svg';
      params: CreateSvgParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'update_selection';
      params: UpdateSelectionParams;
    }
  | { type: 'request'; id: string; method: 'find'; params: FindParams }
  | { type: 'request'; id: string; method: 'export'; params: ExportParams }
  | {
      type: 'request';
      id: string;
      method: 'fill_image';
      params: FillImageParams;
    }
  | { type: 'request'; id: string; method: 'node_op'; params: NodeOpParams }
  | {
      type: 'request';
      id: string;
      method: 'component_op';
      params: ComponentOpParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'list_fonts';
      params: ListFontsParams;
    }
) & {
  /** 目标 MCP server 端口;缺省时路由到第一个已连接 server */
  server?: number;
};

export type PluginResponse<D = unknown> = {
  type: 'response';
  id: string;
  ok: boolean;
  data?: D;
  error?: string;
  hasBinary?: boolean;
  binaryCount?: number;
};

export function makeResponse<D>(
  id: string,
  ok: boolean,
  data?: D,
  error?: string,
): PluginResponse<D> {
  return { type: 'response', id, ok, data, error };
}
