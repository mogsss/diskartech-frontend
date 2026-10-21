import api from '@/api/axios';
import NotificationCard from '@/components/ui/NotificationCard';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import {
  CHATS_COLLECTION,
  getOtherParticipant,
  isChatUnreadForUser,
  markChatAsRead,
  normalizeChatFields,
} from '@/utils/chat';
import { db } from '@/utils/firebase';
import { APP_NOTIFICATIONS_COLLECTION } from '@/utils/notifications';
import { mergeNotificationSources } from '@/utils/notificationFeed';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FilterTab = 'all' | 'applications' | 'messages' | 'updates';

function getTimestampMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'object') {
    if ('toMillis' in (val as any) && typeof (val as any).toMillis === 'function') {
      return (val as any).toMillis();
    }
    if ('toDate' in (val as any) && typeof (val as any).toDate === 'function') {
      return (val as any).toDate().getTime();
    }
    if ('seconds' in (val as any)) {
      return (val as any).seconds * 1000;
    }
  }
  if (typeof val === 'string') {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatNotificationTime(ms: number): string {
  if (!ms || ms <= 0) return 'Recent';
  const now = Date.now();
  const diff = now - ms;

  if (diff < 0) return 'Just now';
  if (diff < 60 * 1000) return 'Just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;

  const date = new Date(ms);
  const isYesterday = new Date(now - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

const incomingMsgCache = new Map<string, { text: string; ms: number }>();

export default function NotificationsScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [apiNotifications, setApiNotifications] = useState<any[]>([]);
  const [liveAppNotifications, setLiveAppNotifications] = useState<any[]>([]);
  const [chatNotifications, setChatNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const readNotificationIds = useRef(new Set<string>());

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentUserId(user.id?.toString());
          const role = user.role || (user.student_school_name ? 'student' : user.household_name ? 'household' : 'employer');
          setUserRole(role);
        }
      } catch (e) {
        console.error('Error fetching user data:', e);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!currentUserId || !userRole) return;

    let isMounted = true;
    let unsubscribeChats = () => { };
    let unsubscribeAppNotifs = () => { };

    const loadData = async () => {
      setLoading(true);
      try {
        const readNotifsString = await AsyncStorage.getItem('read_notifications');
        const readNotifsIds: string[] = readNotifsString ? JSON.parse(readNotifsString) : [];
        readNotificationIds.current = new Set(readNotifsIds);

        // 1. Fetch Backend API Notifications base sa user role
        if (userRole === 'student') {
          const studentNotifs: any[] = [];

          // 1a. Verification status notification para sa student
          try {
            const profileRes = await api.get('/user/profile');
            const profile = profileRes.data?.profile || profileRes.data?.user || profileRes.data;
            if (profile) {
              const isVerified = profile.isVerified === 1 || profile.isVerified === true || profile.status === 'verified';
              const isRejected = !isVerified && !!profile.rejection_reason;
              const hasUploadedDocs = !!profile.school_id || !!profile.coe;

              const notifId = 'student_verification_status';
              const isLocallyRead = readNotifsIds.includes(notifId);
              const ms = getTimestampMs(profile.updated_at || profile.created_at) || (Date.now() - 3600000);

              if (isVerified) {
                studentNotifs.push({
                  id: notifId,
                  title: 'Student Account Verified',
                  message: 'Your student credentials have been verified! You can now apply for jobs.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: true,
                  type: 'verification',
                });
              } else if (isRejected) {
                studentNotifs.push({
                  id: notifId,
                  title: 'Verification Rejected',
                  message: `Reason: ${profile.rejection_reason}. Tap here to re-upload your documents.`,
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead,
                  type: 'verification',
                });
              } else if (hasUploadedDocs) {
                studentNotifs.push({
                  id: notifId,
                  title: 'Verification Under Review',
                  message: 'Your student documents are currently being reviewed by Admin/AI.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead,
                  type: 'verification',
                });
              }
            }
          } catch (err) {
            console.error('Error fetching student verification status:', err);
          }

          // 1b. Application updates para sa student
          try {
            const res = await api.get('/student/applications');
            if (isMounted && res.data && res.data.applications) {
              const list = res.data.applications.map((app: any) => {
                const notifId = `app_${app.id}`;
                const isLocallyRead = readNotifsIds.includes(notifId);
                const ms = getTimestampMs(app.updated_at || app.created_at);

                const statusText = app.status === 'interview'
                  ? 'For Interview'
                  : app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : 'Update';

                let titleText = `Application ${statusText}`;
                let messageText: React.ReactNode = (
                  <Text>
                    Your application for <Text className="font-bold">{app.job?.title || 'Job'}</Text> is currently {app.status}.
                  </Text>
                );

                if (app.status === 'interview') {
                  titleText = 'Interview Invitation';
                  messageText = (
                    <Text>
                      You are invited for an interview for <Text className="font-bold">{app.job?.title || 'Job'}</Text>.
                    </Text>
                  );
                } else if (app.status === 'accepted') {
                  titleText = 'Application Approved';
                  messageText = (
                    <Text>
                      Congratulations! Your application for <Text className="font-bold">{app.job?.title || 'Job'}</Text> has been APPROVED.
                    </Text>
                  );
                } else if (app.status === 'rejected') {
                  titleText = 'Application Update';
                  messageText = (
                    <Text>
                      Your application for <Text className="font-bold">{app.job?.title || 'Job'}</Text> was not accepted.
                    </Text>
                  );
                }

                return {
                  id: notifId,
                  title: titleText,
                  message: messageText,
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead || app.status !== 'pending',
                  type: 'application_status',
                  targetId: app.id,
                  rawApplication: app,
                };
              });
              studentNotifs.push(...list);
            }
          } catch (err) {
            console.error('Error fetching student applications:', err);
          }

          if (isMounted) {
            setApiNotifications(studentNotifs);
          }
        } else {
          // Employer at Household accounts
          const empNotifs: any[] = [];

          try {
            const profileRes = await api.get('/user/profile');
            const profile = profileRes.data?.profile || profileRes.data?.user || profileRes.data;
            if (profile) {
              const isVerified = profile.isVerified === 1 || profile.isVerified === true || profile.status === 'verified';
              const isRejected = !isVerified && !!profile.rejection_reason;
              const hasUploadedDocs = !!profile.valid_id_path || !!profile.employer_certificate_path;

              const notifId = 'verification_status';
              const isLocallyRead = readNotifsIds.includes(notifId);
              const ms = getTimestampMs(profile.updated_at || profile.created_at) || (Date.now() - 3600000);

              if (isVerified) {
                empNotifs.push({
                  id: notifId,
                  title: 'Account Verified',
                  message: 'Your account is verified! You can now hire workers.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: true,
                  type: 'verification',
                });
              } else if (isRejected) {
                empNotifs.push({
                  id: notifId,
                  title: 'Verification Rejected',
                  message: `Reason: ${profile.rejection_reason}.`,
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead,
                  type: 'verification',
                });
              } else if (hasUploadedDocs) {
                empNotifs.push({
                  id: notifId,
                  title: 'Verification Pending',
                  message: 'Your documents are being reviewed.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead,
                  type: 'verification',
                });
              } else {
                empNotifs.push({
                  id: notifId,
                  title: 'Documents Required',
                  message: 'Not verified. Please upload required verification documents.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead,
                  type: 'verification',
                });
              }
            }
          } catch (err) {
            console.error('Error fetching verification status:', err);
          }

          try {
            const res = await api.get('/employer/applicants');
            if (res.data && res.data.status === 'success') {
              const applicants = res.data.applicants || [];
              applicants.forEach((app: any) => {
                const notifId = `app_${app.id}`;
                const isLocallyRead = readNotifsIds.includes(notifId);
                const ms = getTimestampMs(app.created_at || app.updated_at);

                empNotifs.push({
                  id: notifId,
                  title: 'New Applicant',
                  message: `${app.student?.student_name || 'A student'} applied for "${app.job?.title || 'Job'}".`,
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead || app.status !== 'pending',
                  type: 'application',
                  targetId: app.id,
                  applicationId: app.id,
                  jobId: app.job_id ?? app.job?.id,
                  senderId: app.student?.user_id,
                  rawApplication: app,
                });
              });
            }
          } catch (apiError) {
            console.error('Error fetching applicants:', apiError);
          }

          if (isMounted) {
            setApiNotifications(empNotifs);
          }
        }

        // 2. Real-time Listener para sa Firestore app_notifications
        try {
          const notifsRef = collection(db, APP_NOTIFICATIONS_COLLECTION);
          const q = query(notifsRef, where('recipient_id', '==', String(currentUserId)));

          unsubscribeAppNotifs = onSnapshot(
            q,
            (snapshot) => {
              if (!isMounted) return;
              const notifs: any[] = [];
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const ms = getTimestampMs(data.created_at);
                const notifId = `firestore_${docSnap.id}`;
                const isLocallyRead = readNotificationIds.current.has(notifId) || data.read === true;

                notifs.push({
                  id: notifId,
                  title: data.title || 'Notification',
                  message: data.body || '',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: isLocallyRead,
                  type: data.type || 'application_status',
                  targetId: data.target_id,
                  applicationId: data.application_id,
                  jobId: data.job_id,
                  senderId: data.sender_id,
                  firestoreDocId: docSnap.id,
                });
              });
              setLiveAppNotifications(notifs);
            },
            (error) => {
              console.error('Error in Firestore app_notifications listener:', error);
            }
          );
        } catch (fnErr) {
          console.error('Error setting up Firestore notifications listener:', fnErr);
        }

        // 3. Real-time Listener para sa Chats
        try {
          const myId = String(currentUserId);
          unsubscribeChats = onSnapshot(
            collection(db, CHATS_COLLECTION),
            async (snapshot) => {
              if (!isMounted) return;

              const matchedDocs = snapshot.docs.filter((docSnap) => {
                const raw = docSnap.data();
                const sId = String(raw.sender_id ?? raw.student_user_id ?? raw.studentId ?? '');
                const rId = String(raw.receiver_id ?? raw.owner_user_id ?? raw.ownerId ?? '');
                const pIds: string[] = Array.isArray(raw.participant_ids)
                  ? raw.participant_ids.map(String)
                  : [];
                return pIds.includes(myId) || sId === myId || rId === myId;
              });

              const chatListPromises = matchedDocs.map(async (docSnap) => {
                const raw = docSnap.data();
                const chat = normalizeChatFields(raw, docSnap.id);
                const other = getOtherParticipant(chat, myId);
                const isUnread = isChatUnreadForUser(chat, myId, userRole as any);

                let lastIncomingText = '';
                let lastIncomingMs = 0;
                let hasIncomingMessage = false;

                // 1. Kung ang huling nag-send sa chat ay ang kausap (hindi ang current user)
                if (chat.last_sender_id && String(chat.last_sender_id) !== myId) {
                  lastIncomingText = chat.last_message;
                  lastIncomingMs = getTimestampMs(chat.last_message_at);
                  hasIncomingMessage = Boolean(lastIncomingText);
                  if (hasIncomingMessage) {
                    incomingMsgCache.set(docSnap.id, { text: lastIncomingText, ms: lastIncomingMs });
                  }
                } else if (raw[`last_message_for_${myId}`]) {
                  // 2. Kung naka-cache na sa chat document ang huling mensahe para sa akin
                  lastIncomingText = String(raw[`last_message_for_${myId}`]);
                  lastIncomingMs = getTimestampMs(raw[`last_message_at_for_${myId}`]);
                  hasIncomingMessage = Boolean(lastIncomingText);
                } else if (incomingMsgCache.has(docSnap.id)) {
                  // 3. Kung nasa memory cache na
                  const cached = incomingMsgCache.get(docSnap.id)!;
                  lastIncomingText = cached.text;
                  lastIncomingMs = cached.ms;
                  hasIncomingMessage = Boolean(lastIncomingText);
                } else {
                  // 4. Kung ang kasalukuyang user ang huling nag-reply (tulad ng "MWHEHHEHE"),
                  // basahin sa messages subcollection ang pinakahuling mensahe na nanggaling sa kausap (sender_id !== myId).
                  try {
                    const messagesRef = collection(db, CHATS_COLLECTION, docSnap.id, 'messages');
                    const q = query(messagesRef, orderBy('created_at', 'desc'), limit(15));
                    const msgSnap = await getDocs(q);

                    const otherMsgDoc = msgSnap.docs.find((mDoc) => {
                      const mData = mDoc.data();
                      const sId = String(mData.sender_id || '');
                      return sId && sId !== myId;
                    });

                    if (otherMsgDoc) {
                      const mData = otherMsgDoc.data();
                      lastIncomingText = String(mData.text || '');
                      lastIncomingMs = getTimestampMs(mData.created_at);
                      hasIncomingMessage = Boolean(lastIncomingText);
                      incomingMsgCache.set(docSnap.id, { text: lastIncomingText, ms: lastIncomingMs });

                      // I-cache sa document para sa susunod na reads
                      setDoc(
                        doc(db, CHATS_COLLECTION, docSnap.id),
                        {
                          [`last_message_for_${myId}`]: lastIncomingText,
                          [`last_message_at_for_${myId}`]: mData.created_at || null,
                        },
                        { merge: true }
                      ).catch(() => {});
                    }
                  } catch (err) {
                    console.error('Error fetching incoming message for chat:', docSnap.id, err);
                  }
                }

                // Kung walang nahanap na mensahe mula sa kausap, huwag mag-display ng notification
                if (!hasIncomingMessage || !lastIncomingText.trim()) {
                  return null;
                }

                return {
                  id: `chat_${docSnap.id}`,
                  title: other.name || 'DiskarTech User',
                  message: `"${lastIncomingText.trim()}"`,
                  timestamp: formatNotificationTime(lastIncomingMs),
                  timestampMs: lastIncomingMs,
                  read: !isUnread,
                  type: 'message',
                  targetId: docSnap.id,
                };
              });

              const resolvedList = await Promise.all(chatListPromises);
              const validChatList = resolvedList.filter(
                (item): item is NonNullable<typeof item> => item !== null
              );

              if (isMounted) {
                setChatNotifications(validChatList);
                setLoading(false);
              }
            },
            (error) => {
              console.error('Error loading chat notifications:', error);
              if (isMounted) setLoading(false);
            }
          );
        } catch (chatErr) {
          console.error('Error setting up chat listener:', chatErr);
          if (isMounted) setLoading(false);
        }

      } catch (error) {
        console.error('Error loading notifications:', error);
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
      unsubscribeChats();
      unsubscribeAppNotifs();
    };
  }, [currentUserId, userRole]);

  const combinedNotifications = useMemo(
    () => mergeNotificationSources(apiNotifications, liveAppNotifications, chatNotifications),
    [apiNotifications, liveAppNotifications, chatNotifications]
  );

  // Filtered list base sa piniling tab
  const filteredList = useMemo(() => {
    if (activeTab === 'applications') {
      return combinedNotifications.filter(
        (n) => n.type === 'application' || n.type === 'application_status'
      );
    }
    if (activeTab === 'messages') {
      return combinedNotifications.filter((n) => n.type === 'message');
    }
    if (activeTab === 'updates') {
      return combinedNotifications.filter(
        (n) => n.type === 'verification' || n.type === 'general' || n.type === 'new_job'
      );
    }
    return combinedNotifications;
  }, [combinedNotifications, activeTab]);

  const unreadCount = combinedNotifications.filter((n) => !n.read).length;
  const appCount = combinedNotifications.filter((n) => n.type === 'application' || n.type === 'application_status').length;
  const msgCount = combinedNotifications.filter((n) => n.type === 'message').length;
  const updateCount = combinedNotifications.filter((n) => n.type === 'verification' || n.type === 'general' || n.type === 'new_job').length;

  const handleNotificationPress = async (notification: any) => {
    const idsToMark: string[] = notification.mergedIds || [notification.id];
    idsToMark.forEach((id) => readNotificationIds.current.add(id));
    try {
      const readNotifsString = await AsyncStorage.getItem('read_notifications');
      const readNotifsIds: string[] = readNotifsString ? JSON.parse(readNotifsString) : [];

      let changed = false;
      idsToMark.forEach((id) => {
        if (!readNotifsIds.includes(id)) {
          readNotifsIds.push(id);
          changed = true;
        }
      });

      if (changed) {
        await AsyncStorage.setItem('read_notifications', JSON.stringify(readNotifsIds));
      }
    } catch (e) {
      console.error('Error saving read notification status:', e);
    }

    setApiNotifications((prev) =>
      prev.map((n) => (idsToMark.includes(n.id) ? { ...n, read: true } : n))
    );
    setLiveAppNotifications((prev) =>
      prev.map((n) => (idsToMark.includes(n.id) ? { ...n, read: true } : n))
    );
    setChatNotifications((prev) =>
      prev.map((n) => (idsToMark.includes(n.id) ? { ...n, read: true } : n))
    );

    if (notification.type === 'message') {
      if (currentUserId) {
        await markChatAsRead(notification.targetId, String(currentUserId));
      }
      router.push(`/chat?id=${notification.targetId}` as any);
    } else if (notification.type === 'new_job') {
      if (notification.targetId) {
        router.push({
          pathname: '/students/job-details' as any,
          params: { id: String(notification.targetId) },
        });
      }
    } else if (notification.type === 'application' || notification.type === 'application_status') {
      if (userRole === 'student') {
        const rawApp = notification.rawApplication;
        const targetAppId = String(rawApp?.id || notification.targetId || '');

        router.push({
          pathname: '/students/application-details' as any,
          params: { applicationId: targetAppId },
        });
      } else {
        router.push(`/employer/applicant-details?applicationId=${notification.targetId}` as any);
      }
    } else if (notification.type === 'verification') {
      if (userRole === 'student') {
        router.push('/students/verification-status' as any);
      } else {
        const isHousehold = userRole === 'household';
        router.push(`/employer/verification-status?type=${isHousehold ? 'household' : 'business'}` as any);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const allIds: string[] = [];
      combinedNotifications.forEach((n) => {
        if (Array.isArray(n.mergedIds)) {
          allIds.push(...n.mergedIds);
        } else if (n.id) {
          allIds.push(n.id);
        }
      });
      allIds.forEach((id) => readNotificationIds.current.add(id));
      await AsyncStorage.setItem('read_notifications', JSON.stringify(Array.from(new Set(allIds))));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }

    setApiNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setLiveAppNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setChatNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filterTabs: { key: FilterTab; label: string; count: number; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[] = [
    { key: 'all', label: 'All', count: combinedNotifications.length, icon: 'notifications-none' },
    { key: 'applications', label: 'Applications', count: appCount, icon: 'assignment' },
    { key: 'messages', label: 'Messages', count: msgCount, icon: 'chat-bubble-outline' },
    { key: 'updates', label: 'Updates', count: updateCount, icon: 'info-outline' },
  ];
  const accentSurface = isDark ? colors.primary + '1F' : '#FEF2F2';

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center px-5 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-11 w-11 items-center justify-center"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ color: colors.text }} className="flex-1 text-xl font-bold">Notifications</Text>
        </View>
        <View className="mt-4 flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: unreadCount > 0 ? colors.accent : colors.textSecondary }} />
            <Text style={{ color: colors.textSecondary }} className="flex-1 text-xs">
              {loading ? 'Loading your updates...' : unreadCount > 0 ? unreadCount + ' unread notification' + (unreadCount === 1 ? '' : 's') : "You're all caught up"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={loading || unreadCount === 0}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            accessibilityState={{ disabled: loading || unreadCount === 0 }}
            className="min-h-11 flex-row items-center gap-1.5 rounded-xl px-3"
            style={{ backgroundColor: unreadCount > 0 ? accentSurface : 'transparent' }}
          >
            <MaterialIcons name="done-all" size={17} color={unreadCount > 0 ? colors.accent : colors.textSecondary} />
            <Text style={{ color: unreadCount > 0 ? colors.accent : colors.textSecondary }} className="text-xs font-semibold">Mark all read</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="w-full max-w-2xl self-center border-b" style={{ borderBottomColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-5 pb-4 pt-1">
          {filterTabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tab.label + ', ' + tab.count + ' notifications'}
                className="min-h-11 flex-row items-center gap-2 rounded-xl border px-3"
                style={{ backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }}
              >
                <MaterialIcons name={tab.icon} size={17} color={selected ? '#FFFFFF' : colors.textSecondary} />
                <Text className="text-xs font-semibold" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{tab.label}</Text>
                <View className="min-w-5 items-center rounded-md px-1.5 py-0.5" style={{ backgroundColor: selected ? 'rgba(255,255,255,0.18)' : colors.background }}>
                  <Text className="text-[10px] font-semibold" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{tab.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text className="text-xs" style={{ color: colors.textSecondary }}>Getting your notifications...</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={filteredList}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="w-full max-w-2xl self-center px-5 pt-5"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          ListHeaderComponent={filteredList.length > 0 ? (
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <Text style={{ color: colors.text }} className="text-sm font-semibold">Latest activity</Text>
              <View className="flex-row items-center gap-1">
                <MaterialIcons name="arrow-downward" size={13} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary }} className="text-[11px]">Newest first</Text>
              </View>
            </View>
          ) : null}
          ListEmptyComponent={
            <View className="mt-8 items-center rounded-3xl border px-6 py-10" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: accentSurface }}>
                <MaterialIcons name="notifications-none" size={30} color={colors.accent} />
              </View>
              <Text style={{ color: colors.text }} className="mt-5 text-center text-base font-semibold">
                {activeTab === 'all' ? 'No notifications yet' : 'No ' + activeTab + ' yet'}
              </Text>
              <Text style={{ color: colors.textSecondary }} className="mt-2 text-center text-xs leading-5">
                {userRole === 'student'
                  ? 'Job updates, interview invitations, and messages will appear here.'
                  : 'New applicants, account updates, and messages will appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => <NotificationCard notification={item} onPress={() => handleNotificationPress(item)} />}
        />
      )}
    </View>
  );
}
