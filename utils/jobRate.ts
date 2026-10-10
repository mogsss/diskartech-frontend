export type SalaryType = 'day' | 'hour';

export function getSalaryType(value: unknown): SalaryType {
  return value === 'hour' ? 'hour' : 'day';
}

export function getSalaryUnit(value: unknown, format: 'short' | 'long' = 'short'): string {
  const hourly = getSalaryType(value) === 'hour';
  return format === 'long' ? (hourly ? 'per hour' : 'per day') : (hourly ? '/ hour' : '/ day');
}

export function getSalaryLabel(value: unknown): string {
  return getSalaryType(value) === 'hour' ? 'Hourly rate' : 'Daily rate';
}
