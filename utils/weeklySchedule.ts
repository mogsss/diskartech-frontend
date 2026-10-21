export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type WeekDay = typeof WEEK_DAYS[number];
export interface ScheduleSlot {
  day_of_week: WeekDay;
  start_time: string;
  end_time: string;
  ends_next_day: boolean;
}
export interface ScheduleDraft { days: WeekDay[]; slots: ScheduleSlot[] }
/** Schedules use Philippine time, regardless of the phone's timezone. */
export function currentScheduleDay(now = new Date()): WeekDay {
  const philippineTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return WEEK_DAYS[(philippineTime.getUTCDay() + 6) % 7];
}
export const SCHEDULE_PRESETS = [
  { label: 'Morning', start: '06:00', end: '12:00', next: false, icon: 'wb-sunny' },
  { label: 'Afternoon', start: '13:00', end: '17:00', next: false, icon: 'wb-twilight' },
  { label: 'Evening', start: '18:00', end: '22:00', next: false, icon: 'nightlight-round' },
  { label: 'Night', start: '22:00', end: '06:00', next: true, icon: 'nights-stay' },
  { label: 'Whole day', start: '00:00', end: '00:00', next: true, icon: 'schedule' },
] as const;
const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const time = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const sortSlots = (slots: ScheduleSlot[]) => [...slots].sort((a, b) => WEEK_DAYS.indexOf(a.day_of_week) - WEEK_DAYS.indexOf(b.day_of_week) || a.start_time.localeCompare(b.start_time));

export function scheduleDraft(slots: unknown, days: unknown = [], legacyTime = ''): ScheduleDraft {
  let savedDays = days;
  if (typeof days === 'string') { try { savedDays = JSON.parse(days); } catch { savedDays = []; } }
  const normalizedDays = WEEK_DAYS.filter(d => Array.isArray(savedDays) && savedDays.some(v => typeof v === 'string' && v.trim().slice(0, 3).toLowerCase() === d.toLowerCase()));
  if (Array.isArray(slots) && slots.length) {
    const valid = slots.filter(s => s && WEEK_DAYS.includes(s.day_of_week) && typeof s.start_time === 'string' && typeof s.end_time === 'string')
      .map(s => ({ day_of_week: s.day_of_week, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), ends_next_day: Boolean(s.ends_next_day) }));
    return { days: WEEK_DAYS.filter(d => valid.some(s => s.day_of_week === d)), slots: sortSlots(valid) };
  }
  const parsed: ScheduleSlot[] = [];
  const legacyPresets = ['Morning (6AM - 12PM)', 'Afternoon (1PM - 5PM)', 'Evening (6PM - 10PM)', 'Night (10PM - 6AM)', 'Whole Day'];
  for (const day of normalizedDays) for (const label of legacyTime.split(' & ')) {
    const preset = SCHEDULE_PRESETS.find((p, i) => label.trim().toLowerCase() === p.label.toLowerCase() || label.trim().toLowerCase() === legacyPresets[i].toLowerCase());
    if (preset) parsed.push({ day_of_week: day, start_time: preset.start, end_time: preset.end, ends_next_day: preset.next });
  }
  return { days: [...normalizedDays], slots: sortSlots(parsed) };
}

export function scheduleError(draft: ScheduleDraft): string | null {
  if (!draft.days.length) return 'Select at least one day.';
  for (const day of draft.days) {
    const slots = draft.slots.filter(s => s.day_of_week === day);
    if (!slots.length) return `Add hours for ${day}.`;
    if (slots.length > 3) return `Use up to 3 ranges for ${day}.`;
  }
  const intervals: number[][] = [];
  for (const s of draft.slots) {
    if (!draft.days.includes(s.day_of_week) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time)) return 'Use a valid time in HH:MM format.';
    const start = minute(s.start_time), end = minute(s.end_time) + (s.ends_next_day ? 1440 : 0);
    if (end <= start || end - start > 1440) return 'End time must follow start time, with a maximum of 24 hours.';
    const offset = WEEK_DAYS.indexOf(s.day_of_week) * 1440;
    if (offset + end > 10080) intervals.push([offset + start, 10080], [0, offset + end - 10080]);
    else intervals.push([offset + start, offset + end]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  if (intervals.some((s, i) => i > 0 && s[0] < intervals[i - 1][1])) return 'Some hours overlap, including across midnight. Adjust those ranges.';
  return null;
}

/** Merge same-day overlapping/adjacent windows without losing a break between classes. */
export function addScheduleSlot(current: ScheduleSlot[], slot: ScheduleSlot): ScheduleSlot[] {
  const ranges = [...current.filter(s => s.day_of_week === slot.day_of_week), slot]
    .map(s => [minute(s.start_time), minute(s.end_time) + (s.ends_next_day ? 1440 : 0)])
    .sort((a, b) => a[0] - b[0]);
  const merged: number[][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return sortSlots([...current.filter(s => s.day_of_week !== slot.day_of_week), ...merged.map(([start, end]) => ({
    day_of_week: slot.day_of_week, start_time: time(start), end_time: time(end), ends_next_day: end >= 1440,
  }))]);
}

export function formatTime(value: string): string {
  const [hour, minutes] = value.split(':').map(Number);
  return `${hour % 12 || 12}${minutes ? ':' + String(minutes).padStart(2, '0') : ''} ${hour < 12 ? 'AM' : 'PM'}`;
}
export function slotLabel(slot: ScheduleSlot): string {
  if (slot.start_time === '00:00' && slot.end_time === '00:00' && slot.ends_next_day) return 'Whole day';
  return `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}${slot.ends_next_day ? ' (next day)' : ''}`;
}
export function weeklySummary(slots: ScheduleSlot[]): string {
  return WEEK_DAYS.filter(d => slots.some(s => s.day_of_week === d)).map(day => `${day}: ${slots.filter(s => s.day_of_week === day).map(slotLabel).join(', ')}`).join('\n');
}
export function weeklyHours(slots: ScheduleSlot[]): number {
  return slots.reduce((total, s) => total + minute(s.end_time) + (s.ends_next_day ? 1440 : 0) - minute(s.start_time), 0) / 60;
}
