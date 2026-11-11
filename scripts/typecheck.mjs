/**
 * TypeScript check with an explicit heap.
 *
 * The check failed with `JavaScript heap out of memory` once the redesigned pages
 * added ~1,600 lines: the inherited NODE_OPTIONS cap is below what tsc needs. This
 * wrapper raises the limit for the compiler process only, so tests and the server
 * keep their own settings.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const tsc = path.join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
if (!existsSync(tsc)) {
  console.error('TypeScript is not installed. Run npm install first.');
  process.exit(1);
}

const heapMb = Number(process.env.VERITAS_TSC_HEAP_MB) || 4096;
const semiSpaceMb = Number(process.env.VERITAS_TSC_SEMI_SPACE_MB) || 32;
const result = spawnSync(process.execPath, [tsc, '--noEmit'], {
  stdio: 'inherit',
  // The observed failure was a NewSpace allocation abort, so raise both generations.
  env: {
    ...process.env,
    NODE_OPTIONS: `--max-old-space-size=${heapMb} --max-semi-space-size=${semiSpaceMb}`,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
