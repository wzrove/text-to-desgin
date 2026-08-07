#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { version } from '../package.json' with { type: 'json' };
import { Bridge } from './bridge';
import { htmlToSvg } from './htmlToDesign';
import { log } from './logger';

const PORT = Number(process.env.TEXT_TO_DESIGN_MCP_PORT ?? 47812);
const HTTP_PORT = Number(process.env.TEXT_TO_DESIGN_MCP_HTTP_PORT ?? 47820);
const SERVER_NAME = 'text-to-design-mcp-server';
const SERVER_VERSION = version;
const DAEMON_WAIT_MS = 5000;
const DAEMON_POLL_MS = 250;

const bridge = new Bridge();

function text(content: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [
      {
        type: 'text',
        text:
          typeof content === 'string'
            ? content
            : JSON.stringify(content, null, 2),
      },
    ],
  };
}

function err(e: unknown): { content: { type: 'text'; text: string }[] } {
  return {
    content: [
      {
        type: 'text',
        text: `错误: ${e instanceof Error ? e.message : String(e)}`,
      },
    ],
  };
}

/** 返回类型:人读文本 + 结构化数据(与 outputSchema 对应) */
function structured(data: unknown): {
  content: { type: 'text'; text: string }[];
  structuredContent: unknown;
} {
  return { content: text(data).content, structuredContent: data };
}

// 输出 schema(各工具 outputSchema 复用)
const nodeTypeEnum = z.enum([
  'SLICE',
  'FRAME',
  'GROUP',
  'COMPONENT_SET',
  'COMPONENT',
  'INSTANCE',
  'BOOLEAN_OPERATION',
  'VECTOR',
  'STAR',
  'LINE',
  'ELLIPSE',
  'POLYGON',
  'RECTANGLE',
  'TEXT',
]);

const serializedNodeSchema: z.ZodType<unknown> = z.object({
  id: z.string(),
  name: z.string(),
  type: nodeTypeEnum,
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  opacity: z.number().optional(),
  fill: z.string().optional(),
  gradient: z
    .object({
      type: z.literal('GRADIENT_LINEAR'),
      stops: z.array(z.object({ color: z.string(), position: z.number() })),
    })
    .optional(),
  stroke: z.string().optional(),
  strokeWeight: z.number().optional(),
  shadow: z
    .object({
      x: z.number(),
      y: z.number(),
      radius: z.number(),
      color: z.string(),
    })
    .optional(),
  cornerRadius: z.number().optional(),
  radiusTopLeft: z.number().optional(),
  radiusTopRight: z.number().optional(),
  radiusBottomLeft: z.number().optional(),
  radiusBottomRight: z.number().optional(),
  pointCount: z.number().optional(),
  layout: z
    .object({
      mode: z.enum(['HORIZONTAL', 'VERTICAL']),
      itemSpacing: z.number().optional(),
      padding: z.number().optional(),
    })
    .optional(),
  childCount: z.number().optional(),
  children: z.array(z.lazy(() => serializedNodeSchema)).optional(),
  characters: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.string().optional(),
  vectorPaths: z
    .array(z.object({ data: z.string(), windingRule: z.string() }))
    .optional(),
  variantProperties: z.record(z.string(), z.string()).optional(),
  mainComponentId: z.string().optional(),
  variantGroupProperties: z.record(z.string(), z.array(z.string())).optional(),
});

