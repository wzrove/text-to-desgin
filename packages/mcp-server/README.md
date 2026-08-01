# text-to-design-mcp

让 AI 助手直接帮你操作即时设计(jsDesign)画布:读取选中内容、按描述画图、改样式、导出图片。装好后不用手动启动任何服务,打开 AI 工具就能用。

## 安装(三步)

**第一步:安装 MCP server**(任选一种包管理器)

| 管理器 | 命令 |
| --- | --- |
| npm | `npm i -g text-to-design-mcp` |
| pnpm | `pnpm add -g text-to-design-mcp` |
| yarn | `yarn global add text-to-design-mcp` |

**第二步:安装 jsDesign 插件**

下载插件包(任选):

| 管理器 | 命令 |
| --- | --- |
| npm | `npm pack text-to-design-ui` |
| pnpm | `pnpm pack text-to-design-ui` |
| yarn | `yarn dlx npm pack text-to-design-ui` |

解压得到的 tgz 里有个 `dist/manifest.json`,在 jsDesign 里「插件 → 导入」选择它,然后在画布运行插件,面板显示「已连接」就绪了。

**第三步:告诉 AI 工具**

在项目根目录的 `opencode.json`(没有就新建)里加:

```json
{
  "mcp": {
    "text-to-design": {
      "type": "local",
      "command": ["text-to-design-mcp"],
      "enabled": true
    }
  }
}
```

(没做全局安装的话,把 command 换成 `["npx", "text-to-design-mcp"]` 也可以)

改完重启 opencode 会话。

## 怎么用

打开会话后直接说人话,比如:

- 「读取当前画布选中的内容」
- 「在画布中心画一个 300x200 的卡片,标题叫发布页,背景浅灰」
- 「把选中的按钮导出成 PNG 存到 /tmp/btn.png」

想确认插件通不通,先让它调 `text_to_design_ping`。

## 它能做什么(工具一览)

| 工具 | 用途 |
| --- | --- |
| `text_to_design_ping` | 检查插件是否在线 |
| `text_to_design_get_selection` | 读取画布当前选中的节点 |
| `text_to_design_execute` | 按描述创建节点(frame/rect/text 等,支持阴影/描边/渐变/文本样式) |
| `text_to_design_html_to_design` | 把 HTML 转成设计节点 |
| `text_to_design_update_selection` | 修改选中节点的属性(位置/颜色/文字/圆角等) |
| `text_to_design_find` | 按名称/类型查找节点 |
| `text_to_design_set_selection` | 设置画布选中节点 |
| `text_to_design_remove` | 删除节点 |
| `text_to_design_clone` | 复制节点 |
| `text_to_design_group` | 编组 / 取消编组 |
| `text_to_design_export` | 导出节点为 PNG/JPG/SVG/PDF |
| `text_to_design_list_fonts` | 列出可用字体 |
| `text_to_design_fill_image` | 用本地图片填充节点 |

## 工作原理(简单版)

- 一个常驻的轻量服务负责和插件通信,连接 jsDesign 里的插件
- 每个 AI 会话会自动连上这个服务;会话关掉不影响插件
- 一段时间没人用,服务自动退出;下次会话会自动把它再拉起来
- 多个会话可以同时用,共享同一个插件连接

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `TEXT_TO_DESIGN_MCP_PORT` | `47812` | 与插件通信的端口(被占用会启动失败) |
| `TEXT_TO_DESIGN_MCP_HTTP_PORT` | `47820` | 内部服务端口(一般不用动) |
| `TEXT_TO_DESIGN_MCP_LOG` | `/tmp/text-to-design-mcp.log` | 日志文件路径 |

## 出问题了

- 看日志:`tail -f /tmp/text-to-design-mcp.log`(请求发出、收到回复、超时都会记)
- 插件面板自带连接状态和日志,也能帮定位

## 开发者(仓库内)

```bash
pnpm install
pnpm dev        # watch 构建 ui/code
pnpm mcp        # 开发态启动 MCP server(tsx 直跑)
```
