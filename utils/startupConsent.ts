export const STARTUP_CONSENT_KEY = '@diskartech/startup-policy-consent';

export interface StartupPolicyVersions {
  terms: string;
  privacy: string;
}

interface ConsentStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

/** A device acknowledgement, separate from account credentials and OS permissions. */
export async function hasStartupConsent(storage: ConsentStorage, versions: StartupPolicyVersions): Promise<boolean> {
  // A read failure is different from a missing agreement. Let the gate offer a
  // retry instead of incorrectly asking an existing user to agree again.
  const raw = await storage.getItem(STARTUP_CONSENT_KEY);
  if (!raw) return false;
  try {
    const record = JSON.parse(raw);
    return record?.accepted === true
      && record.terms === versions.terms
      && record.privacy === versions.privacy
      && typeof record.acceptedAt === 'string'
      && Number.isFinite(Date.parse(record.acceptedAt));
  } catch {
    return false;
  }
}

export async function saveStartupConsent(storage: ConsentStorage, versions: StartupPolicyVersions, checked: boolean): Promise<void> {
  if (!checked) throw new Error('Policy agreement is required.');
  // Let storage failures propagate: the UI must stay gated until saving succeeds.
  const record = JSON.stringify({
    accepted: true,
    ...versions,
    acceptedAt: new Date().toISOString(),
  });
  await storage.setItem(STARTUP_CONSENT_KEY, record);
  if (await storage.getItem(STARTUP_CONSENT_KEY) !== record) {
    throw new Error('Policy agreement could not be verified on this device.');
  }
}
