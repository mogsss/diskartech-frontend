import CandidateProfileFields from '@/components/employer/job-posting/CandidateProfileFields';
import JobDetailsFields from '@/components/employer/job-posting/JobDetailsFields';
import JobScheduleFields from '@/components/employer/job-posting/JobScheduleFields';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useJobPosting } from '@/hooks/useJobPosting';
import { useJobPostingKeyboard } from '@/hooks/useJobPostingKeyboard';
import { jobQuotaAvailability, jobQuotaUsage } from '@/utils/jobQuota';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Keyboard, Platform, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function JobPostingScreen() {
  const params = useLocalSearchParams<{ jobId?: string; type?: string }>();
  const form = useJobPosting(params);
  const { inputNavigation, formScrollRef } = useJobPostingKeyboard();
  const { isEditing, isHousehold, loading, jobQuota, notificationConfig, handleSubmit } = form;
  const { colors, isDark } = useDarkMode();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const accentColor = isDark ? colors.accent : '#B91C1C';
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'requirements' | 'skills' | null>(null);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
      {isFocused && <StatusBar style={isDark ? 'light' : 'dark'} />}
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setIsCategoryOpen(false); setActiveSuggestionField(null); }}>
        <KeyboardAwareScrollView
          ref={formScrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 36 }}
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={Platform.OS === 'ios' ? 0 : 100}
          extraHeight={120}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          scrollEnabled={isScrollEnabled}
        >
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="w-11 h-11 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View className="flex-row items-center gap-1.5 px-3 py-1.5">
              <MaterialIcons name={isHousehold ? 'home-work' : 'business-center'} size={18} color={accentColor} />
            </View>
          </View>

          <Text className="text-[28px] font-bold tracking-tight mb-2" style={{ color: colors.text }}>
            {isEditing ? 'Edit Job Posting' : isHousehold ? 'Post Household Opening' : 'Post a New Job'}
          </Text>
          <Text className="text-sm leading-5 mb-5" style={{ color: colors.textSecondary }}>
            {isEditing ? 'Keep your opening up to date for student applicants.' : 'Find the right student for your next opening.'}
          </Text>
          <View className="flex-row items-center gap-1.5 mb-5">
            <MaterialIcons name="info-outline" size={14} color={colors.textSecondary} />
            <Text className="text-xs" style={{ color: colors.textSecondary }}>Fields marked * are required</Text>
          </View>

          {!isEditing && !isHousehold && jobQuota && <View className="rounded-2xl border p-4 mb-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>{jobQuotaUsage(jobQuota)}</Text>
            <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{jobQuotaAvailability(jobQuota)}</Text>
          </View>}

          <JobDetailsFields
            form={form.details}
            inputNavigation={inputNavigation}
            isHousehold={form.isHousehold}
            isCategoryOpen={isCategoryOpen}
            setIsCategoryOpen={setIsCategoryOpen}
            onScrollEnabledChange={setIsScrollEnabled}
          />
          <JobScheduleFields form={form.schedule} />
          <CandidateProfileFields
            form={form.candidate}
            inputNavigation={inputNavigation}
            activeSuggestionField={activeSuggestionField}
            setActiveSuggestionField={setActiveSuggestionField}
          />

          <View className="px-1 mt-1">
            <Text className="text-sm font-semibold mb-1" style={{ color: colors.text }}>{isEditing ? 'Ready to save?' : 'Ready to post?'}</Text>
            <Text className="text-xs leading-5 mb-4" style={{ color: colors.textSecondary }}>Review your details before submitting.</Text>
            <PrimaryButton
              title={loading ? (isEditing ? 'Saving Changes...' : 'Posting Job...') : (isEditing ? 'Save Changes' : 'Submit Job Posting')}
              onPress={handleSubmit}
              size="medium"
              icon={<MaterialIcons name={isEditing ? 'check' : 'arrow-forward'} size={18} color="#FFFFFF" />}
              disabled={loading}
              loading={loading}
            />
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
      <NotificationModal {...notificationConfig} />
    </View>
  );
}
