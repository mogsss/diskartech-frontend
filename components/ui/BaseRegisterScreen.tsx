import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type RegistrationRole = 'student' | 'employer' | 'household';

const registrationRoutes = {
  student: '/auth/student-register',
  employer: '/auth/employer-register',
  household: '/auth/household-register',
} as const;

interface BaseRegisterScreenProps {
  activeTab: RegistrationRole;
  hasUnsavedChanges: boolean;
  submitting?: boolean;
  step: number;
  stepTitles: string[];
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
  scrollViewRef?: React.RefObject<ScrollView | null>;
  scrollViewProps?: Pick<ScrollViewProps, 'onScroll' | 'onLayout' | 'onContentSizeChange' | 'scrollEventThrottle'>;
}

export default function BaseRegisterScreen({
  activeTab,
  hasUnsavedChanges,
  submitting = false,
  step,
  stepTitles,
  title,
  subtitle,
  onBack,
  children,
  scrollViewRef,
  scrollViewProps,
}: BaseRegisterScreenProps) {
  const { isDark, colors } = useDarkMode();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pendingRole, setPendingRole] = useState<RegistrationRole | null>(null);
  const stayOnForm = () => setPendingRole(null);
  const switchRole = (role: RegistrationRole) => {
    if (role === activeTab || submitting) return;
    Keyboard.dismiss();
    if (hasUnsavedChanges) {
      setPendingRole(role);
      return;
    }
    router.replace(registrationRoutes[role]);
  };

  const content = (
    <>
      {isFocused && <StatusBar style={isDark ? 'light' : 'dark'} />}
      {/* Back button */}
      <TouchableOpacity 
        onPress={onBack}
        className="w-10 h-10 items-center justify-center mb-4"
      >
        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      {/* 3-TAB NAVIGATION (Student / Employer / Household) */}
      <View 
        style={{ backgroundColor: isDark ? colors.surface : '#F1F5F9' }}
        className="flex-row rounded-2xl p-1 mb-6"
      >
        <TabButton 
          label="Student" 
          icon="school" 
          isActive={activeTab === 'student'} 
          onPress={() => switchRole('student')}
        />
        <TabButton 
          label="Employer" 
          icon="business" 
          isActive={activeTab === 'employer'} 
          onPress={() => switchRole('employer')}
        />
        <TabButton 
          label="Household" 
          icon="home" 
          isActive={activeTab === 'household'} 
          onPress={() => switchRole('household')}
        />
      </View>

      {/* STEP PROGRESS BAR */}
      <View className="flex-row justify-between items-center mb-8 px-4">
        {stepTitles.map((label, index) => {
          const stepNumber = index + 1;
          const isPassed = step >= stepNumber;
          return (
            <React.Fragment key={label}>
              {index > 0 && (
                <View 
                  style={{ backgroundColor: isPassed ? '#DC2626' : (isDark ? colors.border : '#E2E8F0') }}
                  className="flex-1 h-[2px] mx-2" 
                />
              )}
              <View className="items-center">
                <View 
                  style={{ backgroundColor: isPassed ? '#DC2626' : (isDark ? colors.surface : '#E2E8F0') }}
                  className="w-9 h-9 rounded-full items-center justify-center"
                >
                  <Text 
                    style={{ color: isPassed ? '#FFFFFF' : (isDark ? colors.textSecondary : '#64748B') }}
                    className="font-bold text-sm"
                  >
                    {stepNumber}
                  </Text>
                </View>
                <Text 
                  style={{ color: isPassed ? '#DC2626' : colors.textSecondary }}
                  className={`text-xs mt-1 ${isPassed ? 'font-semibold' : ''}`}
                >
                  {label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {/* Page Header */}
      <Text style={{ color: colors.text }} className="text-2xl font-bold mb-1">{title}</Text>
      <Text style={{ color: colors.textSecondary }} className="text-base mb-6">{subtitle}</Text>

      {/* Form Content per Step */}
      {children}

      {/* Footer Login Link */}
      <Text style={{ color: colors.textSecondary }} className="text-base text-center mt-8">
        Already have an account?{' '}
        <Text className="text-red-600 font-semibold" onPress={() => router.push('/auth/login')}>
          Login
        </Text>
      </Text>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          {...scrollViewProps}
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: width < 380 ? 16 : 24,
            paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
      <NotificationModal
        visible={pendingRole !== null}
        title="Switch account type?"
        message="Your entered information will be cleared if you switch account type."
        iconName="swap-horiz"
        primaryButtonText="Stay"
        onPrimaryPress={stayOnForm}
        secondaryButtonText="Switch account type"
        onSecondaryPress={() => {
          if (!pendingRole || submitting) return;
          const role = pendingRole;
          stayOnForm();
          router.replace(registrationRoutes[role]);
        }}
        onRequestClose={stayOnForm}
        onBackdropPress={stayOnForm}
      />
    </View>
  );
}

function TabButton({ label, icon, isActive, onPress }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; isActive: boolean; onPress: () => void }) {
  const { colors } = useDarkMode();
  return (
    <TouchableOpacity
      className={`flex-1 flex-row items-center justify-center gap-1 py-3 rounded-xl ${isActive ? 'bg-red-600 shadow-sm' : ''}`}
      onPress={onPress}
    >
      <MaterialIcons name={icon} size={16} color={isActive ? Colors.white : colors.textSecondary} />
      <Text 
        style={{ color: isActive ? Colors.white : colors.textSecondary }}
        className="text-xs font-semibold"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
