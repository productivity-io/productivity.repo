import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

/**
 * FileStorageProvider interface designed for seamless cloud migration (e.g. Vercel Blob / S3)
 * while operating 100% locally in dev and safely in /tmp on serverless runtimes.
 */
export interface FileStorageProvider {
  saveFile(buffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<{ url: string; fileName: string; size: number }>;
  deleteFile(fileUrl: string): Promise<void>;
  getUploadDir(): string;
}

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.csv', '.xlsx', '.pptx', '.zip'
]);

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const MAX_FILE_SIZE_BYTES = isServerless ? 4 * 1024 * 1024 : 10 * 1024 * 1024;

export class LocalFileStorageService implements FileStorageProvider {
  private baseUploadDir: string;

  constructor() {
    this.baseUploadDir = process.env.VERITAS_UPLOAD_DIR
      ? path.resolve(process.env.VERITAS_UPLOAD_DIR)
      : isServerless
        ? path.join(os.tmpdir(), 'veritas-uploads')
        : path.resolve(process.cwd(), 'uploads');

    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  getUploadDir(): string {
    return this.baseUploadDir;
  }

  async saveFile(buffer: Buffer, originalName: string, _mimeType: string, folder = 'general') {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      const limitMb = isServerless ? '4MB' : '10MB';
      throw new Error(`File exceeds maximum allowed size of ${limitMb}.`);
    }

    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Unsupported file type (${ext}). Allowed: PDF, Word, Images, Text, CSV, ZIP.`);
    }

    const sanitizedBase = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);

    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${sanitizedBase}${ext}`;
    const targetFolder = path.join(this.baseUploadDir, folder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const fullPath = path.join(targetFolder, uniqueName);
    await fs.promises.writeFile(fullPath, buffer);

    return {
      url: `/uploads/${folder}/${uniqueName}`,
      fileName: originalName,
      size: buffer.length,
    };
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl.startsWith('/uploads/')) return;
    const relativePath = fileUrl.replace(/^\/uploads\//, '');
    const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(this.baseUploadDir, safePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }
}

export const fileStorage = new LocalFileStorageService();
