export type HirerAccountType = 'household' | 'business';

export function parseAccountRecord(value: unknown): Record<string, any> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

/** Authenticated account data takes priority over optional navigation hints. */
export function resolveHirerAccountType(user: unknown, profile: unknown, routeType?: unknown): HirerAccountType | null {
  const account = parseAccountRecord(user);
  const details = parseAccountRecord(profile);
  for (const role of [account.role, details.role]) {
    if (role === 'household') return 'household';
    if (role === 'employer' || role === 'business') return 'business';
  }
  // /user/profile currently returns profile fields without a top-level role.
  if (typeof details.household_name === 'string') return 'household';
  if (typeof details.employer_name === 'string' || typeof details.business_name === 'string') return 'business';
  const hint = Array.isArray(routeType) ? routeType[0] : routeType;
  return hint === 'household' ? 'household' : hint === 'business' || hint === 'employer' ? 'business' : null;
}
