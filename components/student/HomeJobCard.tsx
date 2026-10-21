import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Avatar from '@/components/ui/Avatar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Job } from '@/types';
import ScheduleMatchNotice, { ScheduleMatch } from '@/components/schedule/ScheduleMatchNotice';
import { getSalaryUnit } from '@/utils/jobRate';

type HomeJob = Pick<Job,
  'jobTitle' | 'companyName' | 'salary' | 'salary_type' | 'location' | 'distance' | 'schedule' |
  'category' | 'bookmarked' | 'isApplied' | 'applicants' |
  'skills' | 'requirements'
> & { companyLogo?: string; verified?: boolean; featured?: boolean; scheduleMatch?: ScheduleMatch };

interface HomeJobCardProps {
  job: HomeJob;
  onPress: () => void;
  onBookmark: () => void;
}

export default function HomeJobCard({ job, onPress, onBookmark }: HomeJobCardProps) {
  const { colors, isDark } = useDarkMode();
  const subtle = isDark ? '#263449' : '#F1F5F9';
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;
  const tags = job.skills.length ? job.skills : job.requirements;

  return (
    <View className="border rounded-3xl mb-4 overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`View ${job.jobTitle} at ${job.companyName}`}
        className="p-5 pb-4"
      >
        <View className="flex-row items-center gap-3">
          <Avatar uri={job.companyLogo} name={job.companyName} size={44} />
          <View className="flex-1 mr-12">
            <Text className="text-lg font-bold leading-7" style={{ color: colors.text }} numberOfLines={2}>{job.jobTitle}</Text>
            <View className="flex-row items-center gap-1.5 mt-1">
              <Text className="text-sm shrink" style={{ color: colors.textSecondary }} numberOfLines={1}>{job.companyName}</Text>
              {job.verified && <MaterialIcons name="verified" size={15} color={isDark ? '#6EE7B7' : '#15803D'} />}
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-1.5 mt-4">
          {job.featured && (
            <View className="flex-row items-center gap-1 rounded-lg px-2.5 py-1" style={{ backgroundColor: isDark ? '#3B321D' : '#FFFBEB' }}>
              <MaterialIcons name="workspace-premium" size={14} color={isDark ? '#FCD34D' : '#92400E'} />
              <Text className="text-xs font-semibold" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>Featured</Text>
            </View>
          )}
          <View className="rounded-lg px-2.5 py-1 max-w-full" style={{ backgroundColor: subtle }}>
            <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }} numberOfLines={1}>{job.category}</Text>
          </View>
        </View>
        <ScheduleMatchNotice match={job.scheduleMatch} />

        <View className="flex-row items-center flex-wrap gap-1.5 mt-4 mb-3">
          <Text className="text-2xl font-bold tracking-tight" style={{ color: colors.text }}>{job.salary}</Text>
          <Text className="text-sm" style={{ color: colors.textSecondary }}>{getSalaryUnit(job.salary_type)}</Text>
          <View className="rounded-lg px-2 py-1 ml-auto" style={{ backgroundColor: subtle }}>
            <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>Part-time</Text>
          </View>
        </View>

        <View className="flex-row items-start gap-2 mt-2">
          <MaterialIcons name="location-on" size={17} color={colors.textSecondary} />
          <View className="flex-1 gap-1">
            <Text className="text-sm leading-5" style={{ color: colors.textSecondary }} numberOfLines={2}>
              {job.location}
            </Text>
            {!!job.distance && (
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                {job.distance}
              </Text>
            )}
          </View>
        </View>
        <View className="flex-row items-start gap-2 mt-2">
          <MaterialIcons name="schedule" size={17} color={colors.textSecondary} />
          <Text className="flex-1 text-sm leading-5" style={{ color: colors.textSecondary }} numberOfLines={2}>{job.schedule}</Text>
        </View>

        {tags.length > 0 && (
          <View className="flex-row items-center flex-wrap gap-1.5 mt-4">
            {tags.slice(0, 2).map((tag, index) => (
              <View key={`${tag}-${index}`} className="border rounded-lg px-2 py-1 max-w-full" style={{ borderColor: colors.border }}>
                <Text className="text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>{tag}</Text>
              </View>
            ))}
            {tags.length > 2 && <Text className="text-xs" style={{ color: colors.textSecondary }}>+{tags.length - 2}</Text>}
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onBookmark}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={job.bookmarked ? `Unsave ${job.jobTitle}` : `Save ${job.jobTitle}`}
        accessibilityState={{ selected: job.bookmarked }}
        className="absolute right-4 top-4 w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: job.bookmarked ? accentSurface : subtle }}
      >
        <MaterialIcons name={job.bookmarked ? 'bookmark' : 'bookmark-border'} size={21} color={job.bookmarked ? accentText : colors.textSecondary} />
      </TouchableOpacity>

      <View className="border-t flex-row items-center justify-between flex-wrap gap-3 px-5 py-3" style={{ borderTopColor: colors.border }}>
        <View className="shrink gap-1">
          {job.isApplied && (
            <View className="flex-row items-center gap-1">
              <MaterialIcons name="check-circle-outline" size={15} color={isDark ? '#6EE7B7' : '#15803D'} />
              <Text className="text-xs font-semibold" style={{ color: isDark ? '#6EE7B7' : '#15803D' }}>Applied</Text>
            </View>
          )}
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {job.applicants} {job.applicants === 1 ? 'applicant' : 'applicants'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`View details for ${job.jobTitle}`}
          className="min-h-12 flex-row items-center justify-center gap-2 px-4 rounded-xl" style={{ backgroundColor: accentSurface }}
        >
          <Text className="text-sm font-bold" style={{ color: accentText }}>View job</Text>
          <MaterialIcons name="arrow-forward" size={16} color={accentText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
