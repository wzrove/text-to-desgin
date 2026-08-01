import { appendFileSync } from 'node:fs';

const FILE =
  process.env.TEXT_TO_DESIGN_MCP_LOG ?? '/tmp/text-to-design-mcp.log';

/** 追加一行日志到文件(daemon detached + stdio ignored,stderr 不可见,必须落盘) */
export function log(line: string): void {
  try {
    appendFileSync(
      FILE,
      `${new Date().toISOString()} [text-to-design-mcp] ${line}\n`,
    );
  } catch {
    // 日志失败不影响主流程
  }
}
