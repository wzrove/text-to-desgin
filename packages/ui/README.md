# text-to-design-ui

text-to-design 的 jsDesign(即时设计)插件包。构建产物含 `ui.html` + `code.js` + `manifest.json`,自包含、无需构建。

## 安装插件

```bash
npm pack text-to-design-ui
tar -xzf text-to-design-ui-*.tgz
```

然后在 jsDesign 客户端:「插件」→「导入」→ 选择解压目录里的 `dist/manifest.json`,画布运行插件,面板显示「已连接」即就绪。

## 配合 MCP server

MCP server 见 [`text-to-design-mcp`](https://www.npmjs.com/package/text-to-design-mcp),插件保持运行,AI 客户端即可通过 MCP 操作画布。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `TEXT_TO_DESIGN_MCP_PORT` | `47812` | 插件桥接 WebSocket 端口(与 MCP server 一致) |
