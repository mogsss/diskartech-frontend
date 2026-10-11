// For ordinary text fields only; never use this for passwords, tokens or file data.
export function sanitizePlainText(value: string): string {
  return value.replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .trim();
}

export function containsMarkup(value: string): boolean {
  const decoded = value.replace(/&(?:lt|#0*60|#x0*3c);/gi, '<').replace(/&(?:gt|#0*62|#x0*3e);/gi, '>');
  return /<\/?[a-z][^>]*>|<!--|<!doctype/i.test(decoded);
}

export function isValidCompensation(value: string): boolean {
  return /^\d{1,9}(?:\.\d{1,2})?$/.test(value) && Number(value) > 0;
}
