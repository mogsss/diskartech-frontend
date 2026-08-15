import Badge from '@/components/ui/Badge';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { jobs } from '@/data/jobs';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams();
  const job = jobs.find((j) => j.id === id);

  // Local state para sa bookmark toggle
  const [isBookmarked, setIsBookmarked] = useState(job ? job.bookmarked : false);

  if (!job) {
    return (
      <View className="flex-1 bg-[#F8FAFC] items-center justify-center">
        <Text>Job not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Banner */}
        <View className="h-[200px] bg-red-600 rounded-b-[32px] pt-12 px-6 justify-between pb-6">
          <View className="flex-row justify-between items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>

            {/* Inayos natin ang Bookmark button para may background circle din */}
            <TouchableOpacity 
              onPress={() => setIsBookmarked(!isBookmarked)} 
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <MaterialIcons
                name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                size={22}
                color={Colors.white}
              />
            </TouchableOpacity>
          </View>

          <View className="items-center">
            <View className="w-20 h-20 rounded-full bg-white/25 items-center justify-center border-[3px] border-white/30">
              <Text className="text-[36px] font-extrabold text-white">{job.companyName.charAt(0)}</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="p-6 pt-4">
          {/* Header */}
          <View className="mb-4">
            <Text className="text-2xl font-bold text-slate-900 mb-1">{job.jobTitle}</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-base text-slate-500">{job.companyName}</Text>
              {job.verified && (
                <MaterialIcons name="verified" size={18} color={Colors.verified} />
              )}
            </View>
          </View>

          {/* Salary & Info */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="attach-money" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">Salary</Text>
              <Text className="text-[11px] font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>{job.salary}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">Location</Text>
              <Text className="text-[11px] font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>{job.location}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="schedule" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">Schedule</Text>
              <Text className="text-[11px] font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>{job.workingHours}</Text>
            </View>
          </View>

          {/* Tags */}
          <View className="flex-row gap-3 mb-6">
            <Badge text={job.jobType} variant="info" />
            <Badge text={job.category} variant="default" />
            <Badge text={job.schedule} variant="warning" />
          </View>

          {/* Description */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-4">Job Description</Text>
            <Text className="text-base text-slate-500 leading-[22px]">{job.description}</Text>
          </View>

          {/* Requirements */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-4">Requirements</Text>
            {job.requirements.map((req, index) => (
              <View key={index} className="flex-row items-start gap-3 mb-3">
                <View className="w-[6px] h-[6px] rounded-full bg-red-600 mt-[8px]" />
                <Text className="text-base text-slate-500 flex-1 leading-[22px]">{req}</Text>
              </View>
            ))}
          </View>

          {/* Skills */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-4">Skills Needed</Text>
            <View className="flex-row flex-wrap gap-3">
              {job.skills.map((skill) => (
                <View key={skill} style={{ backgroundColor: Colors.primary + '10' }} className="px-4 py-2 rounded-full">
                  <Text className="text-sm font-medium text-red-600">{skill}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Benefits */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-4">Benefits</Text>
            {job.benefits.map((benefit, index) => (
              <View key={index} className="flex-row items-start gap-3 mb-3">
                <MaterialIcons name="check-circle" size={18} color={Colors.success} />
                <Text className="text-base text-slate-500 flex-1 leading-[22px]">{benefit}</Text>
              </View>
            ))}
          </View>

          {/* Employer Info */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-4">About the Employer</Text>
            <View className="flex-row items-center gap-4">
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900 mb-1">{job.employerInfo.name}</Text>
                <Text className="text-sm text-slate-500 mb-[2px]">{job.employerInfo.email}</Text>
                <Text className="text-sm text-slate-500 mb-[2px]">{job.employerInfo.phone}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar - Inayos ang spacing at laki */}
      {/* Bottom Action Bar */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-t border-gray-100">
        <View className="w-[35%]">
          <Text className="text-xs text-slate-400">Salary</Text>
          <Text className="text-sm font-bold text-red-600" numberOfLines={1}>{job.salary}</Text>
        </View>
        <View className="w-[62%]">
          <PrimaryButton
            title="Apply Now"
            onPress={() => {}}
            size="medium"
          />
        </View>
      </View>
    </View>
  );
}