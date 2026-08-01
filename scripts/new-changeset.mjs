import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CHANGESET_DIR = resolve(ROOT, '.changeset');
const PUBLISHABLE = [
  { dir: 'packages/mcp-server', name: 'text-to-design-mcp' },
  { dir: 'packages/ui', name: 'text-to-design-ui' },
];
const BUMPS = new Set(['patch', 'minor', 'major']);

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const staged = run('git', ['diff', '--cached', '--name-only'])
  .split('\n')
  .filter(Boolean);
const files = staged.length
  ? staged
  : run('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'])
      .split('\n')
      .filter(Boolean);

const touched = PUBLISHABLE.filter(({ dir }) =>
  files.some((f) => f.startsWith(`${dir}/`)),
);

if (touched.length === 0) {
  console.error(
    '未检测到可发布包(packages/mcp-server、packages/ui)的改动,不生成 changeset',
  );
  process.exit(1);
}

const [description = '', explicitBump = ''] = process.argv.slice(2);
const bump = BUMPS.has(explicitBump)
  ? explicitBump
  : /(^|\s)(feat|feature)/i.test(description)
    ? 'minor'
    : 'patch';

const message =
  description || run('git', ['log', '-1', '--format=%s']) || 'changeset';
const file = resolve(CHANGESET_DIR, `auto-${Date.now().toString(36)}.md`);

mkdirSync(CHANGESET_DIR, { recursive: true });
writeFileSync(
  file,
  `---\n${touched.map(({ name }) => `"${name}": ${bump}`).join('\n')}\n---\n\n${message}\n`,
  'utf8',
);

console.log(`已生成 ${file}`);
console.log(
  `  包: ${touched.map(({ name }) => name).join(', ')} | 版本: ${bump}`,
);
console.log('  提交时一起 git add 即可');
