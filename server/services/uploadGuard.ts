/**
 * Private upload serving: replaces the old public `express.static('/uploads')` mount.
 *
 * Every file lives under VERITAS_UPLOAD_DIR (or ./uploads locally, /tmp on serverless) and is
 * reachable only through a signed-in request that passes `canReadUpload`. The registry row records
 * the uploader so ownership survives restarts; legacy files without a row are readable only when
 * the portal already references them, or by staff.
 */
import path from 'node:path';
import fs from 'node:fs';
import type { Express, NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '../db/index.js';
import * as schema from '../db/schema.js';
import { fileStorage } from './fileStorage.js';
import { canReadUpload, type UploadRecord } from './uploadAccess.js';

const FOLDER_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,160}$/;

function ensureUploadTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      url TEXT PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS uploads_owner ON uploads (owner_id);
  `);
}

export function recordUploadedFile(input: {
  url: string;
  ownerId: number;
  originalName: string;
  mimeType: string;
  size: number;
}) {
  ensureUploadTable();
  sqlite.prepare(`INSERT INTO uploads (url, owner_id, original_name, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET owner_id = excluded.owner_id`)
    .run(input.url, input.ownerId, input.originalName, input.mimeType, input.size, new Date().toISOString());
}

function findUpload(url: string): UploadRecord | null {
  const row = sqlite
    .prepare('SELECT url, owner_id, original_name, mime_type, size, created_at FROM uploads WHERE url = ?')
    .get(url) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    url: String(row.url),
    ownerId: Number(row.owner_id),
    originalName: String(row.original_name),
    mimeType: String(row.mime_type),
    size: Number(row.size),
    createdAt: String(row.created_at),
  };
}

/** A file that the portal already exposes through an announcement, assignment or submission. */
function isReferenced(url: string): boolean {
  const announcement = db.select({ id: schema.announcements.id }).from(schema.announcements)
    .where(eq(schema.announcements.attachmentUrl, url)).limit(1).all();
  if (announcement.length) return true;
  const assignment = db.select({ id: schema.assignments.id }).from(schema.assignments)
    .where(eq(schema.assignments.attachmentUrl, url)).limit(1).all();
  if (assignment.length) return true;
  const submission = db.select({ id: schema.assignmentSubmissions.id }).from(schema.assignmentSubmissions)
    .where(eq(schema.assignmentSubmissions.fileUrl, url)).limit(1).all();
  return submission.length > 0;
}

export function registerUploadRoutes(
  app: Express,
  authenticate: (req: Request, res: Response, next: NextFunction) => void
) {
  ensureUploadTable();

  app.get('/uploads/:folder/:name', authenticate, (req: Request, res: Response) => {
    const folder = String(req.params.folder || '');
    const name = String(req.params.name || '');
    if (!FOLDER_PATTERN.test(folder) || !NAME_PATTERN.test(name) || name.includes('..')) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }
    const url = `/uploads/${folder}/${name}`;
    const record = findUpload(url);
    const referenced = isReferenced(url);
    if (!canReadUpload(req.currentUser ?? null, record, referenced)) {
      res.status(403).json({ error: 'You do not have access to this file.' });
      return;
    }
    const root = fileStorage.getUploadDir();
    const target = path.join(root, folder, name);
    if (!target.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(target)) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.sendFile(target, { dotfiles: 'deny' }, error => {
      if (error && !res.headersSent) res.status(404).json({ error: 'File not found.' });
    });
  });
}
