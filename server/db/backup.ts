/**
 * Consistent SQLite backup using VACUUM INTO, followed by an integrity check.
 *
 * Run before any schema change and before copying a database between hosts:
 *   npm run db:backup
 *   VERITAS_BACKUP_PATH=/durable/backups/school.db npm run db:backup
 */
import fs from 'node:fs';
import path from 'node:path';
import { dbFilePath, sqlite } from './index.js';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = process.env.VERITAS_BACKUP_PATH?.trim()
  ? path.resolve(process.env.VERITAS_BACKUP_PATH)
  : path.join(process.cwd(), 'backups', `veritas_school-${stamp}.db`);

fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  console.error(`Refusing to overwrite existing backup: ${target}`);
  process.exit(1);
}

// VACUUM INTO writes a transactionally consistent copy even while WAL is active.
sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

const integrity = sqlite.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined;
const result = String(integrity?.integrity_check ?? 'unknown');
const bytes = fs.statSync(target).size;

console.log(`source:          ${dbFilePath}`);
console.log(`backup:          ${target}`);
console.log(`size:            ${bytes} bytes`);
console.log(`integrity_check: ${result}`);

if (result !== 'ok' || bytes === 0) {
  console.error('Backup verification failed. Do not migrate or delete the source database.');
  process.exitCode = 1;
}
