import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { redirectUserByRole } from '@/utils/authNavigation';

export default function WelcomeScreen() {
  const { isDark, colors } = useDarkMode();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        if (token && storedUser) {
          const user = JSON.parse(storedUser);
          const role =
            user.role ||
            (user.student_school_name
              ? 'student'
              : user.household_name
                ? 'household'
                : 'employer');
          redirectUserByRole(role);
        }
      } catch {
        /* ignore */
      }
    };
    checkAuth();
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: '#991B1B' }}>
      <SafeStatusBar backgroundColor="#B91C1C" style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ backgroundColor: '#991B1B' }}
        bounces={false}
      >
        {/* Red Hero Header */}
        <LinearGradient
          colors={['#DC2626', '#B91C1C', '#991B1B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 360,
            justifyContent: 'center',
          }}
          className={`px-6 items-center ${Platform.OS === 'ios' ? 'pt-16 pb-16' : 'pt-14 pb-16'
            }`}
        >
          {/* Subtle Ambient Light Orbs */}
          <View className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10" />
          <View className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-black/15" />

          {/* App Logo Squircle with Crisp White Border */}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: '#B91C1C',
              borderWidth: 2.5,
              borderColor: '#DC2626',
              marginBottom: 14,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Image
              source={require('../../assets/images/icon.png')}
              style={{ width: 88, height: 88, borderRadius: 24 }}
              resizeMode="cover"
            />
          </View>

          {/* Brand Name */}
          <Text
            className="text-[28px] text-center"
            style={{ color: '#FFFFFF', fontFamily: 'Poppins-Bold', letterSpacing: -0.8, lineHeight: 36 }}
          >
            DiskarTech
          </Text>

          {/* Subtitle */}
          <Text
            className="text-base mt-1 text-center"
            style={{ color: 'rgba(255, 255, 255, 0.95)', fontFamily: 'Poppins-Regular', lineHeight: 24 }}
          >
            Smart Jobs for Working Students
          </Text>

        </LinearGradient>

        {/* Action Center - Dark Curved Sheet with Bold Top Border Radius Over Red */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            borderTopLeftRadius: 40,
            borderTopRightRadius: 40,
            paddingTop: 44,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: isDark ? 0.5 : 0.18,
            shadowRadius: 18,
            elevation: 16,
          }}
          className="px-6 pb-8 justify-between"
        >
          <View>
            {/* Header */}
            <View className="mb-6 items-center">
              <Text className="text-2xl font-bold text-center" style={{ color: colors.text }}>
                Get Started
              </Text>
              <Text className="text-base text-center mt-1.5" style={{ color: colors.textSecondary }}>
                Find student-friendly work or hire local talent today.
              </Text>
            </View>

            {/* Direct Action Buttons */}
            <View className="gap-3">
              {/* Primary Action: Direct to Login */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/auth/login')}
                accessibilityRole="button"
                accessibilityLabel="Log in to your account"
                style={{ minHeight: 50, backgroundColor: colors.primary }}
                className="w-full px-4 py-3.5 rounded-[20px] flex-row items-center justify-center gap-2"
              >
                <Text className="text-lg font-semibold text-white text-center">
                  Log in
                </Text>
              </TouchableOpacity>

              {/* Google sign-in through the existing login flow */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/auth/login', params: { google: '1' } })}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                style={{
                  minHeight: 50,
                  backgroundColor: isDark ? colors.surface : '#FFFFFF',
                  borderColor: colors.border,
                }}
                className="w-full px-4 py-3.5 rounded-[20px] flex-row items-center justify-center gap-2.5 border"
              >
                <Image source={require('../../assets/images/google-g.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
                <Text className="text-base font-bold text-center" style={{ color: colors.text }}>
                  Continue with Google
                </Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row items-center gap-4 mt-6 mb-3">
              <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
              <Text className="text-sm" style={{ color: colors.textSecondary }}>or</Text>
              <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
            </View>
            <View className="flex-row flex-wrap items-center justify-center">
              <Text className="text-base" style={{ color: colors.textSecondary }}>Don&apos;t have an account?</Text>
              <TouchableOpacity
                onPress={() => router.push('/auth/student-register')}
                accessibilityRole="button"
                accessibilityLabel="Create an account"
                activeOpacity={0.7}
                className="min-h-11 px-2 items-center justify-center"
              >
                <Text className="text-base font-semibold" style={{ color: isDark ? colors.accent : colors.primary }}>Create an account</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* App Version Footer */}
          <View className="items-center justify-center mt-8">
            <Text
              className="text-[11px] font-medium tracking-wide"
              style={{ color: colors.textSecondary }}
            >
              DiskarTech v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
