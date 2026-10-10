export const AVAILABLE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const TIME_SLOTS = [
  'Morning (6AM - 12PM)',
  'Afternoon (1PM - 5PM)',
  'Evening (6PM - 10PM)',
  'Whole Day',
];

export function parseTimeSlots(value: unknown): string[] {
  const slots = typeof value === 'string' ? value.split(' & ') : Array.isArray(value) ? value : [];
  return [...new Set(slots.filter((slot): slot is string => typeof slot === 'string')
    .map((slot) => slot.trim()).filter(Boolean))];
}

export function toggleTimeSlot(current: string[], slot: string): string[] {
  if (current.includes(slot)) return current.filter((selected) => selected !== slot);
  if (slot === 'Whole Day') return [slot];
  const next = current.filter((selected) => selected !== 'Whole Day');
  if (next.length >= 2) return current;
  next.push(slot);
  return [...TIME_SLOTS.filter((option) => next.includes(option)), ...next.filter((option) => !TIME_SLOTS.includes(option))];
}

// Keep the API's existing string field readable by all job and contract screens.
export function serializeTimeSlots(slots: string[]): string {
  return slots.join(' & ');
}
