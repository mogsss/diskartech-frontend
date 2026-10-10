import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { db } from '@/utils/firebase';
import { APP_NOTIFICATIONS_COLLECTION, CHATS_COLLECTION } from '@/utils/notifications';
import { isChatUnreadForUser, normalizeChatFields } from '@/utils/chat';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';

export function useUnreadNotifications() {
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  const [notifsUnreadCount, setNotifsUnreadCount] = useState(0);
  const [chatsUnreadCount, setChatsUnreadCount] = useState(0);

  // Kapag nagbago ang alinman sa system notifications o chat messages, i-update ang total
  useEffect(() => {
    const total = notifsUnreadCount + chatsUnreadCount;
    setUnreadCount(total);
    setHasUnread(total > 0);
  }, [notifsUnreadCount, chatsUnreadCount]);

  const checkUnread = useCallback(async () => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (!storedUser) return;
      const user = JSON.parse(storedUser);
      const userRole = user.role || (user.student_school_name ? 'student' : user.household_name ? 'household' : 'employer');

      const readNotifsString = await AsyncStorage.getItem('read_notifications');
      const readNotifsIds: string[] = readNotifsString ? JSON.parse(readNotifsString) : [];

      let unread = 0;

      if (userRole === 'student') {
        const res = await api.get('/student/applications').catch(() => null);
        if (res?.data?.applications && Array.isArray(res.data.applications)) {
          res.data.applications.forEach((app: any) => {
            const notifId = `app_${app.id}`;
            if (!readNotifsIds.includes(notifId) && app.status && app.status !== 'pending') {
              unread++;
            }
          });
        }
      } else {
        // Employer / Household
        const res = await api.get('/employer/applicants').catch(() => null);
        if (res?.data?.applicants && Array.isArray(res.data.applicants)) {
          res.data.applicants.forEach((app: any) => {
            const notifId = `app_${app.id}`;
            if (!readNotifsIds.includes(notifId) && app.status === 'pending') {
              unread++;
            }
          });
        }

      }

      // Check if verification rejected is unread for either role
      const profileStr = await AsyncStorage.getItem('userProfile');
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        const isVerified = profile.isVerified === 1 || profile.isVerified === true;
        const isRejected = !isVerified && !!profile.rejection_reason;
        const notifKey = userRole === 'student' ? 'student_verification_status' : 'verification_status';
        if (isRejected && !readNotifsIds.includes(notifKey)) {
          unread++;
        }
      }

      setNotifsUnreadCount(unread);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkUnread();
    }, [checkUnread])
  );

  // Real-time listener para sa Firestore notifications at Chats
  useEffect(() => {
    let unsubscribeAppNotifs = () => {};
    let unsubscribeChats = () => {};

    const setupListeners = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (!storedUser) return;
        const user = JSON.parse(storedUser);
        const myId = user.id ? String(user.id) : null;
        const userRole = user.role || (user.student_school_name ? 'student' : user.household_name ? 'household' : 'employer');
        if (!myId) return;

        // 1. Real-time listener para sa APP_NOTIFICATIONS_COLLECTION
        const notifsRef = collection(db, APP_NOTIFICATIONS_COLLECTION);
        const q = query(notifsRef, where('recipient_id', '==', myId));
        unsubscribeAppNotifs = onSnapshot(
          q,
          async (snapshot) => {
            const readNotifsString = await AsyncStorage.getItem('read_notifications');
            const readNotifsIds: string[] = readNotifsString ? JSON.parse(readNotifsString) : [];

            let firestoreUnreadCount = 0;
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const notifId = `firestore_${docSnap.id}`;
              if (!readNotifsIds.includes(notifId) && data.read !== true) {
                firestoreUnreadCount++;
              }
            });

            if (firestoreUnreadCount > 0) {
              setNotifsUnreadCount((prev) => Math.max(prev, firestoreUnreadCount));
            } else {
              checkUnread();
            }
          },
          () => {}
        );

        // 2. Real-time listener para sa CHATS_COLLECTION
        unsubscribeChats = onSnapshot(
          collection(db, CHATS_COLLECTION),
          (snapshot) => {
            const matchedDocs = snapshot.docs.filter((docSnap) => {
              const raw = docSnap.data();
              const sId = String(raw.sender_id ?? raw.student_user_id ?? raw.studentId ?? '');
              const rId = String(raw.receiver_id ?? raw.owner_user_id ?? raw.ownerId ?? '');
              const pIds: string[] = Array.isArray(raw.participant_ids)
                ? raw.participant_ids.map(String)
                : [];
              return pIds.includes(myId) || sId === myId || rId === myId;
            });

            let unreadChatCount = 0;
            matchedDocs.forEach((docSnap) => {
              const chat = normalizeChatFields(docSnap.data(), docSnap.id);
              const isUnread = isChatUnreadForUser(chat, myId, userRole as any);
              if (isUnread) {
                unreadChatCount++;
              }
            });

            setChatsUnreadCount(unreadChatCount);
            setUnreadMessagesCount(unreadChatCount);
          },
          (err) => console.log('chats listener error:', err)
        );
      } catch {
        // ignore
      }
    };

    setupListeners();

    return () => {
      unsubscribeAppNotifs();
      unsubscribeChats();
    };
  }, [checkUnread]);

  return { hasUnread, unreadCount, unreadMessagesCount, refresh: checkUnread };
}
