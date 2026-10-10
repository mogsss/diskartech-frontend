import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface BaseRegisterScreenProps {
  activeTab: 'student' | 'employer' | 'household';
  step: number;
  stepTitles: string[];
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}

export default function BaseRegisterScreen({
  activeTab,
  step,
  stepTitles,
  title,
  subtitle,
  onBack,
  children,
}: BaseRegisterScreenProps) {
  const { isDark, colors } = useDarkMode();

  return (
    <KeyboardAwareScrollView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingTop: 48, paddingBottom: 100 }}
      enableOnAndroid={true}
      extraScrollHeight={50}
      extraHeight={100}
      showsVerticalScrollIndicator={false}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back button */}
      <TouchableOpacity 
        onPress={onBack} 
        style={{ backgroundColor: isDark ? colors.surface : '#F1F5F9' }}
        className="w-10 h-10 rounded-full items-center justify-center mb-4"
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
          onPress={() => router.replace('/auth/student-register')} 
        />
        <TabButton 
          label="Employer" 
          icon="business" 
          isActive={activeTab === 'employer'} 
          onPress={() => router.replace('/auth/employer-register')} 
        />
        <TabButton 
          label="Household" 
          icon="home" 
          isActive={activeTab === 'household'} 
          onPress={() => router.replace('/auth/household-register')} 
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
    </KeyboardAwareScrollView>
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