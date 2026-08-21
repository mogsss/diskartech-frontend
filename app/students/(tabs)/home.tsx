import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import JobCard from '@/components/ui/JobCard';
import SearchBar from '@/components/ui/SearchBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';

export default function HomeScreen() {
  const [studentName, setStudentName] = useState('Student');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'nearby' | 'ai_match'>('all');

  const [realNearbyJobs, setRealNearbyJobs] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);

  const [realAllJobs, setRealAllJobs] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  const [aiMatchedJobs, setAiMatchedJobs] = useState<any[]>([]);
  const [loadingAi, setLoadingAi] = useState(true);

  const getCleanSchedule = (job: any) => {
    if (job.time_slot) {
      let days = [];
      try {
        days = JSON.parse(job.available_days) || [];
      } catch (e) {
        days = [];
      }
      return `${days.join(', ')} (${job.time_slot})`;
    }
    return 'Flexible';
  };

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
    const fetchStudentData = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          if (profile && profile.student_name) {
            const firstName = profile.student_name.split(' ')[0];
            setStudentName(firstName);
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    const fetchNearbyJobsFromAPI = async () => {
      try {
        const response = await api.get('/student/nearby-jobs');
        if (response.data && response.data.status === 'success') {
          setRealNearbyJobs(response.data.jobs);
        }
      } catch (error) {
        console.error('Error fetching nearby jobs:', error);
      } finally {
        setLoadingNearby(false);
      }
    };

    const fetchAllJobsFromAPI = async () => {
      try {
        const response = await api.get('/student/all-jobs');
        if (response.data && response.data.status === 'success') {
          setRealAllJobs(response.data.jobs);
        }
      } catch (error) {
        console.error('Error fetching all jobs:', error);
      } finally {
        setLoadingAll(false);
      }
    };

    const fetchAiMatchedJobsFromAPI = async () => {
      try {
        const response = await api.get('/student/ai-matched-jobs');
        if (response.data && response.data.status === 'success') {
          setAiMatchedJobs(response.data.matched_jobs);
        }
      } catch (error) {
        console.error('Error fetching AI matched jobs:', error);
      } finally {
        setLoadingAi(false);
      }
    };

    fetchStudentData();
    fetchNearbyJobsFromAPI();
    fetchAllJobsFromAPI();
    fetchAiMatchedJobsFromAPI();
  }, []);

  const handleJobPress = (jobId: string) => {
    router.push(`/students/job-details?id=${jobId}`);
  };

  const filterBySearch = (jobs: any[]) => {
    if (!searchQuery.trim()) return jobs;
    return jobs.filter(
      (job) =>
        job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const currentJobsList =
    activeTab === 'nearby'
      ? filterBySearch(realNearbyJobs)
      : activeTab === 'ai_match'
        ? filterBySearch(aiMatchedJobs)
        : filterBySearch(realAllJobs);

  const isCurrentLoading =
    activeTab === 'nearby' ? loadingNearby : activeTab === 'ai_match' ? loadingAi : loadingAll;

  const renderHeader = () => (
    <View>
      <View className="flex-row justify-between items-center px-6 pt-12 pb-4">
        <View>
          <Text className="text-2xl font-bold text-slate-900">Hello, {studentName} 👋</Text>
          <Text className="text-xs text-slate-500 mt-[2px]">Find your perfect student job today!</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications')}>
          <View className="relative p-2">
            <MaterialIcons name="notifications" size={24} color={Colors.text} />
            <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-600 border-[1.5px] border-[#F8FAFC]" />
          </View>
        </TouchableOpacity>
      </View>
      <View className="px-6 mb-4">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilter={() => { }}
        />
      </View>

      <View className="flex-row px-6 gap-2 mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab('all')}
          className={`flex-1 py-2.5 rounded-xl border items-center ${activeTab === 'all' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
            }`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'all' ? 'text-white' : 'text-slate-700'}`}>
            All Jobs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('nearby')}
          className={`flex-1 py-2.5 rounded-xl border items-center ${activeTab === 'nearby' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
            }`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'nearby' ? 'text-white' : 'text-slate-700'}`}>
            Nearby (5km)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('ai_match')}
          className={`flex-1 py-2.5 rounded-xl border items-center flex-row justify-center gap-1 ${activeTab === 'ai_match' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
            }`}
        >
          <MaterialIcons name="auto-awesome" size={14} color={activeTab === 'ai_match' ? '#fff' : '#dc2626'} />
          <Text className={`text-xs font-bold ${activeTab === 'ai_match' ? 'text-white' : 'text-slate-700'}`}>
            AI Match
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
      >
        {renderHeader()}

        <View className="px-6 mt-2">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-slate-900">
              {activeTab === 'nearby' ? 'Nearby Openings' : activeTab === 'ai_match' ? 'AI Schedule Matches' : 'All Job Openings'}
            </Text>
            <Text className="text-xs text-slate-500">
              <Text>{currentJobsList.length}</Text>
              <Text> found</Text>
            </Text>
          </View>

          {isCurrentLoading ? (
            <ActivityIndicator size="large" color="#dc2626" style={{ marginVertical: 40 }} />
          ) : currentJobsList.length === 0 ? (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="work-off" size={48} color="#94a3b8" />
              <Text className="text-slate-500 text-center mt-3 text-sm">
                {activeTab === 'ai_match'
                  ? 'No jobs match your schedule/location preference right now.'
                  : 'No jobs available.'}
              </Text>
            </View>
          ) : (
            currentJobsList.map((job) => (
              <View key={job.id} className="mb-3">
                {/* AI Badge is temporarily commented out */}
                {activeTab === 'ai_match' && (
                  <View className="bg-red-50 px-3 py-1 rounded-t-xl self-start border-t border-x border-red-200 flex-row items-center gap-1">
                    <MaterialIcons name="auto-awesome" size={12} color="#dc2626" />
                    <Text className="text-xs font-bold text-red-600">
                      <Text>{job.match_percentage ?? 0}</Text>
                      <Text>% Schedule Match</Text>
                    </Text>
                  </View>
                )}
                {/* JobCard is active */}
                <JobCard
                  job={{
                    ...job,
                    jobTitle: job.title,
                    companyName: job.household?.household_name || job.employer?.employer_name || 'Employer',
                    salary: `₱${job.salary}`,
                    location: job.household?.location || job.employer?.location || 'Pinamalayan',
                    distance: job.distance ? `${parseFloat(job.distance).toFixed(1)} km away` : 'Calculating...',
                    schedule: getCleanSchedule(job),
                    workingHours: getCleanSchedule(job),
                    jobType: 'Part-time',
                    category: job.category || 'General',
                    requirements: parseJsonField(job.requirements),
                    skills: parseJsonField(job.skills),
                  }}
                  onPress={() => handleJobPress(job.id.toString())}
                  onApply={() => router.push(`/students/job-details?id=${job.id}`)}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}