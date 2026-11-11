/**
 * Upload read authorization, kept free of Express and database imports so it is unit-testable.
 *
 * Policy:
 * - staff (teacher, coordinator, principal) may read any uploaded file;
 * - the uploader may read their own file;
 * - any signed-in user may read a file the portal already links from an announcement, an
 *   assignment, or a submission — those attachments are class material by design;
 * - anonymous callers get nothing. Files with no registry row and no reference are private.
 */
export type UploadRecord = {
  url: string;
  ownerId: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type UploadReader = { id: number; role: string } | null;

const STAFF_ROLES = new Set(['teacher', 'coordinator', 'principal']);

export function canReadUpload(reader: UploadReader, record: UploadRecord | null, referenced: boolean): boolean {
  if (!reader) return false;
  if (STAFF_ROLES.has(reader.role)) return true;
  if (record && record.ownerId === reader.id) return true;
  return referenced;
}
