import api from '@/api/axios';
import NotificationCard from '@/components/ui/NotificationCard';
import NotificationModal from '@/components/ui/modals/NotificationModal';
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
import { applyNotificationPreferences, getNotificationActionSources, saveNotificationAction } from '@/utils/notificationPreferences';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useToast } from '@/hooks/useToast';
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
import { ActivityIndicator, BackHandler, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
  const { colors } = useDarkMode();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [apiNotifications, setApiNotifications] = useState<any[]>([]);
  const [liveAppNotifications, setLiveAppNotifications] = useState<any[]>([]);
  const [chatNotifications, setChatNotifications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { preferences, ready: preferencesReady, error: preferencesError } = useNotificationPreferences(currentUserId);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [working, setWorking] = useState(false);
  const actionInProgress = useRef(false);
  const [deleteTargets, setDeleteTargets] = useState<any[] | null>(null);

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  useEffect(() => {
    if (!selectionMode) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!actionInProgress.current) {
        setSelectionMode(false);
        setSelectedIds(new Set());
      }
      return true;
    });
    return () => subscription.remove();
  }, [selectionMode]);

  useEffect(() => {
    if (preferencesError) showToast({ type: 'error', message: 'Could not load your saved notification settings. Please reopen this screen.' });
  }, [preferencesError, showToast]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          if (!user.id) { setLoading(false); return; }
          setCurrentUserId(user.id?.toString());
          const role = user.role || (user.student_school_name ? 'student' : user.household_name ? 'household' : 'employer');
          setUserRole(role);
        } else setLoading(false);
      } catch (e) {
        console.error('Error fetching user data:', e);
        setLoading(false);
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
              const ms = getTimestampMs(profile.updated_at || profile.created_at);

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
                  read: false,
                  type: 'verification',
                });
              } else if (hasUploadedDocs) {
                studentNotifs.push({
                  id: notifId,
                  title: 'Verification Under Review',
                  message: 'Your student documents are currently being reviewed by Admin/AI.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: false,
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
                  read: app.status === 'pending',
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
              const ms = getTimestampMs(profile.updated_at || profile.created_at);

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
                  read: false,
                  type: 'verification',
                });
              } else if (hasUploadedDocs) {
                empNotifs.push({
                  id: notifId,
                  title: 'Verification Pending',
                  message: 'Your documents are being reviewed.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: false,
                  type: 'verification',
                });
              } else {
                empNotifs.push({
                  id: notifId,
                  title: 'Documents Required',
                  message: 'Not verified. Please upload required verification documents.',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: false,
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
                const ms = getTimestampMs(app.created_at || app.updated_at);

                empNotifs.push({
                  id: notifId,
                  title: 'New Applicant',
                  message: `${app.student?.student_name || 'A student'} applied for "${app.job?.title || 'Job'}".`,
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: app.status !== 'pending',
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

                notifs.push({
                  id: notifId,
                  title: data.title || 'Notification',
                  message: data.body || '',
                  timestamp: formatNotificationTime(ms),
                  timestampMs: ms,
                  read: data.read === true,
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
    () => mergeNotificationSources(
      applyNotificationPreferences(apiNotifications, preferences),
      applyNotificationPreferences(liveAppNotifications, preferences),
      applyNotificationPreferences(chatNotifications, preferences),
    ),
    [apiNotifications, liveAppNotifications, chatNotifications, preferences]
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
    if (actionInProgress.current || !currentUserId) return;
    if (selectionMode) {
      toggleSelection(notification.id);
      return;
    }
    try {
      await saveNotificationAction(currentUserId, 'read', getActionSources([notification]));
    } catch (e) {
      console.error('Error saving read notification status:', e);
      showToast({ type: 'error', message: 'Could not mark the notification as read. Please try again.' });
    }

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
    if (!currentUserId || actionInProgress.current || preferencesError) return;
    actionInProgress.current = true;
    setWorking(true);
    try {
      await saveNotificationAction(currentUserId, 'read', getActionSources(combinedNotifications));
      showToast({ type: 'success', message: 'All notifications marked as read.' });
    } catch (e) {
      console.error('Error marking all as read:', e);
      showToast({ type: 'error', message: 'Could not mark notifications as read. Please try again.' });
    } finally {
      actionInProgress.current = false;
      setWorking(false);
    }
  };

  const getActionSources = (items: any[]) => getNotificationActionSources(items, [
    ...apiNotifications, ...liveAppNotifications, ...chatNotifications,
  ]);

  const toggleSelection = (id: string) => {
    if (actionInProgress.current) return;
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedNotifications = combinedNotifications.filter(item => selectedIds.has(item.id));
  const selectedCount = selectedNotifications.length;
  const allVisibleSelected = filteredList.length > 0 && filteredList.every(item => selectedIds.has(item.id));
  const screenLoading = loading || (!!currentUserId && !preferencesReady);
  const actionsDisabled = screenLoading || working || !!preferencesError;

  const handleDeleteSelected = async () => {
    if (!currentUserId || !deleteTargets || actionInProgress.current || preferencesError) return;
    const targets = deleteTargets;
    setDeleteTargets(null);
    actionInProgress.current = true;
    setWorking(true);
    try {
      await saveNotificationAction(currentUserId, 'deleted', targets);
      exitSelection();
      showToast({ type: 'success', title: 'Notifications deleted', message: 'Selected notifications have been removed.' });
    } catch (error) {
      console.error('Error deleting notifications:', error);
      showToast({ type: 'error', message: 'Could not delete notifications. Your selection has been kept. Please try again.' });
    } finally {
      actionInProgress.current = false;
      setWorking(false);
    }
  };

  const filterTabs: { key: FilterTab; label: string; count: number; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[] = [
    { key: 'all', label: 'All', count: combinedNotifications.length, icon: 'notifications-none' },
    { key: 'applications', label: 'Applications', count: appCount, icon: 'assignment' },
    { key: 'messages', label: 'Messages', count: msgCount, icon: 'chat-bubble-outline' },
    { key: 'updates', label: 'Updates', count: updateCount, icon: 'info-outline' },
  ];

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center px-5 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => { if (!working) { if (selectionMode) exitSelection(); else router.back(); } }}
            disabled={working}
            accessibilityRole="button"
            accessibilityLabel={selectionMode ? 'Cancel selection' : 'Go back'}
            className="h-11 w-11 items-center justify-center"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ color: colors.text }} className="flex-1 text-xl font-bold">{selectionMode ? `${selectedCount} selected` : 'Notifications'}</Text>
          {combinedNotifications.length > 0 && <TouchableOpacity
            onPress={() => {
              if (!selectionMode) { setSelectionMode(true); return; }
              setSelectedIds(new Set(allVisibleSelected ? [] : filteredList.map(item => item.id)));
            }}
            disabled={actionsDisabled}
            accessibilityRole="button"
            accessibilityLabel={selectionMode ? allVisibleSelected ? 'Deselect all notifications in this filter' : 'Select all notifications in this filter' : 'Select notifications'}
            className="min-h-11 items-center justify-center px-2"
          >
            <Text className="text-xs font-semibold" style={{ color: actionsDisabled ? colors.textSecondary : colors.accent }}>{selectionMode ? allVisibleSelected ? 'Deselect all' : 'Select all' : 'Select'}</Text>
          </TouchableOpacity>}
        </View>
        <View className="mt-4 flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: unreadCount > 0 ? colors.accent : colors.textSecondary }} />
            <Text style={{ color: colors.textSecondary }} className="flex-1 text-xs">
              {selectionMode ? 'Tap notifications to select.' : screenLoading ? 'Loading your updates...' : unreadCount > 0 ? unreadCount + ' unread notification' + (unreadCount === 1 ? '' : 's') : "You're all caught up"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (selectionMode) setDeleteTargets(getActionSources(selectedNotifications));
              else void handleMarkAllRead();
            }}
            disabled={actionsDisabled || (selectionMode ? selectedCount === 0 : unreadCount === 0)}
            accessibilityRole="button"
            accessibilityLabel={selectionMode ? `Delete ${selectedCount} selected notifications` : 'Mark all notifications as read'}
            accessibilityState={{ disabled: actionsDisabled || (selectionMode ? selectedCount === 0 : unreadCount === 0), busy: working }}
            className="min-h-11 flex-row items-center gap-1.5 rounded-xl px-3"
          >
            {working ? <ActivityIndicator size="small" color={colors.accent} /> : <MaterialIcons name={selectionMode ? 'delete-outline' : 'done-all'} size={19} color={actionsDisabled || (selectionMode ? selectedCount === 0 : unreadCount === 0) ? colors.textSecondary : colors.accent} />}
            <Text style={{ color: actionsDisabled || (selectionMode ? selectedCount === 0 : unreadCount === 0) ? colors.textSecondary : colors.accent }} className="text-xs font-semibold">{selectionMode ? 'Delete' : 'Mark all read'}</Text>
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
                onPress={() => { setActiveTab(tab.key); exitSelection(); }}
                disabled={working}
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

      {screenLoading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text className="text-xs" style={{ color: colors.textSecondary }}>Getting your notifications...</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={filteredList}
          extraData={{ selectionMode, selectedIds, working }}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="w-full max-w-2xl self-center px-5 pt-5"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          ListHeaderComponent={filteredList.length > 0 ? (
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text style={{ color: colors.text }} className="text-sm font-semibold">Latest activity</Text>
                {!selectionMode && <Text className="mt-1 text-[11px]" style={{ color: colors.textSecondary }}>Long press to select notifications</Text>}
              </View>
              <View className="flex-row items-center gap-1">
                <MaterialIcons name="arrow-downward" size={13} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary }} className="text-[11px]">Newest first</Text>
              </View>
            </View>
          ) : null}
          ListEmptyComponent={
            <View className="mt-8 items-center rounded-3xl border px-6 py-10" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="h-16 w-16 items-center justify-center">
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
          renderItem={({ item }) => <NotificationCard
            notification={item}
            selectionMode={selectionMode}
            selected={selectedIds.has(item.id)}
            disabled={working}
            onPress={() => { void handleNotificationPress(item); }}
            onLongPress={() => {
              if (working) return;
              setSelectionMode(true);
              setSelectedIds(previous => new Set(previous).add(item.id));
            }}
          />}
        />
      )}
      <NotificationModal
        visible={deleteTargets !== null}
        title="Delete selected notifications?"
        message="Remove these notifications from this device? Your applications and conversations will stay available."
        iconName="delete-outline"
        primaryButtonText="Delete"
        onPrimaryPress={() => { void handleDeleteSelected(); }}
        secondaryButtonText="Cancel"
        onSecondaryPress={() => setDeleteTargets(null)}
        onRequestClose={() => setDeleteTargets(null)}
        onBackdropPress={() => setDeleteTargets(null)}
      />
    </View>
  );
}
