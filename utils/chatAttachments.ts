import type { ChatAttachment } from '@/types/chat';

export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const CHAT_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const extensions: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', docx: CHAT_FILE_TYPES[5] };

export type ChatAttachmentDraft = {
  uri: string;
  filename: string;
  mime_type: string;
  kind: 'image' | 'file';
  size?: number;
  file?: Blob;
};

export function sanitizeAttachmentName(value: string): string {
  return value.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069<>:"|?*]/g, '').trim().slice(0, 180) || 'attachment';
}

export function createAttachmentDraft(asset: { uri: string; name?: string | null; fileName?: string | null; mimeType?: string; size?: number; fileSize?: number; file?: Blob }): ChatAttachmentDraft {
  if (!/^(file|content|blob):/i.test(asset.uri) && !(asset.file && /^data:/i.test(asset.uri))) throw new Error('Please choose a file from your device.');
  const filename = sanitizeAttachmentName(asset.name || asset.fileName || asset.uri.split(/[?#]/)[0].split('/').pop() || 'attachment.jpg');
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  const mime = asset.mimeType && asset.mimeType !== 'application/octet-stream' ? asset.mimeType.toLowerCase() : extensions[extension];
  if (!CHAT_FILE_TYPES.includes(mime)) throw new Error('Choose a JPG, PNG, WEBP, GIF, PDF, or DOCX file.');
  const size = asset.size ?? asset.fileSize;
  if (size !== undefined && (!Number.isFinite(size) || size <= 0 || size > MAX_CHAT_ATTACHMENT_BYTES)) throw new Error('Please choose a non-empty file no larger than 10 MB.');
  return { uri: asset.uri, filename, mime_type: mime, kind: mime.startsWith('image/') ? 'image' : 'file', ...(size === undefined ? {} : { size }), ...(asset.file ? { file: asset.file } : {}) };
}

export function normalizeChatAttachment(value: unknown): ChatAttachment | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.id)) return null;
  if (typeof data.filename !== 'string' || typeof data.mime_type !== 'string' || !CHAT_FILE_TYPES.includes(data.mime_type)) return null;
  if (typeof data.size !== 'number' || !Number.isInteger(data.size) || data.size <= 0 || data.size > MAX_CHAT_ATTACHMENT_BYTES) return null;
  const kind = data.mime_type.startsWith('image/') ? 'image' : 'file';
  if (data.kind !== kind) return null;
  return { id: data.id, filename: sanitizeAttachmentName(data.filename), mime_type: data.mime_type, kind, size: data.size };
}

export function attachmentSummary(attachment: ChatAttachment): string {
  return attachment.kind === 'image' ? 'Photo' : `File: ${attachment.filename}`;
}

export function formatAttachmentSize(size?: number): string {
  if (!size) return 'Up to 10 MB';
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeChatText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 2000);
}