const createdResultSchema = z.object({
  created: z.union([serializedNodeSchema, z.array(serializedNodeSchema)]),
});
const updatedResultSchema = z.object({
  updated: z.array(serializedNodeSchema),
});
const pingResultSchema = z.object({
  connected: z.boolean(),
  error: z.string().optional(),
});
const getSelectionResultSchema = z.object({
  selection: z.array(serializedNodeSchema),
  pageName: z.string(),
});
const findResultSchema = z.object({
  nodes: z.array(serializedNodeSchema),
  total: z.number(),
});
const manageNodesResultSchema = z.object({
  selected: z.array(z.string()).optional(),
  removed: z.array(z.string()).optional(),
  ungrouped: z.array(z.string()).optional(),
  moved: z.array(serializedNodeSchema).optional(),
  created: z
    .union([serializedNodeSchema, z.array(serializedNodeSchema)])
    .optional(),
});
const manageComponentsResultSchema = z.object({
  created: z
    .union([serializedNodeSchema, z.array(serializedNodeSchema)])
    .optional(),
  swapped: z.array(serializedNodeSchema).optional(),
  updated: z.array(serializedNodeSchema).optional(),
});
const exportResultSchema = z.object({
  exports: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      format: z.enum(['PNG', 'JPG', 'SVG', 'PDF']),
      mimeType: z.string(),
      size: z.number(),
      path: z.string().optional(),
      dataUrl: z.string().optional(),
    }),
  ),
});
const listFontsResultSchema = z.object({
  families: z.array(z.string()),
  count: z.number(),
});

