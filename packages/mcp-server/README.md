# jsdesign-mcp-bridge

MCP(MCP Model Context Protocol)server:把 AI 客户端桥接到 jsDesign(即时设计)桌面插件。

采用生态主流形态:**共享 daemon + 每会话薄 shim**(同 chrome-devtools-mcp 模型)。

```
jsDesign 插件 ──WS 47812──▶ daemon(独立常驻:WS server + MCP HTTP 47820)
                                  ▲               ▲
opencode 会话A ──stdio──▶ shim A ──┘ HTTP ───────┤
opencode 会话B ──stdio──▶ shim B ──┘ HTTP ───────┘
```

- **daemon**:插件 WS(47812)+ MCP streamable HTTP(47820),无 stdio。独立于任何会话进程,**会话关闭不影响插件连接**;空闲 5 分钟无请求自动退出
- **shim**:每个 opencode 会话由 `type: local` spawn 一个,探测 47820:
  - 已有 daemon → 直接代理(自家 stdio 透传到 daemon HTTP 端点,不启 WS)
  - 无 daemon → detached 自动拉起 daemon,等待就绪后代理
  - 端口被外来服务占用 → fail-fast 明确报错
- 多个 opencode 会话**同时可用**,全部经各自 shim 共享同一 daemon、同一插件连接

自愈闭环:daemon 空闲退出 → 插件 1s 轮询重连 → 新会话自动拉起新 daemon。

## 快速开始

**前提**:先安装并运行 jsDesign 插件侧(插件代码在仓库内):

1. `pnpm install && pnpm build`(构建插件包 `packages/ui/dist/`,含 `ui.html` + `code.js` + `manifest.json`)
2. jsDesign 客户端 →「插件」→「创建/添加插件」→ 选择仓库根目录的 `manifest.json`
3. 画布内「运行插件」,UI 面板出现且显示「已连接」即就绪

**无需手动启动 server**:opencode 打开会话时自动 spawn shim,shim 自动拉起 daemon。插件先运行、会话后开顺序更佳(插件 1s 轮询会自动连上)。

## 客户端配置

以 opencode 为例(`opencode.json`),用 `type: local` 由 opencode 自动拉起:

```json
{
  "mcp": {
    "jsdesign": {
      "type": "local",
      "command": ["pnpm", "run", "mcp"],
      "enabled": true
    }
  }
}
```

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `JSDESIGN_MCP_PORT` | `47812` | 插件桥接 WebSocket 端口(固定,被占即启动失败) |
| `JSDESIGN_MCP_HTTP_PORT` | `47820` | MCP streamable HTTP 端点端口(shim 连接 daemon 用) |
| `JSDESIGN_MCP_LOG` | `/tmp/jsdesign-mcp.log` | daemon 日志文件路径(detached 启动 stderr 不可见,消息收发/超时/未匹配全部落盘;`tail -f` 观察) |

## daemon 生命周期

- 由第一个 shim 自动拉起(detached,不随会话退出)
- 空闲 5 分钟无 HTTP 请求自动退出;插件连接不影响该计时(插件会自动重连)
- 手动清理:`pkill -f "index.ts daemon"`

## 工具

| 工具 | 说明 |
| --- | --- |
| `jsdesign_ping` | 检查 jsDesign 插件是否在线 |
| `jsdesign_get_selection` | 获取画布当前选中节点信息 |
| `jsdesign_execute` | 在画布执行声明式设计指令(op 节点树,支持 frame/rect/ellipse/line/polygon/star/vector/text,阴影/描边/渐变/文本样式) |
| `jsdesign_html_to_design` | 将 HTML 转换为设计节点(SVG 保真路线) |
| `jsdesign_update_selection` | 修改选中节点属性(含原生阴影/描边/文本样式/细分圆角) |
| `jsdesign_find` | 按名称/类型查找节点 |
| `jsdesign_set_selection` | 设置画布选中节点 |
| `jsdesign_remove` | 删除节点(按 ids/名称/选中) |
| `jsdesign_clone` | 复制节点 |
| `jsdesign_group` | 编组/取消编组 |
| `jsdesign_export` | 导出节点为 PNG/JPG/SVG/PDF(二进制通道;可 savePath 落盘或 includeDataUrl 生成 base64) |
| `jsdesign_list_fonts` | 列出可用字体族 |
| `jsdesign_fill_image` | 将本地图片文件字节填充到节点(IMAGE fill) |

## 开发

```bash
pnpm install
pnpm dev      # watch 构建 ui/code(ui 包内并行)
pnpm mcp      # 直接启动 mcp-server(shim 角色;加 daemon 参数则以 daemon 角色运行)
pnpm --filter jsdesign-mcp-bridge start   # 或直接进 packages/mcp-server 跑 start
```
