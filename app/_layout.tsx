import '../global.css';

import { Colors } from '@/constants/colors';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  registerAndSyncPushToken,
  subscribeToIncomingChatNotifications,
  subscribeToAppNotifications,
} from '@/utils/notifications';
import { getLoggedInUserId } from '@/utils/chat';

export const unstable_settings = {
  initialRouteName: 'index',
};

const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: Colors.background },
  animation: Platform.OS === 'android' ? ('fade_from_bottom' as const) : ('slide_from_right' as const),
};

export default function RootLayout() {
  useEffect(() => {
    // 1. Humingi ng permiso sa phone at i-configure ang Android notification channel
    registerForPushNotificationsAsync();

    // 2. Kapag pinindot ng user ang pop-up notification banner, didiretso sa kaukulang screen
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      const chatId = data?.chatId ? String(data.chatId) : '';
      if (chatId) {
        router.push({ pathname: '/chat', params: { id: chatId } });
      } else if (data?.url) {
        router.push(data.url as any);
      }
    });

    // 3. Makinig sa mga bagong mensahe at application updates sa Firestore
    let unsubscribeChats: (() => void) | null = null;
    let unsubscribeApps: (() => void) | null = null;
    let isCancelled = false;

    const setupListeners = async () => {
      const uid = await getLoggedInUserId();
      if (!isCancelled && uid && uid !== 'unknown') {
        registerAndSyncPushToken(uid);
        if (!unsubscribeChats) {
          unsubscribeChats = subscribeToIncomingChatNotifications(uid);
        }
        if (!unsubscribeApps) {
          unsubscribeApps = subscribeToAppNotifications(uid);
        }
      }
    };

    setupListeners();

    // Regular na tignan kung nag-login na ang user kapag kakabukas pa lang
    const interval = setInterval(() => {
      if (!unsubscribeChats || !unsubscribeApps) {
        setupListeners();
      }
    }, 3000);

    return () => {
      isCancelled = true;
      responseSub.remove();
      clearInterval(interval);
      if (unsubscribeChats) {
        unsubscribeChats();
      }
      if (unsubscribeApps) {
        unsubscribeApps();
      }
    };
  }, []);
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={stackScreenOptions}>
        {/* Splash & onboarding */}
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />

        {/* Auth flow */}
        <Stack.Screen name="auth/welcome" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/student-register" />
        <Stack.Screen name="auth/employer-register" />
        <Stack.Screen name="auth/household-register" />

        {/* Student app — tabs group + stack screens */}
        <Stack.Screen name="students/(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="students/job-details" />
        <Stack.Screen name="students/apply-job" />
        <Stack.Screen name="students/schedule" />
        <Stack.Screen name="students/earnings" />
        <Stack.Screen name="students/reviews" />

        {/* Employer app — tabs group + stack screens */}
        <Stack.Screen name="employer/(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="employer/job-posting" />
        <Stack.Screen name="employer/applicant-details" />
        <Stack.Screen name="employer/verification-status" />
        
        {/* Shared screens */}
        <Stack.Screen name="chat" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}