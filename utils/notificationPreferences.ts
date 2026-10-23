import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationFeedItem } from './notificationFeed';

export interface NotificationPreferences {
  read: Record<string, number>;
  deleted: Record<string, number>;
}

export const EMPTY_NOTIFICATION_PREFERENCES: NotificationPreferences = { read: {}, deleted: {} };
const listeners = new Map<string, Set<(value: NotificationPreferences) => void>>();
const pendingWrites = new Map<string, Promise<unknown>>();
const storageKey = (userId: string) => `notification_preferences:${userId}`;

export function notificationTimestamp(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') return notificationTimestamp(value.toMillis());
    if ('seconds' in value && typeof value.seconds === 'number') return notificationTimestamp(value.seconds * 1000);
  }
  return typeof value === 'string' ? notificationTimestamp(Date.parse(value)) : 0;
}

const includesEvent = (entries: Record<string, number>, item: NotificationFeedItem) =>
  Object.prototype.hasOwnProperty.call(entries, item.id) && entries[item.id] >= notificationTimestamp(item.timestampMs);

export function applyNotificationPreferences<T extends NotificationFeedItem>(items: T[], preferences: NotificationPreferences): T[] {
  return items.filter(item => !includesEvent(preferences.deleted, item))
    .map(item => includesEvent(preferences.read, item) ? { ...item, read: true } : item);
}

export async function readNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const stored = await AsyncStorage.getItem(storageKey(userId));
  if (!stored) return { read: {}, deleted: {} };
  const parsed = JSON.parse(stored);
  const sanitize = (entries: unknown): Record<string, number> => entries && typeof entries === 'object' && !Array.isArray(entries)
    ? Object.fromEntries(Object.entries(entries).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0))
    : {};
  return { read: sanitize(parsed?.read), deleted: sanitize(parsed?.deleted) };
}

export function subscribeNotificationPreferences(userId: string, listener: (value: NotificationPreferences) => void) {
  const subscribers = listeners.get(userId) || new Set();
  subscribers.add(listener);
  listeners.set(userId, subscribers);
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) listeners.delete(userId);
  };
}

/** Serialize writes so a quick tap and a bulk action cannot overwrite one another. */
export function saveNotificationAction(userId: string, action: 'read' | 'deleted', items: NotificationFeedItem[]): Promise<NotificationPreferences> {
  if (!userId) return Promise.reject(new Error('Please sign in again.'));
  const update = (pendingWrites.get(userId) || Promise.resolve()).catch(() => {}).then(async () => {
    const preferences = await readNotificationPreferences(userId);
    for (const item of items) {
      preferences[action][item.id] = Math.max(preferences[action][item.id] ?? 0, notificationTimestamp(item.timestampMs));
    }
    // Publish only after persistence succeeds. A failed write keeps the original feed.
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(preferences));
    listeners.get(userId)?.forEach(listener => listener(preferences));
    return preferences;
  });
  pendingWrites.set(userId, update);
  const release = () => { if (pendingWrites.get(userId) === update) pendingWrites.delete(userId); };
  void update.then(release, release);
  return update;
}

/** A displayed card can represent several API/Firestore source records. */
export function getNotificationActionSources(selected: NotificationFeedItem[], sources: NotificationFeedItem[]) {
  const ids = new Set(selected.flatMap(item => item.mergedIds || [item.id]));
  return sources.filter(item => ids.has(item.id));
}
