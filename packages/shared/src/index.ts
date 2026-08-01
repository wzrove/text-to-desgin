export const WS_PORT = 47812;

export type PluginMethod =
  | 'ping'
  | 'get_selection'
  | 'execute'
  | 'create_svg'
  | 'update_selection'
  | 'find'
  | 'set_selection'
  | 'remove'
  | 'clone'
  | 'group'
  | 'export'
  | 'list_fonts'
  | 'fill_image'
  | 'flatten'
  | 'outline_stroke'
  | 'reparent'
  | 'create_component'
  | 'create_instance'
  | 'swap_component'
  | 'set_instance_properties'
  | 'import_component'
  | 'combine_as_variants'
  | 'detach_instance';

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

export interface SetSelectionParams {
  ids: string[];
}

export interface RemoveParams {
  ids?: string[];
  matchName?: string;
}

export interface CloneParams {
  ids: string[];
}

export interface GroupParams {
  ids: string[];
  name?: string;
  ungroup?: boolean;
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

export interface FlattenParams {
  ids: string[];
}

export interface OutlineStrokeParams {
  ids: string[];
}

export interface ReparentParams {
  ids: string[];
  parentId?: string;
  index?: number;
}

export interface CreateComponentParams {
  ids: string[];
  name?: string;
}

export interface CreateInstanceParams {
  ids: string[];
}

export interface SwapComponentParams {
  ids: string[];
  componentId: string;
}

export interface SetInstancePropertiesParams {
  ids: string[];
  properties: Record<string, string>;
}

export interface ImportComponentParams {
  key: string;
  name?: string;
}

export interface CombineAsVariantsParams {
  ids: string[];
  name?: string;
}

export interface DetachInstanceParams {
  ids: string[];
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
            : M extends 'set_selection'
              ? SetSelectionParams
              : M extends 'remove'
                ? RemoveParams
                : M extends 'clone'
                  ? CloneParams
                  : M extends 'group'
                    ? GroupParams
                    : M extends 'export'
                      ? ExportParams
                      : M extends 'fill_image'
                        ? FillImageParams
                        : M extends 'flatten'
                          ? FlattenParams
                          : M extends 'outline_stroke'
                            ? OutlineStrokeParams
                            : M extends 'reparent'
                              ? ReparentParams
                              : M extends 'create_component'
                                ? CreateComponentParams
                                : M extends 'create_instance'
                                  ? CreateInstanceParams
                                  : M extends 'swap_component'
                                    ? SwapComponentParams
                                    : M extends 'set_instance_properties'
                                      ? SetInstancePropertiesParams
                                      : M extends 'import_component'
                                        ? ImportComponentParams
                                        : M extends 'combine_as_variants'
                                          ? CombineAsVariantsParams
                                          : M extends 'detach_instance'
                                            ? DetachInstanceParams
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
  | {
      type: 'request';
      id: string;
      method: 'set_selection';
      params: SetSelectionParams;
    }
  | { type: 'request'; id: string; method: 'remove'; params: RemoveParams }
  | { type: 'request'; id: string; method: 'clone'; params: CloneParams }
  | { type: 'request'; id: string; method: 'group'; params: GroupParams }
  | { type: 'request'; id: string; method: 'export'; params: ExportParams }
  | {
      type: 'request';
      id: string;
      method: 'fill_image';
      params: FillImageParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'flatten';
      params: FlattenParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'outline_stroke';
      params: OutlineStrokeParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'reparent';
      params: ReparentParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'create_component';
      params: CreateComponentParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'create_instance';
      params: CreateInstanceParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'swap_component';
      params: SwapComponentParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'set_instance_properties';
      params: SetInstancePropertiesParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'import_component';
      params: ImportComponentParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'combine_as_variants';
      params: CombineAsVariantsParams;
    }
  | {
      type: 'request';
      id: string;
      method: 'detach_instance';
      params: DetachInstanceParams;
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
