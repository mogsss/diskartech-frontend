import { useEffect, useMemo, useState } from 'react';
import { subscribeNotificationDismissals } from '@/utils/notificationActions';
import {
  EMPTY_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  readNotificationPreferences,
  subscribeNotificationPreferences,
} from '@/utils/notificationPreferences';

export function useNotificationPreferences(userId: string | null) {
  const [state, setState] = useState<{ userId: string | null; preferences: NotificationPreferences; error?: Error }>({
    userId: null, preferences: EMPTY_NOTIFICATION_PREFERENCES,
  });
  const [remote, setRemote] = useState<{ userId: string | null; deleted: Record<string, number>; error?: Error }>({
    userId: null, deleted: {},
  });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const unsubscribe = subscribeNotificationDismissals(userId,
      deleted => { if (active) setRemote({ userId, deleted }); },
      error => {
        console.warn('Notification dismissal sync failed:', error);
        if (active) setRemote(previous => ({ userId, deleted: previous.userId === userId ? previous.deleted : {}, error }));
      },
    );
    return () => { active = false; unsubscribe(); };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let updated = false;
    const unsubscribe = subscribeNotificationPreferences(userId, preferences => {
      updated = true;
      if (active) setState({ userId, preferences });
    });
    void readNotificationPreferences(userId).then(preferences => {
      if (active && !updated) setState({ userId, preferences });
    }).catch(error => {
      if (active && !updated) setState({ userId, preferences: EMPTY_NOTIFICATION_PREFERENCES, error });
    });
    return () => { active = false; unsubscribe(); };
  }, [userId]);

  const preferences = useMemo(() => {
    const local = state.userId === userId ? state.preferences : EMPTY_NOTIFICATION_PREFERENCES;
    const deleted = { ...local.deleted };
    if (remote.userId === userId) {
      Object.entries(remote.deleted).forEach(([id, through]) => { deleted[id] = Math.max(deleted[id] ?? 0, through); });
    }
    return { read: local.read, deleted };
  }, [state, remote, userId]);

  return {
    preferences,
    ready: !!userId && state.userId === userId && remote.userId === userId,
    // Cloud sync must not disable local read actions or show a misleading reopen toast.
    // Delete still requires a successful cloud transaction and reports its own failure.
    error: state.userId === userId ? state.error : undefined,
  };
}
