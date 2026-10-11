/** Stable wire/display format, independent of Android/iOS locale whitespace. */
export function formatInterviewTime(date: Date): string {
  const hours = date.getHours();
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

/** Normalize saved times as well as picker values without accepting invalid clocks. */
export function normalizeInterviewTime(value: string): string | null {
  const text = value.replace(/[\u200E\u200F\u2066-\u2069\uFEFF]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const twelveHour = /^(0?[1-9]|1[0-2]):([0-5]\d)(?::00)?\s*([AP]M)$/.exec(text);
  if (twelveHour) return `${twelveHour[1].padStart(2, '0')}:${twelveHour[2]} ${twelveHour[3]}`;
  const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(text);
  if (!twentyFourHour) return null;
  const hours = Number(twentyFourHour[1]);
  return `${String(hours % 12 || 12).padStart(2, '0')}:${twentyFourHour[2]} ${hours >= 12 ? 'PM' : 'AM'}`;
}
