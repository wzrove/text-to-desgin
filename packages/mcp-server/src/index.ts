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

function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      supportedProtocolVersions: ['2026-07-28', ...SUPPORTED_PROTOCOL_VERSIONS],
    },
  );

  server.registerTool(
    'text_to_design_ping',
    { description: '检查 jsDesign 插件是否在线(需先启动插件并保持运行)' },
    async () => {
      try {
        await bridge.request('ping', {});
        return text({ connected: true });
      } catch (e) {
        return text({
          connected: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
  );

  server.registerTool(
    'text_to_design_get_selection',
    {
      description:
        '获取即时设计画布当前选中的节点信息(名称/类型/尺寸/位置/填充/文本/子树结构)',
    },
    async () => {
      try {
        const data = await bridge.request('get_selection', {});
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_execute',
    {
      description:
        '在画布执行声明式设计指令。ops 为节点数组,每项: {op:"frame"|"rect"|"ellipse"|"line"|"polygon"|"star"|"vector"|"boolean"|"text", name?, x?, y?, w?, h?, fill?, radius?, rotation?, opacity?, stroke?, strokeWeight?, shadow?:{color,x,y,radius,spread}, gradient?:{stops:[{color,position}],angle}, pointCount?, fontSize?, fontWeight?, fontFamily?, characters?, textAlign?, lineHeight?, letterSpacing?, layout?:{mode,itemSpacing,padding}, radiusTopLeft?..., children?:[...] }。op 为 vector 时可用 paths 传 SVG path data(单个或数组,如 "M0 0 L100 0 L100 100 Z",可含 windingRule);op 为 boolean 时 children 至少 2 个,booleanType 取 UNION|SUBTRACT|INTERSECT|EXCLUDE(默认 UNION)。自动插入到画布中心',
      inputSchema: z.object({
        ops: z.array(z.any()).describe('设计指令节点树'),
      }),
    },
    async ({ ops }) => {
      try {
        const data = await bridge.request('execute', { ops });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_create_svg',
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
    },
    async ({ svg, name }) => {
      try {
        const data = await bridge.request('create_svg', {
          svg,
          name: name ?? 'svg-design',
        });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_html_to_design',
    {
      description:
        '将 HTML 字符串转换为 jsDesign 设计节点(SVG 保真路线,忽略复杂样式),插入画布中心',
      inputSchema: z.object({
        html: z.string().describe('HTML 片段,支持内联 style'),
        name: z.string().optional().describe('生成的图层名,默认 html-design'),
      }),
    },
    async ({ html, name }) => {
      try {
        const svg = htmlToSvg(html);
        const data = await bridge.request('create_svg', {
          svg,
          name: name ?? 'html-design',
        });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_update_selection',
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
            name: z.string().optional(),
            fill: z
              .string()
              .optional()
              .describe('十六进制颜色,如 #ff0000 或 #ff000080(带透明度)'),
            x: z.number().optional(),
            y: z.number().optional(),
            w: z.number().optional(),
            h: z.number().optional(),
            cornerRadius: z.number().optional(),
            radiusTopLeft: z.number().optional(),
            radiusTopRight: z.number().optional(),
            radiusBottomLeft: z.number().optional(),
            radiusBottomRight: z.number().optional(),
            visible: z.boolean().optional(),
            rotation: z.number().optional(),
            opacity: z.number().optional(),
            characters: z.string().optional(),
            fontSize: z.number().optional(),
            fontWeight: z.number().optional(),
            fontFamily: z.string().optional(),
            textAlign: z
              .enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'])
              .optional(),
            lineHeight: z.number().optional(),
            letterSpacing: z.number().optional(),
            stroke: z.string().optional().describe('描边颜色,如 #ffffff'),
            strokeWeight: z.number().optional(),
            strokeAlign: z.enum(['CENTER', 'INSIDE', 'OUTSIDE']).optional(),
            shadow: z
              .object({
                color: z.string().optional(),
                x: z.number().optional(),
                y: z.number().optional(),
                radius: z.number().optional(),
                spread: z.number().optional(),
              })
              .optional()
              .describe('原生阴影(下拉阴影)'),
            layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).optional(),
            itemSpacing: z.number().optional(),
            padding: z.number().optional(),
            pointCount: z.number().optional(),
          })
          .describe('要修改的属性'),
      }),
    },
    async ({ ids, matchName, recursive, props }) => {
      try {
        const data = await bridge.request('update_selection', {
          ids,
          matchName,
          recursive,
          props,
        });
        return text(data);
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
    'text_to_design_find',
    {
      description:
        '在当前页面查找节点,可按名称/类型过滤,返回序列化节点列表(最多 100 条)',
      inputSchema: findSchema,
    },
    async (params) => {
      try {
        const data = await bridge.request('find', params);
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_set_selection',
    {
      description: '设置画布当前选中节点(传入节点 ids)',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要选中的节点 id 列表'),
      }),
    },
    async ({ ids }) => {
      try {
        const data = await bridge.request('set_selection', { ids });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_remove',
    {
      description: '删除节点(按 ids 或 matchName,缺省删除当前选中)',
      inputSchema: z.object({
        ids: z
          .array(z.string())
          .optional()
          .describe('要删除的节点 id 列表,缺省用当前选中'),
        matchName: z.string().optional().describe('按名称精确匹配过滤'),
      }),
    },
    async ({ ids, matchName }) => {
      try {
        const data = await bridge.request('remove', { ids, matchName });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_clone',
    {
      description: '复制节点到当前页面(原节点右下偏移 24px)',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要复制的节点 id 列表'),
      }),
    },
    async ({ ids }) => {
      try {
        const data = await bridge.request('clone', { ids });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_group',
    {
      description: '将多个节点编组(或 ungroup 取消编组)',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要编组的节点 id 列表'),
        name: z.string().optional().describe('组名'),
        ungroup: z.boolean().optional().describe('true 时取消编组'),
      }),
    },
    async ({ ids, name, ungroup }) => {
      try {
        const data = await bridge.request('group', { ids, name, ungroup });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_flatten',
    {
      description: '将多个节点合并为单个矢量(VectorNode),原节点被吸收',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要合并的节点 id 列表(至少 2 个)'),
      }),
    },
    async ({ ids }) => {
      try {
        const data = await bridge.request('flatten', { ids });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_outline_stroke',
    {
      description: '将节点描边转为矢量轮廓(outlineStroke),返回新矢量节点',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要转描边的节点 id 列表'),
      }),
    },
    async ({ ids }) => {
      try {
        const data = await bridge.request('outline_stroke', { ids });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_reparent',
    {
      description:
        '移动节点到目标父节点下(原生移动,自动脱离原父)。parentId 缺省时用当前选中第一个节点作父;index 可指定插入顺序',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要移动的节点 id 列表'),
        parentId: z
          .string()
          .optional()
          .describe('目标父节点 id,缺省用当前选中第一个节点'),
        index: z.number().optional().describe('插入位置,缺省追加到末尾'),
      }),
    },
    async ({ ids, parentId, index }) => {
      try {
        const data = await bridge.request('reparent', { ids, parentId, index });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_create_component',
    {
      description: '将指定节点固化为组件(ComponentNode),原节点移入组件内',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要固化为组件的节点 id 列表'),
        name: z.string().optional().describe('组件名,默认 component'),
      }),
    },
    async ({ ids, name }) => {
      try {
        const data = await bridge.request('create_component', { ids, name });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_create_instance',
    {
      description: '从组件节点创建实例(InstanceNode),放到画布中心',
      inputSchema: z.object({
        ids: z
          .array(z.string())
          .describe('组件(COMPONENT)节点 id 列表,每个生成一个实例'),
      }),
    },
    async ({ ids }) => {
      try {
        const data = await bridge.request('create_instance', { ids });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_swap_component',
    {
      description: '交换实例的组件(实例样式整体换成另一个组件)',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('实例(INSTANCE)节点 id 列表'),
        componentId: z.string().describe('目标组件(COMPONENT)节点 id'),
      }),
    },
    async ({ ids, componentId }) => {
      try {
        const data = await bridge.request('swap_component', {
          ids,
          componentId,
        });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_set_instance_properties',
    {
      description:
        '设置实例的变体属性(如 {"状态":"禁用","尺寸":"大"}),可选值见 find/get_selection 返回的 variantGroupProperties',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('实例(INSTANCE)节点 id 列表'),
        properties: z
          .record(z.string(), z.string())
          .describe('变体属性名→值,如 {"状态":"禁用"}'),
      }),
    },
    async ({ ids, properties }) => {
      try {
        const data = await bridge.request('set_instance_properties', {
          ids,
          properties,
        });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_import_component',
    {
      description:
        '从团队库按 key 导入组件到当前页面。key 获取方式:jsDesign 编辑器中右键组件 → 复制链接/组件 Key(如 URL 里 componentKey= 或分享链接中的 key 参数)',
      inputSchema: z.object({
        key: z.string().describe('组件 Key'),
        name: z.string().optional().describe('导入后的组件名'),
      }),
    },
    async ({ key, name }) => {
      try {
        const data = await bridge.request('import_component', { key, name });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_combine_as_variants',
    {
      description:
        '将多个组件合并为组件集(ComponentSetNode),生成变体后可配合 set_instance_properties 切换',
      inputSchema: z.object({
        ids: z
          .array(z.string())
          .describe('组件(COMPONENT)节点 id 列表(至少 2 个)'),
        name: z.string().optional().describe('组件集名'),
      }),
    },
    async ({ ids, name }) => {
      try {
        const data = await bridge.request('combine_as_variants', { ids, name });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_detach_instance',
    {
      description: '解绑实例(INSTANCE → FrameNode),解绑后可自由编辑内容',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('实例(INSTANCE)节点 id 列表'),
      }),
    },
    async ({ ids }) => {
      try {
        const data = await bridge.request('detach_instance', { ids });
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_export',
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
        return text({ exports: results });
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_fill_image',
    {
      description:
        '将本地图片文件字节填充到指定节点(IMAGE fill)。MCP server 读取本地文件,经二进制通道传给插件,插件调用 createImage 后填入节点',
      inputSchema: z.object({
        ids: z.array(z.string()).describe('要填充图片的节点 id 列表'),
        sourcePath: z
          .string()
          .describe('本地图片文件绝对路径,如 /tmp/poster.png'),
      }),
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
        return text(data);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'text_to_design_list_fonts',
    { description: '列出当前环境可用字体族' },
    async () => {
      try {
        const data = await bridge.request('list_fonts', {});
        return text(data);
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
    if (
      tools.length === 0 ||
      !tools.every((t) => t.name.startsWith('text_to_design_'))
    ) {
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
      config: { description?: string; inputSchema?: unknown },
      cb: (args: Record<string, unknown>) => Promise<unknown>,
    ) => unknown;
    for (const t of tools) {
      register(
        t.name,
        {
          description: t.description,
          inputSchema: fromJsonSchema(t.inputSchema as never),
        },
        async (args) => {
          const res = await client.callTool({ name: t.name, arguments: args });
          return {
            content: res.content,
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
