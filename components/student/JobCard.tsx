import { Colors } from '@/constants/colors';
import { Job } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useRef, useState, useEffect } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  Animated,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface JobCardProps {
  job: Job & { companyLogo?: string }; // Tiniyak nating tinatanggap nito ang companyLogo
  onPress: () => void;
  onBookmark?: () => void;
  onApply?: () => void;
  variant?: 'default' | 'compact' | 'featured';
}

export default function JobCard({ job, onPress, onBookmark, onApply, variant = 'default' }: JobCardProps) {
  const { colors, isDark } = useDarkMode();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [job.companyLogo]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const isCompact = variant === 'compact';
  const isFeatured = variant === 'featured';

  // Helper para kumuha ng initials mula sa pangalan ng kumpanya/household
  const getInitials = (name: string) => {
    if (!name) return 'CP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const initials = getInitials(job.companyName);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
        style={{ backgroundColor: colors.surface }}
        className={`rounded-2xl p-4 mb-4 overflow-hidden shadow-md border-l-4 ${isFeatured ? 'border-l-red-600' : 'border-l-transparent'
          }`}
      >
        {isFeatured && <View className="absolute top-0 left-0 right-0 h-1 bg-red-600 rounded-t-2xl" />}

        {/* Header */}
        <View className="flex-row items-center mb-3">
          <View style={{ backgroundColor: isDark ? '#334155' : '#FEF2F2' }} className="w-[52px] h-[52px] rounded-xl items-center justify-center overflow-hidden mr-3">
            {job.companyLogo && !logoError ? (
              <Image
                source={{ uri: job.companyLogo }}
                className="w-[52px] h-[52px] rounded-xl"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Text className="text-base font-bold text-red-600">{initials}</Text>
            )}
          </View>
          <View className="flex-1 mr-3">
            <View className="flex-row items-center gap-1">
              <Text style={{ color: colors.text }} className="text-base font-bold flex-shrink-1" numberOfLines={1}>
                {job.jobTitle}
              </Text>
              {job.verified && (
                <MaterialIcons name="verified" size={18} color={Colors.verified} />
              )}
            </View>
            <Text style={{ color: colors.textSecondary }} className="text-xs mt-0.5" numberOfLines={1}>{job.companyName}</Text>
          </View>
          {!isCompact && (
            <TouchableOpacity onPress={onBookmark} className="p-1">
              <MaterialIcons
                name={job.bookmarked ? 'bookmark' : 'bookmark-border'}
                size={24}
                color={job.bookmarked ? Colors.bookmark : (isDark ? '#64748B' : '#94a3b8')}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Details */}
        <View className={`flex-row flex-wrap gap-3 mb-3 ${isCompact ? 'gap-2' : ''}`}>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="attach-money" size={16} color="#dc2626" />
            <Text style={{ color: isDark ? '#CBD5E1' : '#475569' }} className="text-xs font-medium">{job.salary}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="location-on" size={16} color={isDark ? '#94A3B8' : '#64748b'} />
            <Text style={{ color: isDark ? '#CBD5E1' : '#475569' }} className="text-xs max-w-[100px]" numberOfLines={1}>{job.distance}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="schedule" size={16} color={isDark ? '#94A3B8' : '#64748b'} />
            <Text style={{ color: isDark ? '#CBD5E1' : '#475569' }} className="text-xs" numberOfLines={1}>{job.workingHours}</Text>
          </View>
        </View>

        {/* Location */}
        <View className="flex-row items-center gap-1 mb-3">
          <MaterialIcons name="location-city" size={14} color={isDark ? '#64748B' : '#94a3b8'} />
          <Text style={{ color: colors.textSecondary }} className="text-xs flex-1" numberOfLines={1}>{job.location}</Text>
        </View>

        {/* Tags */}
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          <View style={{ backgroundColor: isDark ? '#334155' : '#F1F5F9' }} className="px-2.5 py-1 rounded-full">
            <Text style={{ color: isDark ? '#E2E8F0' : '#475569' }} className="text-[11px] font-medium">{job.jobType}</Text>
          </View>
          <View style={{ backgroundColor: isDark ? '#334155' : '#F1F5F9' }} className="px-2.5 py-1 rounded-full">
            <Text style={{ color: isDark ? '#E2E8F0' : '#475569' }} className="text-[11px] font-medium">{job.schedule}</Text>
          </View>
          <View style={{ backgroundColor: isDark ? '#334155' : '#F1F5F9' }} className="px-2.5 py-1 rounded-full">
            <Text style={{ color: isDark ? '#E2E8F0' : '#475569' }} className="text-[11px] font-medium">{job.category}</Text>
          </View>
        </View>

        {/* Requirements Pills */}
        {job.requirements && job.requirements.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 -mt-1 mb-3">
            {job.requirements.slice(0, 2).map((req, index) => (
              <View key={index} style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#FEF2F2' }} className="px-2.5 py-1 rounded-full">
                <Text className="text-[11px] font-medium text-red-500">{req}</Text>
              </View>
            ))}
            {job.requirements.length > 2 && (
              <View style={{ backgroundColor: isDark ? '#334155' : '#F1F5F9' }} className="px-2.5 py-1 rounded-full">
                <Text style={{ color: isDark ? '#E2E8F0' : '#475569' }} className="text-[11px] font-medium">+{job.requirements.length - 2} more</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        {!isCompact && (
          <View style={{ borderTopColor: colors.border }} className="flex-row items-center justify-between border-t pt-3">
            <Text style={{ color: colors.textSecondary }} className="text-xs">
              <Text>{job.postedDate || 'Recent'}</Text>
              <Text> • </Text>
              <Text>{job.applicants ?? 0}</Text>
              <Text> applicants</Text>
            </Text>
            {job.isApplied ? (
              <View style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#FEF2F2', borderColor: isDark ? '#7F1D1D' : '#FECACA' }} className="flex-row items-center border px-3.5 py-1.5 rounded-xl gap-1.5">
                <MaterialIcons name="check-circle" size={15} color="#dc2626" />
                <Text className="text-xs font-bold text-red-500">Applied</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={onApply} className="flex-row items-center bg-red-600 px-4 py-2 rounded-xl gap-1">
                <Text className="text-xs font-bold text-white">Apply Now</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}