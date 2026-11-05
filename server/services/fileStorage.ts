import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * FileStorageProvider interface designed for seamless cloud migration (e.g. S3 / Supabase Storage)
 * while operating 100% locally during Phase 1.
 */
export interface FileStorageProvider {
  saveFile(buffer: Buffer, originalName: string, mimeType: string, folder?: string): Promise<{ url: string; fileName: string; size: number }>;
  deleteFile(fileUrl: string): Promise<void>;
}

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.csv', '.xlsx', '.pptx', '.zip'
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export class LocalFileStorageService implements FileStorageProvider {
  private baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, originalName: string, _mimeType: string, folder = 'general') {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error('File exceeds maximum allowed size of 10MB.');
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
