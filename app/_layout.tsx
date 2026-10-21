import '../global.css';

import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Disable Reanimated strict-mode warnings for reading/writing shared values during component render
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import { Colors } from '@/constants/colors';
import StartupConsentGate, { useStartupConsent } from '@/components/common/StartupConsentGate';
import { getLoggedInUserId } from '@/utils/chat';
import {
  registerAndSyncPushToken,
  registerForPushNotificationsAsync,
  subscribeToAppNotifications,
  subscribeToIncomingChatNotifications,
} from '@/utils/notifications';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkModeProvider, useDarkMode } from '@/hooks/useDarkMode';

// Prevent splash screen auto-hiding until custom fonts are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

// Global default font family for all Text and TextInput components in the entire app
// @ts-ignore
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
// @ts-ignore
const defaultTextStyle = (Text as any).defaultProps.style;
// @ts-ignore
(Text as any).defaultProps.style = [{ fontFamily: 'Poppins' }, defaultTextStyle];

// @ts-ignore
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
// @ts-ignore
const defaultInputStyle = (TextInput as any).defaultProps.style;
// @ts-ignore
(TextInput as any).defaultProps.style = [{ fontFamily: 'Poppins' }, defaultInputStyle];

export const unstable_settings = {
  initialRouteName: 'index',
};

const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: Colors.background },
  animation: Platform.OS === 'android' ? ('fade_from_bottom' as const) : ('slide_from_right' as const),
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
    'Poppins': Poppins_400Regular,
    'Poppins-Light': Poppins_300Light,
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-ExtraBold': Poppins_800ExtraBold,
    'Poppins-Black': Poppins_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <DarkModeProvider>
      <RootLayoutNav />
    </DarkModeProvider>
  );
}

function AppNotificationListeners() {
  const accepted = useStartupConsent();

  useEffect(() => {
    if (!accepted) return;
    // Ask for OS notification permission only after the startup agreement.
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
    let activeUserId: string | null = null;
    let unsubscribeChats: (() => void) | null = null;
    let unsubscribeApps: (() => void) | null = null;
    let isCancelled = false;

    const syncUserAndListeners = async () => {
      if (isCancelled) return;
      const uid = await getLoggedInUserId();

      // Kapag nag-logout o walang naka-login
      if (!uid || uid === 'unknown') {
        if (activeUserId !== null) {
          activeUserId = null;
          if (unsubscribeChats) { unsubscribeChats(); unsubscribeChats = null; }
          if (unsubscribeApps) { unsubscribeApps(); unsubscribeApps = null; }
        }
        return;
      }

      // Kapag may bagong nag-login o lumipat ng account
      if (uid !== activeUserId) {
        activeUserId = uid;

        if (unsubscribeChats) { unsubscribeChats(); unsubscribeChats = null; }
        if (unsubscribeApps) { unsubscribeApps(); unsubscribeApps = null; }

        await registerAndSyncPushToken(uid);
        if (!isCancelled) {
          unsubscribeChats = subscribeToIncomingChatNotifications(uid);
          unsubscribeApps = subscribeToAppNotifications(uid);
        }
      }
    };

    syncUserAndListeners();
    const interval = setInterval(syncUserAndListeners, 2000);

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
  }, [accepted]);

  return null;
}

function RootLayoutNav() {
  const { isDark } = useDarkMode();

  return (
    <SafeAreaProvider>
      <StartupConsentGate>
      <AppNotificationListeners />
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
        <Stack.Screen name="students/accepted-job" />
        <Stack.Screen name="students/application-details" />
        <Stack.Screen name="students/verification-status" />
        <Stack.Screen name="students/report" />

        {/* Employer app — tabs group + stack screens */}
        <Stack.Screen name="employer/(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="employer/job-posting" />
        <Stack.Screen name="employer/applicant-details" />
        <Stack.Screen name="employer/verification-status" />

        {/* Shared screens */}
        <Stack.Screen name="chat" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="online-interview-call" />
        <Stack.Screen name="terms-and-conditions" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="cookie-policy" />
      <Stack.Screen name="delete-account" />
        <Stack.Screen name="help-center" />
        <Stack.Screen name="about-diskartech" />
      </Stack>
      </StartupConsentGate>
    </SafeAreaProvider>
  );
}
