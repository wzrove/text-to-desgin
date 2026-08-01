# text-to-design — jsDesign MCP Bridge

让 AI 助手(opencode、Claude 等)通过 MCP 直接操作即时设计(jsDesign)画布:选中 / 创建 / 编辑 / 导出 / 填充图片。

## 快速安装

复制下面整段,丢给任意 AI 助手执行(它做完后,只剩「导入插件」一步需要你手动操作):

```
目标:为用户安装 text-to-design 的 jsDesign MCP 插件。请依次执行:

1. 安装 MCP server:
   npm i -g text-to-design-mcp

2. 下载并解压插件包到用户目录:
   cd ~ && npm pack text-to-design-ui
   mkdir -p text-to-design-plugin
   tar -xzf text-to-design-ui-*.tgz -C text-to-design-plugin --strip-components=1

   (若 npm 包尚未发布,改用仓库内产物:把仓库 packages/ui/dist/ 整个目录拷到
    ~/text-to-design-plugin,后续路径同样指向其 manifest.json)

3. 配置 opencode(项目根 opencode.json,不存在则创建;若项目里找不到,写
   ~/.config/opencode/opencode.json):
   {
     "mcp": {
       "text-to-design": {
         "type": "local",
         "command": ["text-to-design-mcp"],
         "enabled": true
       }
     }
   }

4. 验证 server 能起:
   timeout 5 text-to-design-mcp
   预期输出含 "[text-to-design-mcp] shim 模式" 或 "daemon 就绪"(首次会自动拉起 daemon)

5. 告诉用户完成情况,并提醒:
   - 在 jsDesign 中「插件 → 导入」~/text-to-design-plugin/dist/manifest.json,然后运行插件,
     面板显示「已连接」即就绪
   - 重启 opencode 会话,用 text_to_design_ping 验证
```

## 手动一步(LLM 做不了)

jsDesign 客户端 →「插件」→ 导入 `~/text-to-design-plugin/dist/manifest.json` → 画布运行插件,面板显示「已连接」。

## 工具

| 工具 | 说明 |
| --- | --- |
| `text_to_design_ping` | 检查插件是否在线 |
| `text_to_design_get_selection` | 获取画布当前选中节点 |
| `text_to_design_execute` | 执行声明式设计指令(frame/rect/text/... 节点树) |
| `text_to_design_html_to_design` | HTML 转设计节点 |
| `text_to_design_export` | 导出节点为 PNG/JPG/SVG/PDF |

完整 13 个工具见 [`packages/mcp-server/README.md`](packages/mcp-server/README.md)。

## 调试

```bash
tail -f /tmp/text-to-design-mcp.log   # daemon 日志:请求发出/收到/匹配/超时
```

插件面板自带状态与日志(收到服务器请求 / 转发失败 / 未匹配响应)。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `TEXT_TO_DESIGN_MCP_PORT` | `47812` | 插件桥接 WebSocket 端口(固定,被占即启动失败) |
| `TEXT_TO_DESIGN_MCP_HTTP_PORT` | `47820` | MCP HTTP 端点(shim 连 daemon 用) |
| `TEXT_TO_DESIGN_MCP_LOG` | `/tmp/text-to-design-mcp.log` | daemon 日志文件路径 |

## 开发者

```bash
pnpm install
pnpm dev        # watch 构建 ui/code
pnpm build      # 构建插件包(packages/ui/dist/)
pnpm typecheck  # 全量类型检查
pnpm mcp        # 开发期启动 MCP server(tsx)
```
