import { appendFileSync } from 'node:fs'

const FILE = process.env.JSDESIGN_MCP_LOG ?? '/tmp/jsdesign-mcp.log'

/** 追加一行日志到文件(daemon detached + stdio ignored,stderr 不可见,必须落盘) */
export function log(line: string): void {
  try {
    appendFileSync(FILE, `${new Date().toISOString()} [jsdesign-mcp] ${line}\n`)
  } catch {
    // 日志失败不影响主流程
  }
}
