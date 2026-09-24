import { Colors } from '@/constants/colors';
import { Job } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useRef } from 'react';
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
        className={`bg-white rounded-2xl p-4 mb-4 overflow-hidden shadow-md border-l-4 ${
          isFeatured ? 'border-l-red-600' : 'border-l-transparent'
        }`}
      >
        {isFeatured && <View className="absolute top-0 left-0 right-0 h-1 bg-red-600 rounded-t-2xl" />}

        {/* Header */}
        <View className="flex-row items-center mb-3">
          <View className="w-[52px] h-[52px] rounded-xl bg-red-50 items-center justify-center overflow-hidden mr-3">
            {job.companyLogo ? (
              <Image source={{ uri: job.companyLogo }} className="w-[52px] h-[52px] rounded-xl" />
            ) : (
              <Text className="text-base font-bold text-red-600">{initials}</Text>
            )}
          </View>
          <View className="flex-1 mr-3">
            <View className="flex-row items-center gap-1">
              <Text className="text-base font-bold text-slate-900 flex-shrink-1" numberOfLines={1}>
                {job.jobTitle}
              </Text>
              {job.verified && (
                <MaterialIcons name="verified" size={18} color={Colors.verified} />
              )}
            </View>
            <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>{job.companyName}</Text>
          </View>
          {!isCompact && (
            <TouchableOpacity onPress={onBookmark} className="p-1">
              <MaterialIcons
                name={job.bookmarked ? 'bookmark' : 'bookmark-border'}
                size={24}
                color={job.bookmarked ? Colors.bookmark : '#94a3b8'}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Details */}
        <View className={`flex-row flex-wrap gap-3 mb-3 ${isCompact ? 'gap-2' : ''}`}>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="attach-money" size={16} color="#dc2626" />
            <Text className="text-xs text-slate-600 font-medium">{job.salary}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="location-on" size={16} color="#64748b" />
            <Text className="text-xs text-slate-600 max-w-[100px]" numberOfLines={1}>{job.distance}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="schedule" size={16} color="#64748b" />
            <Text className="text-xs text-slate-600" numberOfLines={1}>{job.workingHours}</Text>
          </View>
        </View>

        {/* Location */}
        <View className="flex-row items-center gap-1 mb-3">
          <MaterialIcons name="location-city" size={14} color="#94a3b8" />
          <Text className="text-xs text-slate-400 flex-1" numberOfLines={1}>{job.location}</Text>
        </View>

        {/* Tags */}
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          <View className="bg-slate-100 px-2.5 py-1 rounded-full">
            <Text className="text-[11px] font-medium text-slate-600">{job.jobType}</Text>
          </View>
          <View className="bg-slate-100 px-2.5 py-1 rounded-full">
            <Text className="text-[11px] font-medium text-slate-600">{job.schedule}</Text>
          </View>
          <View className="bg-slate-100 px-2.5 py-1 rounded-full">
            <Text className="text-[11px] font-medium text-slate-600">{job.category}</Text>
          </View>
        </View>

        {/* Requirements Pills */}
        {job.requirements && job.requirements.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 -mt-1 mb-3">
            {job.requirements.slice(0, 2).map((req, index) => (
              <View key={index} className="bg-red-50 px-2.5 py-1 rounded-full">
                <Text className="text-[11px] font-medium text-red-600">{req}</Text>
              </View>
            ))}
            {job.requirements.length > 2 && (
              <View className="bg-slate-100 px-2.5 py-1 rounded-full">
                <Text className="text-[11px] font-medium text-slate-600">+{job.requirements.length - 2} more</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        {!isCompact && (
          <View className="flex-row items-center justify-between border-t border-slate-100 pt-3">
            <Text className="text-xs text-slate-400">
              <Text>{job.postedDate || 'Recent'}</Text>
              <Text> • </Text>
              <Text>{job.applicants ?? 0}</Text>
              <Text> applicants</Text>
            </Text>
            <TouchableOpacity onPress={onApply} className="flex-row items-center bg-red-600 px-4 py-2 rounded-xl gap-1">
              <Text className="text-xs font-bold text-white">Apply Now</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}