import { STARTUP_CONSENT_KEY } from '@/utils/startupConsent';

interface LogoutStorage {
  getAllKeys: () => Promise<readonly string[]>;
  multiRemove: (keys: string[]) => Promise<void>;
}

/** Remove account data without discarding the device's policy acknowledgement. */
export async function clearStorageForLogout(storage: LogoutStorage): Promise<void> {
  const keys = await storage.getAllKeys();
  const accountKeys = keys.filter((key) => key !== STARTUP_CONSENT_KEY);
  if (accountKeys.length) await storage.multiRemove(accountKeys);
}
