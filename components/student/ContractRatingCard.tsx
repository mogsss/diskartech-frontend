import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';

interface ContractRatingCardProps {
  companyName: string;
  contractReview: any;
  onRatePress: () => void;
  embedded?: boolean;
}

export default function ContractRatingCard({ companyName, contractReview, onRatePress, embedded }: ContractRatingCardProps) {
  const { colors, isDark } = useDarkMode();
  const hasReviewed = contractReview?.has_reviewed;
  const myReview = contractReview?.my_review;
  return (
    <ApplicationSection title="Rating & feedback" icon="star-outline" embedded={embedded}>
      {hasReviewed ? (
        <View>
          <View className="flex-row items-center justify-between gap-2 mb-2">
            <Text className="flex-1 text-xs font-semibold" style={{ color: colors.text }}>You rated this employer</Text>
            <View className="flex-row items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: isDark ? colors.background : '#FFFBEB' }}>
              <MaterialIcons name="star" size={14} color="#F59E0B" />
              <Text className="text-xs font-semibold" style={{ color: colors.text }}>{myReview?.rating}</Text>
            </View>
          </View>
          {myReview?.feedback && <Text className="text-sm leading-5 mb-3" style={{ color: colors.textSecondary }}>{myReview.feedback}</Text>}
          <TouchableOpacity onPress={onRatePress} accessibilityRole="button" accessibilityLabel="View full employer review" activeOpacity={0.7} className="rounded-xl border px-3 py-2.5 items-center" style={{ minHeight: 44, borderColor: colors.border, backgroundColor: isDark ? colors.background : '#F8FAFC' }}>
            <Text className="text-xs font-semibold" style={{ color: colors.text }}>View full review</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text className="text-sm font-medium leading-5 mb-1" style={{ color: colors.text }}>How was your experience with {companyName}?</Text>
          <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>Share your rating and feedback about the employer and workplace to help other working students.</Text>
          <TouchableOpacity onPress={onRatePress} accessibilityRole="button" accessibilityLabel="Rate employer and workplace" activeOpacity={0.8} className="flex-row items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-3" style={{ minHeight: 44 }}>
            <MaterialIcons name="star-outline" size={18} color="#FFFFFF" />
            <Text className="text-xs font-semibold text-white">Rate employer</Text>
          </TouchableOpacity>
        </View>
      )}
    </ApplicationSection>
  );
}
