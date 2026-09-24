import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/colors';
import JobCard from '@/components/ui/JobCard';
import SearchBar from '@/components/ui/SearchBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';

export default function HomeScreen() {
  const [studentName, setStudentName] = useState('Student');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'nearby' | 'ai_match' | 'saved'>('all');

  const [realNearbyJobs, setRealNearbyJobs] = useState<any[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(true);

  const [realAllJobs, setRealAllJobs] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  const [aiMatchedJobs, setAiMatchedJobs] = useState<any[]>([]);
  const [matchedSource, setMatchedSource] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(true);

  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const formatJobsWithBookmark = (jobsList: any[], savedList: any[]) => {
    const savedIds = new Set(savedList.map((s: any) => s.id));
    return jobsList.map((job) => ({
      ...job,
      bookmarked: savedIds.has(job.id),
    }));
  };

  const fetchNearbyJobsFromAPI = async (currentSaved: any[] = savedJobs) => {
    try {
      const response = await api.get('/student/nearby-jobs');
      if (response.data && response.data.status === 'success') {
        setRealNearbyJobs(formatJobsWithBookmark(response.data.jobs, currentSaved));
      }
    } catch (error) {
      console.error('Error fetching nearby jobs:', error);
    } finally {
      setLoadingNearby(false);
    }
  };

  const fetchAllJobsFromAPI = async (currentSaved: any[] = savedJobs) => {
    try {
      const response = await api.get('/student/all-jobs');
      if (response.data && response.data.status === 'success') {
        setRealAllJobs(formatJobsWithBookmark(response.data.jobs, currentSaved));
      }
    } catch (error) {
      console.error('Error fetching all jobs:', error);
    } finally {
      setLoadingAll(false);
    }
  };

  const fetchAiMatchedJobsFromAPI = async (currentSaved: any[] = savedJobs) => {
    try {
      const response = await api.get('/student/ai-matched-jobs');
      if (response.data && response.data.status === 'success') {
        setAiMatchedJobs(formatJobsWithBookmark(response.data.matched_jobs, currentSaved));
        setMatchedSource(response.data.matched_by);
      }
    } catch (error) {
      console.error('Error fetching AI matched jobs:', error);
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchSavedJobs = async () => {
    setLoadingSaved(true);
    try {
      const response = await api.get('/student/saved-jobs');
      if (response.data && response.data.status === 'success') {
        const fetchedSaved = response.data.jobs.map((job: any) => ({ ...job, bookmarked: true }));
        setSavedJobs(fetchedSaved);
        return fetchedSaved;
      }
    } catch (error) {
      console.error('Error fetching saved jobs:', error);
    } finally {
      setLoadingSaved(false);
    }
    return [];
  };

  const loadAllData = async () => {
    await fetchStudentData();
    const saved = await fetchSavedJobs();
    await Promise.all([
      fetchAllJobsFromAPI(saved),
      fetchNearbyJobsFromAPI(saved),
      fetchAiMatchedJobsFromAPI(saved),
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const handleJobPress = (jobId: string) => {
    router.push(`/students/job-details?id=${jobId}`);
  };

  const handleToggleBookmark = async (jobId: string) => {
    try {
      const response = await api.post('/student/toggle-save-job', { job_id: jobId });
      if (response.data && response.data.status === 'success') {
        await fetchSavedJobs();

        setRealAllJobs((prev) =>
          prev.map((job) =>
            job.id.toString() === jobId.toString()
              ? { ...job, bookmarked: !job.bookmarked }
              : job
          )
        );
        setRealNearbyJobs((prev) =>
          prev.map((job) =>
            job.id.toString() === jobId.toString()
              ? { ...job, bookmarked: !job.bookmarked }
              : job
          )
        );
        setAiMatchedJobs((prev) =>
          prev.map((job) =>
            job.id.toString() === jobId.toString()
              ? { ...job, bookmarked: !job.bookmarked }
              : job
          )
        );
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Paalala', 'Hindi ma-update ang saved jobs.');
    }
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
        : activeTab === 'saved'
          ? filterBySearch(savedJobs)
          : filterBySearch(realAllJobs);

  const isCurrentLoading =
    activeTab === 'nearby'
      ? loadingNearby
      : activeTab === 'ai_match'
        ? loadingAi
        : activeTab === 'saved'
          ? loadingSaved
          : loadingAll;

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 mb-4">
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => setActiveTab('all')}
            className={`px-4 py-2.5 rounded-xl border items-center ${activeTab === 'all' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'}`}
          >
            <Text className={`text-xs font-bold ${activeTab === 'all' ? 'text-white' : 'text-slate-700'}`}>
              All Jobs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('nearby')}
            className={`px-4 py-2.5 rounded-xl border items-center ${activeTab === 'nearby' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'}`}
          >
            <Text className={`text-xs font-bold ${activeTab === 'nearby' ? 'text-white' : 'text-slate-700'}`}>
              Nearby (5km)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('ai_match')}
            className={`px-4 py-2.5 rounded-xl border items-center flex-row gap-1 ${activeTab === 'ai_match' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'}`}
          >
            <MaterialIcons name="auto-awesome" size={14} color={activeTab === 'ai_match' ? '#fff' : '#dc2626'} />
            <Text className={`text-xs font-bold ${activeTab === 'ai_match' ? 'text-white' : 'text-slate-700'}`}>
              AI Match
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('saved')}
            className={`px-4 py-2.5 rounded-xl border items-center flex-row gap-1 ${activeTab === 'saved' ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'}`}
          >
            <MaterialIcons name="bookmark" size={14} color={activeTab === 'saved' ? '#fff' : '#dc2626'} />
            <Text className={`text-xs font-bold ${activeTab === 'saved' ? 'text-white' : 'text-slate-700'}`}>
              Saved
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#dc2626']} />}
      >
        {renderHeader()}

        <View className="px-6 mt-2">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-slate-900">
                {activeTab === 'nearby'
                  ? 'Nearby Openings'
                  : activeTab === 'ai_match'
                    ? 'Smart Job Matches'
                    : activeTab === 'saved'
                      ? 'Saved Jobs'
                      : 'All Job Openings'}
              </Text>
              {activeTab === 'ai_match' && !loadingAi && currentJobsList.length > 0 && (
                <Text className="text-[10px] text-slate-400 mt-[-2px]">
                  Powered by: {matchedSource === 'ai_skills_schedule' ? '✨ Gemini AI (Skills & Schedule)' : '🛡️ System Fallback Math'}
                </Text>
              )}
            </View>
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
                  ? 'No matching jobs found for your skills and schedule.'
                  : activeTab === 'saved'
                    ? 'No saved jobs found. Bookmark jobs to see them here.'
                    : 'No jobs available.'}
              </Text>
            </View>
          ) : (
            currentJobsList.map((job) => {
              const rawAvatar = job.household?.avatar || job.employer?.avatar || '';
              const companyAvatar = rawAvatar
                ? (rawAvatar.startsWith('http') ? rawAvatar : `http://192.168.1.2:8000/storage/${rawAvatar}`)
                : '';

              return (
                <View key={job.id} className="mb-3">
                  {activeTab === 'ai_match' && (
                    <View className="bg-red-50 px-3 py-1 rounded-t-xl self-start border-t border-x border-red-200 flex-row items-center gap-1">
                      <MaterialIcons name="auto-awesome" size={12} color="#dc2626" />
                      <Text className="text-xs font-bold text-red-600">
                        <Text>{job.match_percentage ?? 0}</Text>
                        <Text>% Skills & Schedule Match</Text>
                      </Text>
                    </View>
                  )}
                  <JobCard
                    job={{
                      ...job,
                      jobTitle: job.title,
                      companyName: job.household?.household_name || job.employer?.employer_name || 'Employer',
                      companyLogo: companyAvatar,
                      salary: `₱${job.salary}`,
                      location: job.household?.location || job.employer?.location || 'Pinamalayan',
                      distance: job.distance ? `${parseFloat(job.distance).toFixed(1)} km away` : 'Calculating...',
                      schedule: getCleanSchedule(job),
                      workingHours: getCleanSchedule(job),
                      jobType: 'Part-time',
                      category: job.category || 'General',
                      requirements: parseJsonField(job.requirements),
                      skills: parseJsonField(job.skills),
                      bookmarked: job.bookmarked ?? false,
                      applicants: job.applications_count ?? 0,
                      postedDate: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recent',
                    }}
                    onPress={() => handleJobPress(job.id.toString())}
                    onBookmark={() => handleToggleBookmark(job.id.toString())}
                    onApply={() => router.push(`/students/job-details?id=${job.id}`)}
                  />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}