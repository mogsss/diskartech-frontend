import { db } from '@/utils/firebase';
import type { NotificationFeedItem } from './notificationFeed';
import { notificationTimestamp } from './notificationPreferences';
import { collection, doc, onSnapshot, query, runTransaction, where } from 'firebase/firestore';

const ALERTS_COLLECTION = 'app_notifications';
export const NOTIFICATION_DISMISSAL_TYPE = 'notification_dismissal';

function dismissalsFor(userId: string) {
  if (!userId || userId === 'unknown' || userId.includes('/')) throw new Error('Please sign in again.');
  return collection(db, ALERTS_COLLECTION);
}

/** Account-scoped cutoffs also dismiss summaries reconstructed from applications/chats. */
export function subscribeNotificationDismissals(
  userId: string,
  onChange: (deleted: Record<string, number>) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(query(dismissalsFor(userId), where('recipient_id', '==', userId)), snapshot => {
    const deleted: Record<string, number> = {};
    snapshot.docs.forEach(entry => {
      const data = entry.data();
      if (data.type === NOTIFICATION_DISMISSAL_TYPE && typeof data.source_id === 'string' && typeof data.through === 'number' && Number.isFinite(data.through) && data.through >= 0) {
        deleted[data.source_id] = data.through;
      }
    });
    onChange(deleted);
  }, onError);
}

/** Delete alerts and persist their dismissal together. Never delete underlying applications/chats. */
export async function deleteNotificationSources(userId: string, items: NotificationFeedItem[]) {
  const dismissals = dismissalsFor(userId);
  const unique = new Map<string, NotificationFeedItem>();
  for (const item of items) {
    if (!item.id || encodeURIComponent(item.id).length > 1000 || item.firestoreDocId?.includes('/') || item.firestoreDocId === '') {
      throw new Error('Invalid notification.');
    }
    const previous = unique.get(item.id);
    if (!previous || notificationTimestamp(item.timestampMs) > notificationTimestamp(previous.timestampMs)) unique.set(item.id, item);
  }
  // If the API was unavailable, a live application alert may be the only source.
  // Dismiss its known summary too, so a later successful API fetch cannot revive it.
  // Legacy employer alerts can contain a job ID; never infer from that target.
  for (const item of [...unique.values()]) {
    if (!item.firestoreDocId || !['application', 'application_status'].includes(item.type || '')) continue;
    const applicationId = item.applicationId ?? (item.type === 'application_status' ? item.targetId : undefined);
    if (applicationId == null || !/^[1-9]\d*$/.test(String(applicationId))) continue;
    const id = `app_${applicationId}`;
    if (!unique.has(id)) unique.set(id, { id, timestampMs: item.timestampMs });
  }
  const targets = [...unique.values()];
  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  // At most 200 writes per transaction; large Select all operations stay bounded.
  for (let offset = 0; offset < targets.length; offset += 100) {
    const chunk = targets.slice(offset, offset + 100);
    try {
      await runTransaction(db, async transaction => {
        // Firestore requires all reads to precede writes. Retried transactions reread versions.
        const records = await Promise.all(chunk.map(async item => {
          const dismissalRef = doc(dismissals, `dismissal:${encodeURIComponent(userId)}:${encodeURIComponent(item.id)}`);
          const dismissal = await transaction.get(dismissalRef);
          const alertRef = item.firestoreDocId ? doc(db, ALERTS_COLLECTION, item.firestoreDocId) : null;
          const alert = alertRef ? await transaction.get(alertRef) : null;
          if (alert?.exists() && String(alert.data().recipient_id) !== userId) throw new Error('This notification is not yours.');
          if (alert?.exists() && alert.data().type === NOTIFICATION_DISMISSAL_TYPE) throw new Error('Invalid notification.');
          if (dismissal.exists() && (dismissal.data().type !== NOTIFICATION_DISMISSAL_TYPE || String(dismissal.data().recipient_id) !== userId)) throw new Error('Invalid dismissal.');
          return { item, dismissalRef, dismissal, alertRef, alert };
        }));
        for (const { item, dismissalRef, dismissal, alertRef, alert } of records) {
          const through = notificationTimestamp(item.timestampMs);
          const previous = dismissal.exists() ? notificationTimestamp(dismissal.data().through) : -1;
          if (previous < through) transaction.set(dismissalRef, { type: NOTIFICATION_DISMISSAL_TYPE, source_id: item.id, through, recipient_id: userId, read: true });
          // A rescheduled interview/newer event arriving during confirmation must survive.
          if (alertRef && alert?.exists() && notificationTimestamp(alert.data().created_at) <= through) transaction.delete(alertRef);
        }
      });
      deletedIds.push(...chunk.map(item => item.id));
    } catch {
      // No local-only success fallback: denied/offline writes remain available for retry.
      failedIds.push(...chunk.map(item => item.id));
    }
  }
  return { deletedIds, failedIds };
}
