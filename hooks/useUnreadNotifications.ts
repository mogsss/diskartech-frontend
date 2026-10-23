import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { db } from '@/utils/firebase';
import { APP_NOTIFICATIONS_COLLECTION, CHATS_COLLECTION } from '@/utils/notifications';
import { isChatUnreadForUser, normalizeChatFields } from '@/utils/chat';
import { mergeNotificationSources, type NotificationFeedItem } from '@/utils/notificationFeed';
import { applyNotificationPreferences, notificationTimestamp } from '@/utils/notificationPreferences';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';

export function useUnreadNotifications() {
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [apiItems, setApiItems] = useState<NotificationFeedItem[]>([]);
  const [liveItems, setLiveItems] = useState<NotificationFeedItem[]>([]);
  const [chatItems, setChatItems] = useState<NotificationFeedItem[]>([]);
  const { preferences, ready } = useNotificationPreferences(user?.id ?? null);
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const checkUnread = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (!mounted.current || request !== requestId.current) return;
      if (!storedUser) { setUser(null); setApiItems([]); return; }
      const data = JSON.parse(storedUser);
      if (!data.id) return;
      const id = String(data.id);
      const role = data.role || (data.student_school_name ? 'student' : data.household_name ? 'household' : 'employer');
      setUser(previous => previous?.id === id && previous.role === role ? previous : { id, role });
      const [response, profileString] = await Promise.all([
        api.get(role === 'student' ? '/student/applications' : '/employer/applicants'),
        AsyncStorage.getItem('userProfile'),
      ]);
      if (!mounted.current || request !== requestId.current) return;
      const applications = role === 'student' ? response.data?.applications : response.data?.applicants;
      const items: NotificationFeedItem[] = (Array.isArray(applications) ? applications : []).map((application: any) => {
        const status = String(application.status || 'update');
        const title = role !== 'student' ? 'New Applicant'
          : status === 'interview' ? 'Interview Invitation'
          : status === 'accepted' ? 'Application Approved'
          : status === 'rejected' ? 'Application Update'
          : `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        return {
          id: `app_${application.id}`, type: role === 'student' ? 'application_status' : 'application',
          title, targetId: application.id, applicationId: application.id,
          timestampMs: notificationTimestamp(role === 'student'
            ? application.updated_at || application.created_at : application.created_at || application.updated_at),
          read: role === 'student' ? status === 'pending' : status !== 'pending',
        };
      });
      if (profileString) {
        const profile = JSON.parse(profileString);
        const verified = profile.isVerified === 1 || profile.isVerified === true || profile.status === 'verified';
        const rejected = !verified && !!profile.rejection_reason;
        const uploaded = role === 'student' ? !!profile.school_id || !!profile.coe
          : !!profile.valid_id_path || !!profile.employer_certificate_path;
        if (verified || rejected || uploaded || role !== 'student') items.push({
          id: role === 'student' ? 'student_verification_status' : 'verification_status',
          type: 'verification', read: verified,
          timestampMs: notificationTimestamp(profile.updated_at || profile.created_at),
        });
      }
      setApiItems(items);
    } catch {
      // Retain the last successful result when a refresh fails.
    }
  }, []);

  useFocusEffect(useCallback(() => { void checkUnread(); }, [checkUnread]));

  useEffect(() => {
    setLiveItems([]);
    setChatItems([]);
    if (!user) return;
    let active = true;
    const myId = user.id;
    const unsubscribeNotifications = onSnapshot(
      query(collection(db, APP_NOTIFICATIONS_COLLECTION), where('recipient_id', '==', myId)),
      snapshot => {
        if (!active) return;
        setLiveItems(snapshot.docs.map(snapshotDoc => {
          const item = snapshotDoc.data();
          return {
            id: `firestore_${snapshotDoc.id}`, firestoreDocId: snapshotDoc.id,
            type: item.type || 'application_status', title: item.title || 'Notification', message: item.body || '',
            targetId: item.target_id, applicationId: item.application_id, senderId: item.sender_id,
            timestampMs: notificationTimestamp(item.created_at), read: item.read === true,
          };
        }));
      },
      () => {},
    );
    const unsubscribeChats = onSnapshot(collection(db, CHATS_COLLECTION), snapshot => {
      if (!active) return;
      const items: NotificationFeedItem[] = [];
      snapshot.docs.forEach(snapshotDoc => {
        const raw = snapshotDoc.data();
        const participantIds = Array.isArray(raw.participant_ids) ? raw.participant_ids.map(String) : [];
        const senderId = String(raw.sender_id ?? raw.student_user_id ?? raw.studentId ?? '');
        const receiverId = String(raw.receiver_id ?? raw.owner_user_id ?? raw.ownerId ?? '');
        if (!participantIds.includes(myId) && senderId !== myId && receiverId !== myId) return;
        const chat = normalizeChatFields(raw, snapshotDoc.id);
        const clearedAt = notificationTimestamp(raw[`cleared_at_for_${myId}`] ?? raw.cleared_at?.[myId]);
        if (clearedAt > 0 && notificationTimestamp(chat.last_message_at) <= clearedAt) return;
        const incomingAt = String(chat.last_sender_id) === myId
          ? raw[`last_message_at_for_${myId}`] || chat.last_message_at : chat.last_message_at;
        items.push({
          id: `chat_${snapshotDoc.id}`, type: 'message', targetId: snapshotDoc.id,
          timestampMs: notificationTimestamp(incomingAt), read: !isChatUnreadForUser(chat, myId, user.role as any),
        });
      });
      setChatItems(items);
    }, () => {});
    return () => { active = false; unsubscribeNotifications(); unsubscribeChats(); };
  }, [user]);

  const visibleItems = useMemo(() => mergeNotificationSources(
    applyNotificationPreferences(apiItems, preferences),
    applyNotificationPreferences(liveItems, preferences),
    applyNotificationPreferences(chatItems, preferences),
  ), [apiItems, liveItems, chatItems, preferences]);
  const unreadCount = ready ? visibleItems.filter(item => !item.read).length : 0;
  // Removing a notification does not mark a conversation read or erase messages.
  const unreadMessagesCount = chatItems.filter(item => !item.read).length;
  return { hasUnread: unreadCount > 0, unreadCount, unreadMessagesCount, refresh: checkUnread };
}
