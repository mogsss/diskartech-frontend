import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import api from '@/api/axios';
import { sendAppNotification } from '@/utils/notifications';
import { useDarkMode } from '@/hooks/useDarkMode';

const STUDENT_TAGS = [
  'Punctual & On-Time',
  'Hardworking',
  'Fast Learner',
  'Polite & Respectful',
  'Strong Initiative',
  'Well-Organized',
  'Trustworthy',
];

const EMPLOYER_TAGS = [
  'Paid On Time',
  'Safe & Clean Environment',
  'Fair & Respectful',
  'Clear Instructions',
  'Supportive Employer',
  'Great Experience',
  'Highly Recommended',
];

const RATING_DESCRIPTIONS: Record<number, { label: string; emoji: string; color: string }> = {
  5: { label: 'Outstanding / Highly Commended!', emoji: '🌟', color: '#059669' },
  4: { label: 'Very Good / Recommended!', emoji: '😊', color: '#16A34A' },
  3: { label: 'Good / Satisfactory', emoji: '🙂', color: '#D97706' },
  2: { label: 'Fair / Below Expectations', emoji: '😐', color: '#EA580C' },
  1: { label: 'Needs Improvement', emoji: '😞', color: '#DC2626' },
};

export default function RateContractScreen() {
  const { isDark, colors } = useDarkMode();
  const {
    applicationId,
    companyName: paramCompanyName,
    studentName: paramStudentName,
    targetName: paramTargetName,
    targetAvatar: paramTargetAvatar,
    employerAvatar: paramEmployerAvatar,
    studentAvatar: paramStudentAvatar,
    jobTitle: paramJobTitle,
  } = useLocalSearchParams<{
    applicationId: string;
    companyName?: string;
    studentName?: string;
    targetName?: string;
    targetAvatar?: string;
    employerAvatar?: string;
    studentAvatar?: string;
    jobTitle?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contractData, setContractData] = useState<any>(null);

  // Form State
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>('');

  const STORAGE_URL = api.defaults.baseURL
    ? api.defaults.baseURL.replace('/api', '/storage/')
    : 'https://diskartech-backend.onrender.com/storage/';

  useEffect(() => {
    fetchReviewDetails();
  }, [applicationId]);

  const fetchReviewDetails = async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      const res = await api.get(`/applications/${applicationId}/reviews`);
      if (res.data && res.data.status === 'success') {
        const data = res.data.data;

        // Fallback: If target_user name is missing or generic, attempt application details
        if (
          !data.target_user?.name ||
          data.target_user.name === 'Employer' ||
          data.target_user.name === 'Household Employer' ||
          data.target_user.name === 'Contract Participant'
        ) {
          const fallbackName = paramCompanyName || paramStudentName || paramTargetName;
          if (fallbackName) {
            data.target_user = {
              ...(data.target_user || {}),
              name: fallbackName,
            };
          }
        }

        setContractData(data);
        if (data.has_reviewed && data.my_review) {
          setRating(data.my_review.rating);
          setFeedback(data.my_review.feedback || '');
          if (data.my_review.tags) {
            try {
              const parsedTags =
                typeof data.my_review.tags === 'string'
                  ? JSON.parse(data.my_review.tags)
                  : data.my_review.tags;
              setSelectedTags(Array.isArray(parsedTags) ? parsedTags : []);
            } catch {
              setSelectedTags([]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching review details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    if (contractData?.has_reviewed) return;
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmitRating = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert('Invalid Rating', 'Please select a star rating between 1 and 5.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        rating,
        tags: selectedTags,
        feedback: feedback.trim(),
      };

      const res = await api.post(`/applications/${applicationId}/reviews`, payload);
      if (res.data && res.data.status === 'success') {
        // Send Notification to recipient
        try {
          const targetUserId = contractData?.target_user?.id;
          if (targetUserId) {
            const reviewerRole = contractData?.user_role === 'student' ? 'Student' : 'Employer';
            await sendAppNotification({
              recipientId: targetUserId,
              title: 'New Performance Review Received ⭐',
              body: `Your ${reviewerRole.toLowerCase()} has submitted an official rating (${rating}.0 Stars) for your completed contract.`,
              type: 'general',
              targetId: applicationId,
            });
          }
        } catch (notifErr) {
          console.error('Error triggering review notification:', notifErr);
        }

        Alert.alert(
          'Review Submitted',
          'Thank you! Your rating and feedback have been officially recorded to build a transparent, trusted DiskarTech community.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.back();
              },
            },
          ]
        );
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      const msg = err.response?.data?.message || 'Failed to submit rating. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text className="text-xs mt-2 font-medium" style={{ color: colors.textSecondary }}>Loading review details...</Text>
      </View>
    );
  }

  const targetUser = contractData?.target_user || {};
  const isStudentReviewing = contractData?.user_role === 'student' || (!contractData && Boolean(paramCompanyName));
  const availableTags = isStudentReviewing ? EMPLOYER_TAGS : STUDENT_TAGS;
  const currentRatingInfo = RATING_DESCRIPTIONS[rating] || RATING_DESCRIPTIONS[5];
  const hasReviewed = contractData?.has_reviewed;

  const displayTargetName =
    targetUser.name &&
      targetUser.name !== 'Contract Participant' &&
      targetUser.name !== 'Employer' &&
      targetUser.name !== 'Household Employer'
      ? targetUser.name
      : paramTargetName || paramCompanyName || paramStudentName || targetUser.name || 'Employer';

  const displayAvatar =
    targetUser.avatar ||
    paramTargetAvatar ||
    paramEmployerAvatar ||
    paramStudentAvatar ||
    null;

  const displayJobTitle = contractData?.job_title || paramJobTitle || 'Employment Contract';

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Top Header */}
      <View 
        className="flex-row items-center justify-between px-6 pt-12 pb-4 border-b"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3 active:opacity-80"
            style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }}
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text className="text-lg font-bold" style={{ color: colors.text }}>
              {hasReviewed ? 'Contract Review' : 'Rate & Review'}
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {isStudentReviewing ? 'Rate Employer Experience' : 'Rate Student Performance'}
            </Text>
          </View>
        </View>

        <View 
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2' }}
        >
          <MaterialIcons name="star" size={18} color={colors.accent} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-6 pb-24"
        >
          {/* Target Profile Card */}
          <View 
            className="rounded-3xl p-5 mb-5 shadow-sm border items-center"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View 
              className="w-20 h-20 rounded-full items-center justify-center border-2 mb-3 overflow-hidden shadow-inner"
              style={{ 
                backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'
              }}
            >
              {displayAvatar ? (
                <Image
                  source={{
                    uri: displayAvatar.startsWith('http')
                      ? displayAvatar
                      : `${STORAGE_URL}${displayAvatar}`,
                  }}
                  className="w-20 h-20 rounded-full"
                />
              ) : (
                <MaterialIcons
                  name={isStudentReviewing ? 'business' : 'person'}
                  size={36}
                  color={colors.accent}
                />
              )}
            </View>

            <Text className="text-lg font-extrabold text-center" style={{ color: colors.text }}>
              {displayTargetName}
            </Text>
            <Text className="text-xs font-semibold mt-0.5" style={{ color: colors.textSecondary }}>
              {isStudentReviewing ? 'Employer' : 'Working Student'}
            </Text>

            <View 
              className="mt-3 px-3 py-1.5 rounded-full border flex-row items-center gap-1.5"
              style={{ 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                borderColor: colors.border
              }}
            >
              <MaterialIcons name="work-outline" size={14} color={colors.textSecondary} />
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                {displayJobTitle}
              </Text>
            </View>

            {hasReviewed && (
              <View className="mt-3 flex-row items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <MaterialIcons name="verified" size={14} color="#059669" />
                <Text className="text-xs font-bold text-emerald-700">Official Rating Submitted</Text>
              </View>
            )}
          </View>

          {/* Interactive 5-Star Card */}
          <View 
            className="rounded-3xl p-6 mb-5 shadow-sm border items-center"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Text className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: colors.textSecondary }}>
              Overall Rating
            </Text>
            <Text className="text-xs mb-4 text-center" style={{ color: colors.textSecondary }}>
              {isStudentReviewing
                ? `How was your experience working for ${displayTargetName}?`
                : 'How well did the student perform their responsibilities?'}
            </Text>

            {/* Stars Row */}
            <View className="flex-row items-center justify-center gap-3 my-2">
              {[1, 2, 3, 4, 5].map((starValue) => {
                const isFilled = starValue <= rating;
                return (
                  <TouchableOpacity
                    key={starValue}
                    disabled={hasReviewed}
                    onPress={() => setRating(starValue)}
                    className="p-1.5 active:scale-110"
                  >
                    <MaterialIcons
                      name={isFilled ? 'star' : 'star-outline'}
                      size={44}
                      color={isFilled ? '#F59E0B' : (isDark ? '#475569' : '#CBD5E1')}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Dynamic Rating Label */}
            <View className="mt-2 flex-row items-center gap-1.5">
              <Text className="text-base">{currentRatingInfo.emoji}</Text>
              <Text
                style={{ color: currentRatingInfo.color }}
                className="text-sm font-bold tracking-wide"
              >
                {currentRatingInfo.label}
              </Text>
            </View>
          </View>

          {/* Quick Feedback Tag Chips */}
          <View 
            className="rounded-3xl p-5 mb-5 shadow-sm border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Text className="text-sm font-bold mb-1" style={{ color: colors.text }}>
              Highlights & Experiences
            </Text>
            <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
              {hasReviewed
                ? 'Tags highlighted for this contract:'
                : 'Tap all qualities that apply (optional):'}
            </Text>

            <View className="flex-row flex-wrap gap-2">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    disabled={hasReviewed}
                    onPress={() => handleToggleTag(tag)}
                    className="px-3.5 py-2 rounded-2xl border flex-row items-center gap-1.5"
                    style={{
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2')
                        : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC'),
                      borderColor: isSelected
                        ? (isDark ? 'rgba(220, 38, 38, 0.4)' : '#FCA5A5')
                        : colors.border,
                    }}
                  >
                    {isSelected && (
                      <MaterialIcons name="check" size={14} color={colors.accent} />
                    )}
                    <Text
                      className="text-xs"
                      style={{
                        fontWeight: '600',
                        color: isSelected
                          ? (isDark ? colors.accent : '#B91C1C')
                          : colors.text,
                      }}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Written Feedback / Comments */}
          <View 
            className="rounded-3xl p-5 mb-6 shadow-sm border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Text className="text-sm font-bold mb-1" style={{ color: colors.text }}>
              Feedback & Comments
            </Text>
            <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
              {hasReviewed
                ? 'Your submitted written feedback:'
                : 'Share your personal thoughts, feedback, or a word of gratitude:'}
            </Text>

            {hasReviewed ? (
              <View 
                className="p-4 rounded-2xl border"
                style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC', borderColor: colors.border }}
              >
                <Text className="text-xs leading-relaxed italic" style={{ color: colors.text }}>
                  {feedback || 'No written feedback provided.'}
                </Text>
              </View>
            ) : (
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder={
                  isStudentReviewing
                    ? 'e.g. Employer was very accommodating and provided clear guidance. Highly recommended!'
                    : 'e.g. Student was very punctual, diligent, and completed all tasks efficiently!'
                }
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="rounded-2xl p-4 text-xs leading-relaxed min-h-[100px] border"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                  borderColor: colors.border,
                  color: colors.text,
                }}
              />
            )}
          </View>

          {/* Action Buttons */}
          {!hasReviewed && (
            <TouchableOpacity
              onPress={handleSubmitRating}
              disabled={submitting}
              className="py-4 rounded-2xl bg-red-600 items-center justify-center flex-row gap-2 shadow-md active:bg-red-700"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="verified" size={20} color="#FFFFFF" />
                  <Text className="text-white text-base font-bold">
                    Submit Official Rating
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {hasReviewed && (
            <TouchableOpacity
              onPress={() => router.back()}
              className="py-3.5 rounded-2xl items-center justify-center border"
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9', borderColor: colors.border }}
            >
              <Text className="text-sm font-bold" style={{ color: colors.text }}>Back to Details</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
