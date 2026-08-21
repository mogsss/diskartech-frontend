import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import api from '@/api/axios';

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Helper para linisin ang schedule format
  const getCleanSchedule = (schedules: any) => {
    if (!schedules) return 'Flexible';
    if (Array.isArray(schedules)) return schedules[0] || 'Flexible';
    try {
      const parsed = JSON.parse(schedules);
      if (Array.isArray(parsed)) return parsed[0] || 'Flexible';
      return parsed;
    } catch (e) {
      return schedules.replace(/[\[\]"]/g, '');
    }
  };

  // Helper para i-parse ang JSON arrays (requirements, skills)
  const parseJsonField = (field: any) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        const response = await api.get(`/jobs/${id}`); // Siguraduhing tugma sa route ng Laravel mo
        if (response.data && response.data.status === 'success') {
          setJob(response.data.job);
        }
      } catch (error) {
        console.error('Error fetching job details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchJobDetails();
    }
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#F8FAFC] items-center justify-center">
        <ActivityIndicator size="large" color="#dc2626" />
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-[#F8FAFC] items-center justify-center p-6">
        <Text className="text-slate-500 text-base mb-4">Job not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-red-600 px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const companyName = job.household?.household_name || job.employer?.employer_name || 'Employer';
  const location = job.household?.location || job.employer?.location || 'Pinamalayan';
  const requirements = parseJsonField(job.requirements);
  const skills = parseJsonField(job.skills);

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
              <Text className="text-[36px] font-extrabold text-white">{companyName.charAt(0)}</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="p-6 pt-4">
          {/* Header */}
          <View className="mb-4">
            <Text className="text-2xl font-bold text-slate-900 mb-1">{job.title}</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-base text-slate-500">{companyName}</Text>
              <MaterialIcons name="verified" size={18} color={Colors.verified} />
            </View>
          </View>

          {/* Salary & Info */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="attach-money" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">SalaryI</Text>
              <Text className="text-[11px] font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>₱{job.salary}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">Location</Text>
              <Text className="text-[11px] font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>{location}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="schedule" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">Schedule</Text>
              <Text className="text-[11px] font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>{getCleanSchedule(job.schedules)}</Text>
            </View>
          </View>

          {/* Description */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-4">Job Description</Text>
            <Text className="text-base text-slate-500 leading-[22px]">{job.description}</Text>
          </View>

          {/* Requirements */}
          {requirements.length > 0 && (
            <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
              <Text className="text-lg font-bold text-slate-900 mb-4">Requirements</Text>
              {requirements.map((req: string, index: number) => (
                <View key={index} className="flex-row items-start gap-3 mb-3">
                  <View className="w-[6px] h-[6px] rounded-full bg-red-600 mt-[8px]" />
                  <Text className="text-base text-slate-500 flex-1 leading-[22px]">{req}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
              <Text className="text-lg font-bold text-slate-900 mb-4">Skills Needed</Text>
              <View className="flex-row flex-wrap gap-3">
                {skills.map((skill: string) => (
                  <View key={skill} style={{ backgroundColor: Colors.primary + '10' }} className="px-4 py-2 rounded-full">
                    <Text className="text-sm font-medium text-red-600">{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-t border-gray-100">
        <View className="w-[35%]">
          <Text className="text-xs text-slate-400">Salary</Text>
          <Text className="text-sm font-bold text-red-600" numberOfLines={1}>₱{job.salary}</Text>
        </View>
        <View className="w-[62%]">
          <PrimaryButton
            title="Apply Now"
            onPress={() => Alert.alert('Success', 'Application feature is ready to be linked!')}
            size="medium"
          />
        </View>
      </View>
    </View>
  );
}