import { useEffect, useState } from 'react';
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

  return {
    preferences: state.userId === userId ? state.preferences : EMPTY_NOTIFICATION_PREFERENCES,
    ready: !!userId && state.userId === userId,
    error: state.userId === userId ? state.error : undefined,
  };
}