function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      supportedProtocolVersions: ['2026-07-28', ...SUPPORTED_PROTOCOL_VERSIONS],
    },
  );

  server.registerTool(
    'jsd_ping',
    {
      description: '检查 jsDesign 插件是否在线(需先启动插件并保持运行)',
      outputSchema: pingResultSchema,
    },
    async () => {
      try {
        await bridge.request('ping', {});
        return structured({ connected: true });
      } catch (e) {
        return structured({
          connected: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
  );

  server.registerTool(
    'jsd_get_selection',
    {
      description:
        '获取即时设计画布当前选中的节点信息(名称/类型/尺寸/位置/填充/文本/子树结构)',
      outputSchema: getSelectionResultSchema,
    },
    async () => {
      try {
        const data = await bridge.request('get_selection', {});
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_execute',
    {
      description:
        '在画布执行声明式设计指令。ops 为节点数组,每项: {op:"frame"|"rect"|"ellipse"|"line"|"polygon"|"star"|"vector"|"boolean"|"text", name?, x?, y?, w?, h?, fill?, radius?, rotation?, opacity?, stroke?, strokeWeight?, shadow?:{color,x,y,radius,spread}, gradient?:{stops:[{color,position}],angle}, pointCount?, fontSize?, fontWeight?, fontFamily?, characters?, textAlign?, lineHeight?, letterSpacing?, layout?:{mode,itemSpacing,padding}, radiusTopLeft?..., children?:[...] }。op 为 vector 时可用 paths 传 SVG path data(单个或数组,如 "M0 0 L100 0 L100 100 Z",可含 windingRule);op 为 boolean 时 children 至少 2 个,booleanType 取 UNION|SUBTRACT|INTERSECT|EXCLUDE(默认 UNION)。自动插入到画布中心',
      inputSchema: z.object({
        ops: z.array(z.any()).describe('设计指令节点树'),
      }),
      outputSchema: createdResultSchema,
    },
    async ({ ops }) => {
      try {
        const data = await bridge.request('execute', { ops });
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_create_svg',
    {
      description:
        '将 SVG 字符串直接导入画布(原生 createNodeFromSvg,完整保留 path/矢量/渐变/描边,不经 htmlToSvg 降级)',
      inputSchema: z.object({
        svg: z
          .string()
          .describe(
            '完整 SVG 字符串,如 <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M0 0 L100 0 L100 100 Z" fill="#ff0000"/></svg>',
          ),
        name: z.string().optional().describe('生成的图层名,默认 svg-design'),
      }),
      outputSchema: createdResultSchema,
    },
    async ({ svg, name }) => {
      try {
        const data = await bridge.request('create_svg', {
          svg,
          name: name ?? 'svg-design',
        });
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_html_to_design',
    {
      description:
        '将 HTML 字符串转换为 jsDesign 设计节点(SVG 保真路线,忽略复杂样式),插入画布中心',
      inputSchema: z.object({
        html: z.string().describe('HTML 片段,支持内联 style'),
        name: z.string().optional().describe('生成的图层名,默认 html-design'),
      }),
      outputSchema: createdResultSchema,
    },
    async ({ html, name }) => {
      try {
        const svg = htmlToSvg(html);
        const data = await bridge.request('create_svg', {
          svg,
          name: name ?? 'html-design',
        });
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_update_selection',
    {
      description:
        '修改画布中选中的节点(可按 ids 指定,按 matchName 过滤,recursive 递归子节点)。props 支持 name/fill/x/y/w/h/cornerRadius/radiusTopLeft/radiusTopRight/radiusBottomLeft/radiusBottomRight/visible/rotation/opacity/characters/fontSize/fontWeight/fontFamily/textAlign/lineHeight/letterSpacing/stroke/strokeWeight/strokeAlign/shadow/layoutMode/itemSpacing/padding/pointCount',
      inputSchema: z.object({
        ids: z
          .array(z.string())
          .optional()
          .describe('指定节点 id,缺省用当前选中'),
        matchName: z
          .string()
          .optional()
          .describe('按节点 name 过滤,仅命中节点被修改'),
        recursive: z
          .boolean()
          .optional()
          .describe('是否递归应用到子节点,默认 false'),
        props: z
          .object({
            name: z.string().optional().describe('图层名称'),
            fill: z
              .string()
              .optional()
              .describe('十六进制颜色,如 #ff0000 或 #ff000080(带透明度)'),
            x: z.number().optional().describe('X 坐标(px)'),
            y: z.number().optional().describe('Y 坐标(px)'),
            w: z.number().optional().describe('宽度(px)'),
            h: z.number().optional().describe('高度(px)'),
            cornerRadius: z.number().optional().describe('四角统一圆角半径'),
            radiusTopLeft: z.number().optional().describe('左上角圆角'),
            radiusTopRight: z.number().optional().describe('右上角圆角'),
            radiusBottomLeft: z.number().optional().describe('左下角圆角'),
            radiusBottomRight: z.number().optional().describe('右下角圆角'),
            visible: z.boolean().optional().describe('是否可见'),
            rotation: z.number().optional().describe('旋转角度(度)'),
            opacity: z.number().optional().describe('不透明度 0~1'),
            characters: z.string().optional().describe('文本内容'),
            fontSize: z.number().optional().describe('字号(px)'),
            fontWeight: z.number().optional().describe('字重'),
            fontFamily: z.string().optional().describe('字体族'),
            textAlign: z
              .enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'])
              .optional()
              .describe('文本对齐方式'),
            lineHeight: z.number().optional().describe('行高'),
            letterSpacing: z.number().optional().describe('字距'),
            stroke: z.string().optional().describe('描边颜色,如 #ffffff'),
            strokeWeight: z.number().optional().describe('描边粗细'),
            strokeAlign: z
              .enum(['CENTER', 'INSIDE', 'OUTSIDE'])
              .optional()
              .describe('描边对齐'),
            shadow: z
              .object({
                color: z.string().optional().describe('阴影颜色'),
                x: z.number().optional().describe('阴影 X 偏移'),
                y: z.number().optional().describe('阴影 Y 偏移'),
                radius: z.number().optional().describe('阴影模糊半径'),
                spread: z.number().optional().describe('阴影扩展'),
              })
              .optional()
              .describe('原生阴影(下拉阴影)'),
            layoutMode: z
              .enum(['NONE', 'HORIZONTAL', 'VERTICAL'])
              .optional()
              .describe('自动布局方向'),
            itemSpacing: z.number().optional().describe('自动布局项间距'),
            padding: z.number().optional().describe('自动布局内边距'),
            pointCount: z.number().optional().describe('多边形/星形角点数'),
          })
          .describe('要修改的属性'),
      }),
      outputSchema: updatedResultSchema,
    },
    async ({ ids, matchName, recursive, props }) => {
      try {
        const data = await bridge.request('update_selection', {
          ids,
          matchName,
          recursive,
          props,
        });
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  const findSchema = z.object({
    name: z.string().optional().describe('按名称模糊匹配(包含)'),
    type: z
      .string()
      .optional()
      .describe(
        '节点类型,如 FRAME/RECTANGLE/TEXT/ELLIPSE/LINE/POLYGON/STAR/VECTOR',
      ),
    recursive: z.boolean().optional().describe('是否递归查找(默认 true)'),
  });

  server.registerTool(
    'jsd_find',
    {
      description:
        '在当前页面查找节点,可按名称/类型过滤,返回序列化节点列表(最多 100 条)',
      inputSchema: findSchema,
      outputSchema: findResultSchema,
    },
    async (params) => {
      try {
        const data = await bridge.request('find', params);
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_manage_nodes',
    {
      description:
        '对节点执行结构操作。按 op 分发:select 设置选中 / remove 删除 / clone 复制(右下偏移24px) / group 编组 / ungroup 取消编组 / flatten 合并为单个矢量 / outline_stroke 描边转矢量轮廓 / reparent 移动到目标父节点下',
      inputSchema: z.discriminatedUnion('op', [
        z.object({
          op: z.literal('select'),
          ids: z.array(z.string()).describe('要选中的节点 id 列表'),
        }),
        z.object({
          op: z.literal('remove'),
          ids: z
            .array(z.string())
            .optional()
            .describe('要删除的节点 id 列表,缺省用当前选中'),
          matchName: z.string().optional().describe('按名称精确匹配过滤'),
        }),
        z.object({
          op: z.literal('clone'),
          ids: z.array(z.string()).describe('要复制的节点 id 列表'),
        }),
        z.object({
          op: z.literal('group'),
          ids: z.array(z.string()).describe('要编组的节点 id 列表'),
          name: z.string().optional().describe('组名'),
        }),
        z.object({
          op: z.literal('ungroup'),
          ids: z.array(z.string()).describe('要取消编组的节点 id 列表'),
        }),
        z.object({
          op: z.literal('flatten'),
          ids: z
            .array(z.string())
            .describe('要合并为单个矢量的节点 id 列表(至少 2 个)'),
        }),
        z.object({
          op: z.literal('outline_stroke'),
          ids: z.array(z.string()).describe('要转描边的节点 id 列表'),
        }),
        z.object({
          op: z.literal('reparent'),
          ids: z.array(z.string()).describe('要移动的节点 id 列表'),
          parentId: z
            .string()
            .optional()
            .describe('目标父节点 id,缺省用当前选中第一个节点'),
          index: z.number().optional().describe('插入位置,缺省追加到末尾'),
        }),
      ]),
      outputSchema: manageNodesResultSchema,
    },
    async (params) => {
      try {
        const data = await bridge.request('node_op', params);
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_manage_components',
    {
      description:
        '组件/实例操作。按 op 分发:create_component 固化为组件 / create_instance 从组件生成实例 / detach_instance 解绑实例(转 Frame) / import_component 从团队库按 key 导入 / swap_component 交换实例组件 / set_instance_properties 设置变体属性 / combine_as_variants 合并为组件集',
      inputSchema: z.discriminatedUnion('op', [
        z.object({
          op: z.literal('create_component'),
          ids: z.array(z.string()).describe('要固化为组件的节点 id 列表'),
          name: z.string().optional().describe('组件名,默认 component'),
        }),
        z.object({
          op: z.literal('create_instance'),
          ids: z
            .array(z.string())
            .describe('组件(COMPONENT)节点 id 列表,每个生成一个实例'),
        }),
        z.object({
          op: z.literal('detach_instance'),
          ids: z.array(z.string()).describe('实例(INSTANCE)节点 id 列表'),
        }),
        z.object({
          op: z.literal('import_component'),
          key: z.string().describe('组件 Key'),
          name: z.string().optional().describe('导入后的组件名'),
        }),
        z.object({
          op: z.literal('swap_component'),
          ids: z.array(z.string()).describe('实例(INSTANCE)节点 id 列表'),
          componentId: z.string().describe('目标组件(COMPONENT)节点 id'),
        }),
        z.object({
          op: z.literal('set_instance_properties'),
          ids: z.array(z.string()).describe('实例(INSTANCE)节点 id 列表'),
          properties: z
            .record(z.string(), z.string())
            .describe('变体属性名→值,如 {"状态":"禁用"}'),
        }),
        z.object({
          op: z.literal('combine_as_variants'),
          ids: z
            .array(z.string())
            .describe('组件(COMPONENT)节点 id 列表(至少 2 个)'),
          name: z.string().optional().describe('组件集名'),
        }),
      ]),
      outputSchema: manageComponentsResultSchema,
    },
    async (params) => {
      try {
        const data = await bridge.request('component_op', params);
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_export',
    {
      description:
        '导出节点为图片/文件,返回二进制字节。可传 savePath 落盘本地文件(推荐,配合不支持图像的模型),或 includeDataUrl 生成 base64 dataURL(供支持图像的模型查看)',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要导出的节点 id 列表'),
        format: z
          .enum(['PNG', 'JPG', 'SVG', 'PDF'])
          .optional()
          .describe('导出格式,默认 PNG'),
        scale: z.number().optional().describe('缩放倍率(PNG/JPG),默认 1'),
        savePath: z
          .string()
          .optional()
          .describe('落盘文件绝对路径,如 /tmp/icon.png'),
        includeDataUrl: z
          .boolean()
          .optional()
          .describe('是否同时返回 base64 dataURL,默认 false'),
      }),
      outputSchema: exportResultSchema,
    },
    async ({ ids, format, scale, savePath, includeDataUrl }) => {
      try {
        const data = (await bridge.request('export', {
          ids,
          format,
          scale,
        })) as Record<string, unknown>;
        const exportsMap = (data.exports ?? {}) as Record<
          string,
          Record<string, unknown>
        >;
        const results: Record<string, unknown>[] = [];
        for (const [nid, item] of Object.entries(exportsMap)) {
          const bytes = item.bytes as Buffer;
          const mimeType = item.mimeType as string;
          const out: Record<string, unknown> = {
            id: nid,
            name: item.name,
            format: item.format,
            mimeType,
            size: bytes.byteLength,
          };
          if (savePath) {
            writeFileSync(savePath, bytes);
            out.path = savePath;
          }
          if (includeDataUrl) {
            out.dataUrl = `data:${mimeType};base64,${bytes.toString('base64')}`;
          }
          results.push(out);
        }
        return structured({ exports: results });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_fill_image',
    {
      description:
        '将本地图片文件字节填充到指定节点(IMAGE fill)。MCP server 读取本地文件,经二进制通道传给插件,插件调用 createImage 后填入节点',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要填充图片的节点 id 列表'),
        sourcePath: z
          .string()
          .describe('本地图片文件绝对路径,如 /tmp/poster.png'),
      }),
      outputSchema: updatedResultSchema,
    },
    async ({ ids, sourcePath }) => {
      try {
        let bytes: Buffer;
        try {
          bytes = readFileSync(sourcePath);
        } catch (e) {
          return err(
            new Error(
              `读取文件失败: ${e instanceof Error ? e.message : String(e)}`,
            ),
          );
        }
        const data = await bridge.request('fill_image', {
          ids,
          bytes: new Uint8Array(bytes),
        });
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'jsd_list_fonts',
    {
      description: '列出当前环境可用字体族',
      outputSchema: listFontsResultSchema,
    },
    async () => {
      try {
        const data = await bridge.request('list_fonts', {});
        return structured(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  return server;
}

/** 探测 47820:已有 text-to-design daemon → 返回代理客户端;外来 MCP 服务 → 'foreign';无 → 'none' */
async function probeUpstream(): Promise<
  { state: 'proxy'; client: Client } | { state: 'foreign' } | { state: 'none' }
> {
  const health = await fetchDaemonHealth();
  if (health && health.version !== SERVER_VERSION) {
    process.stderr.write(
      `[text-to-design-mcp] 检测到旧版 daemon (${health.version} → ${SERVER_VERSION}),正在替换...\n`,
    );
    await fetch(`http://127.0.0.1:${HTTP_PORT}/shutdown`, {
      method: 'POST',
    }).catch(() => {});
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      await delay(DAEMON_POLL_MS);
      if ((await fetchDaemonHealth()) === null) break;
    }
    return { state: 'none' };
  }
  const client = new Client(
    { name: 'text-to-design-proxy', version: SERVER_VERSION },
    { versionNegotiation: { mode: 'auto' } },
  );
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${HTTP_PORT}/mcp`),
      ),
    );
    const { tools } = await client.listTools();
    if (tools.length === 0 || !tools.every((t) => t.name.startsWith('jsd_'))) {
      await client.close();
      return { state: 'foreign' };
    }
    return { state: 'proxy', client };
  } catch {
    await client.close().catch(() => {});
    return { state: 'none' };
  }
}

/** GET daemon /health;无 /health 端点(旧版/外来服务/未启动)或失败 → null */
async function fetchDaemonHealth(): Promise<{
  name: string;
  version: string;
} | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${HTTP_PORT}/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: string; version?: string };
    return body.name && body.version
      ? { name: body.name, version: body.version }
      : null;
  } catch {
    return null;
  }
}

/** shim 模式:本进程 stdio 透传到 daemon 的 HTTP 端点,不启 WS */
async function serveProxy(client: Client): Promise<void> {
  const { tools } = await client.listTools();
  const stdioHandle = serveStdio(() => {
    const server = new McpServer(
      { name: SERVER_NAME, version: SERVER_VERSION },
      {
        supportedProtocolVersions: [
          '2026-07-28',
          ...SUPPORTED_PROTOCOL_VERSIONS,
        ],
      },
    );
    const register = server.registerTool.bind(server) as unknown as (
      name: string,
      config: {
        description?: string;
        inputSchema?: unknown;
        outputSchema?: unknown;
      },
      cb: (args: Record<string, unknown>) => Promise<unknown>,
    ) => unknown;
    for (const t of tools) {
      register(
        t.name,
        {
          description: t.description,
          inputSchema: fromJsonSchema(t.inputSchema as never),
          ...(t.outputSchema
            ? { outputSchema: fromJsonSchema(t.outputSchema as never) }
            : {}),
        },
        async (args) => {
          const res = (await client.callTool({
            name: t.name,
            arguments: args,
          })) as {
            content: unknown;
            structuredContent?: unknown;
            isError?: boolean;
          };
          return {
            content: res.content,
            ...(res.structuredContent !== undefined
              ? { structuredContent: res.structuredContent }
              : {}),
            ...(res.isError ? { isError: true } : {}),
          };
        },
      );
    }
    return server;
  });
  process.stderr.write(
    `[text-to-design-mcp] shim 模式: stdio → http://127.0.0.1:${HTTP_PORT}/mcp (共享 daemon)\n`,
  );
  process.on('SIGINT', async () => {
    await stdioHandle.close();
    await client.close();
    process.exit(0);
  });
}

/** detached 拉起 daemon(独立常驻,不受本会话生命周期影响) */
function spawnDaemon(): void {
  const child = spawn(
    process.execPath,
    [...process.execArgv, ...process.argv.slice(1)],
    {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, TEXT_TO_DESIGN_MCP_ROLE: 'daemon' },
    },
  );
  child.unref();
  child.on('error', (e) => {
    process.stderr.write(
      `[text-to-design-mcp] 拉起 daemon 失败: ${e.message}\n`,
    );
  });
}

/** daemon 模式:WS 桥(插件) + HTTP MCP(各会话 shim 连接),无 stdio,常驻 */
async function runDaemon(): Promise<void> {
  await bridge.start(PORT);
  process.stderr.write(
    `[text-to-design-mcp] daemon: 插件 WS ws://localhost:${bridge.port}\n`,
  );

  const handler = createMcpHandler(buildServer);
  const nodeHandler = toNodeHandler(handler);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  let httpServer: ReturnType<typeof createServer> | null = null;

  const shutdown = (reason: string): void => {
    process.stderr.write(`[text-to-design-mcp] daemon 退出: ${reason}\n`);
    void handler.close();
    bridge.stop();
    httpServer?.close();
    process.exit(0);
  };

  await new Promise<void>((resolve, reject) => {
    httpServer = createServer((req, res) => {
      if (!validateHost(req, res) || !validateOrigin(req, res)) return;
      const start = Date.now();
      const url = req.url ?? '';
      res.on('finish', () => {
        log(
          `HTTP ${req.method} ${url} → ${res.statusCode} (${Date.now() - start}ms)`,
        );
      });
      if (req.method === 'GET' && url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            name: SERVER_NAME,
            version: SERVER_VERSION,
            pid: process.pid,
          }),
        );
        return;
      }
      if (req.method === 'POST' && url === '/shutdown') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        setTimeout(() => shutdown('收到 /shutdown 请求'), 100);
        return;
      }
      void nodeHandler(req, res);
    });
    httpServer.once('error', reject);
    httpServer.listen(HTTP_PORT, '127.0.0.1', () => resolve());
  });

  process.stderr.write(
    `[text-to-design-mcp] daemon: MCP HTTP http://127.0.0.1:${HTTP_PORT}/mcp (opencode 会话经 shim 连接)\n`,
  );
  process.stderr.write(
    `[text-to-design-mcp] daemon 就绪,常驻运行(更新时由版本自检自动替换)\n`,
  );

  process.on('SIGINT', () => shutdown('SIGINT'));
}

/** shim 模式:探测 daemon;无则拉起并等待就绪 */
async function runShim(): Promise<void> {
  const probe = await probeUpstream();
  if (probe.state === 'foreign') {
    process.stderr.write(
      `[text-to-design-mcp] 错误: 端口 ${HTTP_PORT} 被非 text-to-design MCP 服务占用,请先释放。\n`,
    );
    process.exit(1);
  } else if (probe.state === 'proxy') {
    await serveProxy(probe.client);
    return;
  }

  process.stderr.write('[text-to-design-mcp] 未发现 daemon,自动拉起...\n');
  spawnDaemon();
  const deadline = Date.now() + DAEMON_WAIT_MS;
  while (Date.now() < deadline) {
    await delay(DAEMON_POLL_MS);
    const retry = await probeUpstream();
    if (retry.state === 'proxy') {
      await serveProxy(retry.client);
      return;
    }
    if (retry.state === 'foreign') {
      process.stderr.write(
        `[text-to-design-mcp] 错误: 端口 ${HTTP_PORT} 被非 text-to-design MCP 服务占用,请先释放。\n`,
      );
      process.exit(1);
    }
  }
  process.stderr.write(
    `[text-to-design-mcp] 错误: daemon 启动超时(${DAEMON_WAIT_MS / 1000}s),请检查残留进程后重试。\n`,
  );
  process.exit(1);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const IS_DAEMON =
  process.env.TEXT_TO_DESIGN_MCP_ROLE === 'daemon' ||
  process.argv.includes('daemon');

if (IS_DAEMON) {
  runDaemon().catch((e) => {
    bridge.stop();
    process.stderr.write(
      `[text-to-design-mcp] daemon 启动失败: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    process.exit(1);
  });
} else {
  runShim().catch((e) => {
    process.stderr.write(
      `[text-to-design-mcp] shim 启动失败: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    process.exit(1);
  });
}
