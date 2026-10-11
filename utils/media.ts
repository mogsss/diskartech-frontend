import { BACKEND_URL, STORAGE_URL } from '@/api/axios';

/** Preserve Cloudinary/signed URLs; only legacy upload paths need /storage/. */
export function resolveMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path || /^(null|undefined)$/i.test(path) || /[\x00-\x1f\x7f<>\\]/.test(path)) return null;
  if (/^https?:\/\//i.test(path) || /^(file|content):\/\//i.test(path)) return path;
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')) return null;
  const relative = path.replace(/^\//, '').replace(/^(?:storage\/)+/, '');
  // Private references require a fresh authorized URL from the backend.
  if (relative.startsWith('cloudinary/raw/authenticated/')) return null;
  if (relative.split(/[?#]/)[0].split('/').some(segment => segment === '..' || segment === '.')) return null;
  if (relative.startsWith('media/')) return `${BACKEND_URL}/${relative}`;
  return `${STORAGE_URL}${relative}`;
}

export function mediaFilename(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.split(/[?#]/)[0].split('/').pop();
  if (!name) return null;
  try { return decodeURIComponent(name); } catch { return name; }
}
