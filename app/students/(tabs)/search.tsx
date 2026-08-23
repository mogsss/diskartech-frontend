import JobCard from '@/components/ui/JobCard';
import SearchBar from '@/components/ui/SearchBar';
import Chip from '@/components/ui/Chip';
import { Colors } from '@/constants/colors';
import { router } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import api from '@/api/axios';

const salaryFilters = ['₱50-₱75/hr', '₱75-₱100/hr', '₱100-₱150/hr', '₱150+/hr'];
const distanceFilters = ['< 1 km', '< 3 km', '< 5 km', 'Any'];
const scheduleFilters = ['Flexible', 'Morning', 'Evening', 'Midnight', 'Weekends'];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // States para sa mga karagdagang filters
  const [selectedSalary, setSelectedSalary] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);

  // States para sa API data
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchJobsData = async () => {
    try {
      const response = await api.get('/student/all-jobs');
      if (response.data && response.data.status === 'success') {
        setAllJobs(response.data.jobs);
      }

      // Kunin ang saved jobs para malaman kung alin ang naka-pula
      const savedResponse = await api.get('/student/saved-jobs');
      if (savedResponse.data && savedResponse.data.status === 'success') {
        setSavedJobs(savedResponse.data.jobs);
      }
    } catch (error) {
      console.error('Error fetching jobs for search:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchJobsData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobsData();
    setRefreshing(false);
  };

  // Function para i-toggle ang bookmark direkta sa Search screen
  const handleToggleBookmark = async (jobId: string) => {
    try {
      const response = await api.post('/student/toggle-save-job', { job_id: jobId });
      if (response.data && response.data.status === 'success') {
        // I-refresh ang saved jobs para mag-update agad ang pulang icon
        const savedResponse = await api.get('/student/saved-jobs');
        if (savedResponse.data && savedResponse.data.status === 'success') {
          setSavedJobs(savedResponse.data.jobs);
        }
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Paalala', 'Hindi ma-update ang saved jobs.');
    }
  };

  // Pinagsamang filtering logic para sa totoong API data
  const filteredJobs = allJobs.filter((job) => {
    const companyName = job.household?.household_name || job.employer?.employer_name || 'Employer';
    const locationName = job.household?.location || job.employer?.location || 'Pinamalayan';

    const matchesSearch = searchQuery
      ? job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        locationName.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesCategory = selectedCategory
      ? job.category?.toLowerCase() === selectedCategory.toLowerCase()
      : true;

    const matchesSchedule = selectedSchedule
      ? (job.time_slot && job.time_slot.toLowerCase().includes(selectedSchedule.toLowerCase())) ||
        (job.available_days && job.available_days.toLowerCase().includes(selectedSchedule.toLowerCase()))
      : true;

    return matchesSearch && matchesCategory && matchesSchedule;
  });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900">Find Jobs</Text>
      </View>

      <View className="px-6 mb-2">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilter={() => setShowFilters(!showFilters)}
        />
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 mb-2"
        contentContainerClassName="px-6 gap-2"
      >
        {['All', 'Food Service', 'Retail', 'Tutoring', 'Delivery', 'Admin', 'Freelance'].map(
          (cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={selectedCategory === cat || (cat === 'All' && !selectedCategory)}
              onPress={() => setSelectedCategory(cat === 'All' ? null : cat)}
            />
          )
        )}
      </ScrollView>

      {/* Filters Section */}
      {showFilters && (
        <View className="bg-white mx-6 rounded-2xl p-4 mb-2 shadow-sm">
          {/* Salary Range */}
          <Text className="text-xs font-bold text-slate-900 mb-2 mt-2 uppercase tracking-wider">Salary Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-2">
            {salaryFilters.map((f) => {
              const isSelected = selectedSalary === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedSalary(isSelected ? null : f)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Distance */}
          <Text className="text-xs font-bold text-slate-900 mb-2 mt-2 uppercase tracking-wider">Distance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-2">
            {distanceFilters.map((f) => {
              const isSelected = selectedDistance === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedDistance(isSelected ? null : f)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Schedule */}
          <Text className="text-xs font-bold text-slate-900 mb-2 mt-2 uppercase tracking-wider">Schedule</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-2">
            {scheduleFilters.map((f) => {
              const isSelected = selectedSchedule === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedSchedule(isSelected ? null : f)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Results */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#dc2626']} />}
      >
        <Text className="text-xs text-slate-500 mb-4">{filteredJobs.length} jobs found</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#dc2626" style={{ marginVertical: 40 }} />
        ) : filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <JobCard
              key={job.id}
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
                bookmarked: savedJobs.some((saved: any) => saved.id === job.id),
                // 👇 Idinagdag dito ang applicants count at posted date para maging consistent sa Home screen
                applicants: job.applications_count ?? 0,
                postedDate: job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Recent',
              }}
              onPress={() => router.push(`/students/job-details?id=${job.id}`)}
              onBookmark={() => handleToggleBookmark(job.id.toString())}
              onApply={() => router.push(`/students/job-details?id=${job.id}`)}
            />
          ))
        ) : (
          <Text className="text-slate-400 text-center py-8">No jobs found matching your criteria.</Text>
        )}
      </ScrollView>
    </View>
  );
}