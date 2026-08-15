import '../global.css';

import { Colors } from '@/constants/colors';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform } from 'react-native';

export const unstable_settings = {
  initialRouteName: 'index',
};

const stackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: Colors.background },
  animation: Platform.OS === 'android' ? ('fade_from_bottom' as const) : ('slide_from_right' as const),
};

export default function RootLayout() {
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