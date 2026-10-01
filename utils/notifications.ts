import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';

export const CHATS_COLLECTION = 'chats';
export const NOTIFICATION_CHANNEL_ID = 'diskartech-default';
export const APP_NOTIFICATIONS_COLLECTION = 'app_notifications';

// Subaybayan ang active conversation ID
let currentActiveChatId: string | null = null;

export function setActiveChatScreen(chatId: string | null) {
  currentActiveChatId = chatId;
}

// 1. I-set ang foreground notification handler (ayon sa Expo SDK 54 guidelines)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification?.request?.content?.data as Record<string, any> | undefined;
    const incomingChatId = data?.chatId ? String(data.chatId) : null;

    // Kung kasalukuyang binabasa ng user ang chat na ito, huwag mag-pop up ng banner
    if (incomingChatId && currentActiveChatId && incomingChatId === currentActiveChatId) {
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

// Cache para maiwasan ang duplicate notifications kapag parehong nag-trigger ang remote push at local listener
const recentNotificationsCache = new Map<string, number>();

export function shouldShowNotification(key: string, cooldownMs: number = 8000): boolean {
  const now = Date.now();
  for (const [k, time] of recentNotificationsCache.entries()) {
    if (now - time > 30000) {
      recentNotificationsCache.delete(k);
    }
  }

  const lastTime = recentNotificationsCache.get(key);
  if (lastTime && now - lastTime < cooldownMs) {
    return false;
  }

  recentNotificationsCache.set(key, now);
  return true;
}

// Makinig sa mga pumasok na remote push para i-marka sa cache na nai-display na
Notifications.addNotificationReceivedListener((notification) => {
  const content = notification.request.content;
  const data = content.data as Record<string, any> | undefined;
  const key = data?.chatId
    ? `chat_${data.chatId}_${content.body}`
    : `notif_${content.title}_${content.body}`;
  recentNotificationsCache.set(key, Date.now());
});

/**
 * Humihingi ng pahintulot sa user para sa notifications, nag-aayos ng Android channel,
 * at kinukuha ang Expo Push Token para makatanggap ng push kahit nakasara ang app.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'DiskarTech Alerts & Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D32F2F',
        sound: 'default',
        showBadge: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        'b686c1c8-e796-4d0c-9bb4-87fa94802a3e';

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      if (token) {
        await AsyncStorage.setItem('expo_push_token', token);
      }
      return token;
    } catch (tokenErr) {
      console.warn('Could not fetch Expo Push Token (may need physical device or custom dev build):', tokenErr);
      return 'local_granted';
    }
  } catch (error) {
    console.error('Error registering for notifications:', error);
    return null;
  }
}

/**
 * Diagnostic tool para mabilisang malaman kung nakakakuha ng valid push token ang device.
 */
export async function getPushDiagnosticInfo(): Promise<{
  status: 'ok' | 'error';
  token: string | null;
  error?: string;
  hasPermission: boolean;
}> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { status: 'error', token: null, error: 'Permission not granted on this phone. Please enable in Settings.', hasPermission: false };
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      'b686c1c8-e796-4d0c-9bb4-87fa94802a3e';

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      return { status: 'ok', token: tokenData.data, hasPermission: true };
    } catch (err: any) {
      return { status: 'error', token: null, error: err?.message || String(err), hasPermission: true };
    }
  } catch (e: any) {
    return { status: 'error', token: null, error: e?.message || String(e), hasPermission: false };
  }
}

/**
 * I-save ang Expo Push Token ng kasalukuyang user sa Firestore.
 * Awtomatiko ring tatanggalin ang token na ito sa kahit anong lumang user na dating nag-login sa device na ito.
 */
