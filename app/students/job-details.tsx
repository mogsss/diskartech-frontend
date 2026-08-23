import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import api from '@/api/axios';
import { db } from '@/utils/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Helper para linisin at i-format ang available days
  const getCleanDays = (jobData: any) => {
    try {
      if (jobData.available_days) {
        const parsedDays = typeof jobData.available_days === 'string'
          ? JSON.parse(jobData.available_days)
          : jobData.available_days;

        if (Array.isArray(parsedDays)) {
          return parsedDays.join(', ');
        }
      }
    } catch (e) {
      return jobData.available_days || 'Flexible Days';
    }
    return 'Flexible Days';
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
        const response = await api.get(`/jobs/${id}`);
        if (response.data && response.data.status === 'success') {
          setJob(response.data.job);
        }

        // I-check kung naka-save na sa database para umilaw agad ang bookmark
        const savedResponse = await api.get('/student/saved-jobs');
        if (savedResponse.data && savedResponse.data.status === 'success') {
          const isAlreadySaved = savedResponse.data.jobs.some((savedJob: any) => savedJob.id.toString() === id?.toString());
          setIsBookmarked(isAlreadySaved);
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

  // Handler para sa pag-save/un-save ng trabaho (Bookmark Toggle)
  const handleToggleBookmark = async () => {
    try {
      const response = await api.post('/student/toggle-save-job', { job_id: id });
      if (response.data && response.data.status === 'success') {
        setIsBookmarked(!isBookmarked);
        Alert.alert('Tagumpay', response.data.message);
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Paalala', 'Hindi ma-save ang trabaho sa ngayon.');
    }
  };

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

  const companyName = job.household?.household_name || job.employer?.employer_name ;
  const location = job.household?.location || job.employer?.location ;
  const requirements = parseJsonField(job.requirements);
  const skills = parseJsonField(job.skills);
  const formattedDays = getCleanDays(job);

  const handleApplyJob = async () => {
    try {
      const response = await api.post('/student/apply-job', {
        job_id: job.id,
      });

      if (response.data && response.data.status === 'success') {
        Alert.alert('Tagumpay! 🎉', 'Matagumpay kang nakapag-apply sa trabahong ito.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'May naganap na error sa pag-apply.';
      Alert.alert('Paalala', errorMessage);
    }
  };

  // Handler para magsimula ng chat sa employer na may natatanging chatId para sa bawat estudyante
  const handleSendMessage = async () => {
    try {
      const ownerId = job.employer_id || job.household_id || job.user_id || 'employer_default';

      let studentId = 'student_default';
      let studentName = 'Student Applicant';
      let studentAvatar = '';

      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        const storedUser = await AsyncStorage.getItem('userData');

        if (storedUser) {
          const user = JSON.parse(storedUser);
          studentId = user.id?.toString() || 'student_default';
        }

        if (storedProfile) {
          const parsedProfile = JSON.parse(storedProfile);
          if (parsedProfile.student_name) {
            studentName = parsedProfile.student_name;
          }
          if (parsedProfile.avatar) {
            const baseUrl = 'http://192.168.1.2:8000/storage/';
            parsedProfile.avatar.startsWith('http')
              ? (studentAvatar = parsedProfile.avatar)
              : (studentAvatar = `http://192.168.1.2:8000/storage/${parsedProfile.avatar}`);
          }
        }
      } catch (e) {
        console.error('Error reading user storage:', e);
      }

      // Ginawa nating kasama ang studentId sa chatId para hiwalay ang room ng bawat estudyante
      const chatId = `job_${job.id}_employer_${ownerId}_student_${studentId}`;
      const chatRef = doc(db, 'chats', chatId);

      // Kunin ang avatar ng employer o household mula sa job details kung mayroon
      const rawEmployerAvatar = job.household?.avatar || job.employer?.avatar || '';
      let employerAvatar = '';
      if (rawEmployerAvatar) {
        rawEmployerAvatar.startsWith('http')
          ? (employerAvatar = rawEmployerAvatar)
          : (employerAvatar = `http://192.168.1.2:8000/storage/${rawEmployerAvatar}`);
      }

      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          studentId: studentId,
          ownerId: ownerId,
          senderName: studentName,
          employerName: companyName,
          senderAvatar: studentAvatar,
          employerAvatar: employerAvatar,
          online: true,
          lastMessage: '',
          timestamp: '',
          unread: false, // Bagong gawa pa lang ang chat room, kaya walang unread notification muna
        });
      } else {
        await setDoc(chatRef, {
          studentId: studentId,
          ownerId: ownerId,
          senderName: studentName,
          employerName: companyName,
          senderAvatar: studentAvatar,
          employerAvatar: employerAvatar,
        }, { merge: true });
      }

      router.push(`/chat?id=${chatId}` as any);
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Paalala', 'Hindi mabuksan ang chat sa ngayon.');
    }
  };

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
              onPress={handleToggleBookmark}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <MaterialIcons
                name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                size={22}
                color={isBookmarked ? '#dc2626' : Colors.white}
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

          {/* Salary & Location Info */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="attach-money" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">Salary</Text>
              <Text className="text-xs font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>₱{job.salary}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm">
              <MaterialIcons name="location-on" size={20} color={Colors.primary} />
              <Text className="text-xs text-slate-400 mt-1">Location</Text>
              <Text className="text-xs font-semibold text-slate-900 text-center mt-[2px]" numberOfLines={1}>{location}</Text>
            </View>
          </View>

          {/* Description */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-3">Job Description</Text>
            <Text className="text-base text-slate-500 leading-[22px]">{job.description}</Text>
          </View>

          {/* Schedule Section */}
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-900 mb-3">Schedule & Availability</Text>

            {/* Available Days */}
            <View className="flex-row items-start gap-3 mb-3">
              <View className="w-9 h-9 rounded-full bg-red-50 items-center justify-center mt-0.5">
                <MaterialIcons name="event" size={20} color={Colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-slate-400">Available Days</Text>
                <Text className="text-sm font-semibold text-slate-900 mt-0.5">
                  {formattedDays}
                </Text>
              </View>
            </View>

            {/* Time Slot */}
            <View className="flex-row items-start gap-3">
              <View className="w-9 h-9 rounded-full bg-red-50 items-center justify-center mt-0.5">
                <MaterialIcons name="schedule" size={20} color={Colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-slate-400">Time Slot</Text>
                <Text className="text-sm font-semibold text-slate-900 mt-0.5">
                  {job.time_slot || 'Flexible Time'}
                </Text>
              </View>
            </View>
          </View>

          {/* Requirements */}
          {requirements.length > 0 && (
            <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
              <Text className="text-lg font-bold text-slate-900 mb-4">Requirements</Text>
              {requirements.map((req: string, index: number) => (
                <View key={index} className="flex-row items-start gap-3 mb-3">
                  <View className="w-[6px] h-[6px] rounded-full bg-red-600 mt-[8px]" />
                  <Text className="text-base text-black flex-1 leading-[22px]">{req}</Text>
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
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-t border-gray-100 gap-3">
        <TouchableOpacity
          onPress={handleSendMessage}
          className="flex-1 bg-red-50 py-4 rounded-2xl flex-row items-center justify-center gap-2 border border-red-100"
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color="#dc2626" />
          <Text className="text-base font-bold text-red-600">Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleApplyJob}
          className="flex-1 bg-red-600 py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm"
        >
          <MaterialIcons name="check-circle-outline" size={20} color="#ffffff" />
          <Text className="text-base font-bold text-white">Apply Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}