export async function registerAndSyncPushToken(userId: string | number): Promise<void> {
  try {
    const id = String(userId).trim();
    if (!id || id === 'unknown') return;

    const token = await registerForPushNotificationsAsync();
    if (!token || !token.startsWith('ExponentPushToken')) return;

    try {
      // 1. I-unlink ang device token na ito sa kahit sinong ibang user na dating gumamit ng phone na ito
      const q = query(collection(db, 'user_push_tokens'), where('push_token', '==', token));
      const oldTokensSnap = await getDocs(q);
      for (const oldDoc of oldTokensSnap.docs) {
        if (oldDoc.id !== id) {
          await deleteDoc(oldDoc.ref);
        }
      }

      // 2. I-save sa kasalukuyang user
      await setDoc(
        doc(db, 'user_push_tokens', id),
        {
          user_id: id,
          push_token: token,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (fsErr) {
      console.warn('[PushToken] Notice: Ensure user_push_tokens is allowed in Firestore rules:', fsErr);
    }
  } catch (err) {
    console.error('Error syncing push token:', err);
  }
}

/**
 * Alisin ang push token kapag nag-logout para hindi makatanggap ng notification ng ibang tao.
 */
export async function clearPushToken(userId: string | number): Promise<void> {
  try {
    const id = String(userId).trim();
    if (!id || id === 'unknown') return;
    await deleteDoc(doc(db, 'user_push_tokens', id));
  } catch (e) {
    console.warn('Error clearing push token on logout:', e);
  }
}

/**
 * Kunin ang push token ng recipient mula sa Firestore.
 */
export async function getRecipientPushToken(userId: string | number): Promise<string | null> {
  try {
    const id = String(userId).trim();
    if (!id || id === 'unknown') return null;

    const snap = await getDoc(doc(db, 'user_push_tokens', id));
    if (snap.exists()) {
      return snap.data()?.push_token || null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Magpadala ng tunay na Cloud Remote Push Notification gamit ang Expo Push Gateway API.
 * Ito ang gumagana KAHIT NAKASARA / KILLED ANG APP ng tatanggap!
 */
export async function sendRemotePushNotification(params: {
  toToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<boolean> {
  try {
    const { toToken, title, body, data } = params;
    if (!toToken || !toToken.startsWith('ExponentPushToken')) {
      return false;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: toToken,
        title,
        body,
        sound: 'default',
        channelId: NOTIFICATION_CHANNEL_ID,
        data: data || {},
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending remote push notification via Expo:', error);
    return false;
  }
}

/**
 * Mag-trigger ng agarang pop-up banner notification sa device.
 */
export async function sendLocalNotification(params: {
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    // Check if user disabled notifications in Settings
    const pref = await AsyncStorage.getItem('notifications_enabled');
    if (pref === 'false') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data || {},
        sound: 'default',
      },
      trigger: {
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
}

/**
 * Magpadala ng quick test notification (pwedeng tawagin sa Settings).
 */
export async function sendTestNotification(): Promise<void> {
  const granted = await registerForPushNotificationsAsync();
  if (!granted) {
    throw new Error('Notification permission not granted');
  }

  await sendLocalNotification({
    title: 'DiskarTech Alert',
    body: 'Your push and live banner notifications are working.',
    data: { test: true },
  });
}

/**
 * Mag-schedule ng test notification pagkalipas ng 10 seconds.
 * Tamang-tama para may oras ang user na i-minimize o i-close nang buo ang app!
 */
export async function scheduleDelayedSimulationNotification(seconds: number = 10): Promise<void> {
  const granted = await registerForPushNotificationsAsync();
  if (!granted) {
    throw new Error('Notification permission not granted');
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'DiskarTech Alert',
      body: 'This notification arrived while your app was closed or in background!',
      data: { test: true },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}

/**
 * Magpadala ng tunay na Cloud Remote Push Notification sa sariling phone
 * pagkalipas ng ilang segundo para masubukan nang sarado ang app.
 */
export async function sendTestCloudPushNotification(delaySeconds: number = 5): Promise<void> {
  const token = await registerForPushNotificationsAsync();
  if (!token || !token.startsWith('ExponentPushToken')) {
    await scheduleDelayedSimulationNotification(delaySeconds);
    return;
  }

  setTimeout(async () => {
    await sendRemotePushNotification({
      toToken: token,
      title: 'DiskarTech Cloud Push',
      body: 'Remote push notification delivered even when the app was closed!',
      data: { test: true },
    });
  }, delaySeconds * 1000);
}



/**
 * Real-time listener para sa mga pumapasok na chat messages sa Firestore.
 * Kapag may ibang nag-message, magpa-pop up ang notification banner.
 */
export function subscribeToIncomingChatNotifications(
  currentUserId: string,
  onNotificationTriggered?: (chatId: string) => void
): Unsubscribe {
  const myId = String(currentUserId).trim();
  if (!myId || myId === 'unknown') {
    return () => {};
  }

  let isFirstLoad = true;
  const lastSeenMessagePerChat: Record<string, string> = {};

  const chatsRef = collection(db, CHATS_COLLECTION);
  const unsubscribe = onSnapshot(
    chatsRef,
    (snapshot) => {
      // Sa initial load, i-record ang kasalukuyang last_message para hindi ma-spam sa pagbukas
      if (isFirstLoad) {
        snapshot.docs.forEach((docSnap) => {
          const raw = docSnap.data();
          lastSeenMessagePerChat[docSnap.id] = String(raw.last_message || '').trim();
        });
        isFirstLoad = false;
        return;
      }

      // Kapag may bagong update sa Firestore
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docSnap = change.doc;
          const raw = docSnap.data();
          const chatId = docSnap.id;

          const pIds: string[] = Array.isArray(raw.participant_ids)
            ? raw.participant_ids.map(String)
            : [String(raw.sender_id || ''), String(raw.receiver_id || '')];

          // Kung kabilang si current user sa conversation na ito
          if (!pIds.includes(myId)) return;

          const lastSenderId = String(raw.last_sender_id || raw.sender_id || '');
          // Kung ako mismo ang nagpadala, huwag mag-notif sa sarili ko
          if (lastSenderId === myId) return;

          const lastMessage = String(raw.last_message || '').trim();
          if (!lastMessage) return;

          // Kung na-notif na itong eksaktong mensahe, i-skip para walang duplicate
          if (lastSeenMessagePerChat[chatId] === lastMessage) return;
          lastSeenMessagePerChat[chatId] = lastMessage;

          // I-resolve ang pangalan ng nagpadala
          const isSender = String(raw.sender_id) === myId;
          const senderName =
            (isSender ? raw.receiver_name : raw.sender_name) ||
            raw.owner_name ||
            raw.student_name ||
            'DiskarTech User';

          if (onNotificationTriggered) {
            onNotificationTriggered(chatId);
          }
        }
      });
    },
    (err) => {
      console.error('[Notifications] Error listening to chat notifications:', err);
    }
  );

  return unsubscribe;
}

export interface SendAppNotificationParams {
  recipientId: string | number;
  senderId?: string | number;
  senderName?: string;
  title: string;
  body: string;
  type: 'application' | 'application_status' | 'general';
  targetId?: string | number;
}

/**
 * Magpadala ng application o status notification sa Firestore.
 */
export async function sendAppNotification(params: SendAppNotificationParams): Promise<void> {
  try {
    const recipientId = String(params.recipientId).trim();
    if (!recipientId || recipientId === 'unknown') return;

    await addDoc(collection(db, APP_NOTIFICATIONS_COLLECTION), {
      recipient_id: recipientId,
      sender_id: params.senderId ? String(params.senderId) : null,
      sender_name: params.senderName || 'DiskarTech',
      title: params.title,
      body: params.body,
      type: params.type,
      target_id: params.targetId != null ? String(params.targetId) : null,
      created_at: serverTimestamp(),
      read: false,
    });

    // Remote Push Notification via Expo Gateway (gumagana kahit patay/sarado ang app ng recipient)
    try {
      const recipientToken = await getRecipientPushToken(recipientId);
      if (recipientToken) {
        await sendRemotePushNotification({
          toToken: recipientToken,
          title: params.title,
          body: params.body,
          data: {
            type: params.type,
            targetId: params.targetId,
            url: '/notifications',
          },
        });
      }
    } catch (pushErr) {
      console.warn('Error sending remote push notification for app notification:', pushErr);
    }
  } catch (error) {
    console.error('Error sending app notification:', error);
  }
}

/**
 * Real-time listener para sa mga notifications tungkol sa application submission at status updates.
 */
export function subscribeToAppNotifications(
  currentUserId: string,
  onNotificationTriggered?: (notif: any) => void
): Unsubscribe {
  const myId = String(currentUserId).trim();
  if (!myId || myId === 'unknown') {
    return () => {};
  }

  let isFirstLoad = true;
  const notifsRef = collection(db, APP_NOTIFICATIONS_COLLECTION);
  const q = query(notifsRef, where('recipient_id', '==', myId));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (isFirstLoad) {
        isFirstLoad = false;
        return;
      }

      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const raw = change.doc.data();
          if (onNotificationTriggered) {
            onNotificationTriggered(raw);
          }
        }
      });
    },
    (err) => {
      console.error('Error listening to app notifications:', err);
    }
  );

  return unsubscribe;
}

