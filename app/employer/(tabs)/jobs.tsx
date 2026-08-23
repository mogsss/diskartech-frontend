import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios'; // Siguraduhing tama ang path ng iyong axios instance

export default function EmployerJobsScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  // Fetch employer jobs galing sa Laravel backend
  useEffect(() => {
    const fetchEmployerJobs = async () => {
      try {
        const response = await api.get('/employer/jobs');
        if (response.data && response.data.status === 'success') {
          // Kung gusto mong i-filter depende kung business o household (kung may category column ka)
          let fetchedJobs = response.data.jobs;
          
          if (isHousehold) {
            fetchedJobs = fetchedJobs.filter((j: any) => j.category?.toLowerCase().includes('household') || j.category?.toLowerCase().includes('home'));
          } else {
            fetchedJobs = fetchedJobs.filter((j: any) => !j.category?.toLowerCase().includes('household') && !j.category?.toLowerCase().includes('home'));
          }

          // Kung gusto mo namang ipakita lahat ng pinost niya nang walang filter sa category, 
          // pwede mo ring gamitin direkta ang response.data.jobs:
          setJobs(response.data.jobs);
        }
      } catch (error) {
        console.error('Error fetching employer jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployerJobs();
  }, [isHousehold]);

  const filteredJobs = jobs.filter((job) => {
    const status = job.status ? job.status.toLowerCase() : 'active';
    if (filter === 'active') return status === 'active';
    if (filter === 'closed') return status === 'closed';
    return true;
  });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold text-slate-950">
              {isHousehold ? 'Household Openings' : 'Job Listings'}
            </Text>
            <Text className="text-xs text-slate-500 mt-[2px]">
              {isHousehold ? 'Manage and monitor your home service listings' : 'Manage and monitor your job postings'}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/employer/job-posting')}
            className="bg-red-600 px-4 py-2.5 rounded-full flex-row items-center gap-1.5 shadow-sm"
          >
            <MaterialIcons name="add" size={18} color={Colors.white} />
            <Text className="text-xs font-semibold text-white">
              {isHousehold ? 'Post Opening' : 'Post Job'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row gap-2 mt-4">
          {(['all', 'active', 'closed'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full border ${
                filter === tab 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className={`text-xs font-semibold capitalize ${
                filter === tab ? 'text-red-600' : 'text-slate-600'
              }`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Jobs List */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#dc2626" style={{ marginVertical: 40 }} />
        ) : filteredJobs.length > 0 ? (
          filteredJobs.map((job) => {
            // Makukuha na rito ang applications_count galing sa withCount('applications') sa ating Laravel controller!
            const applicantCount = job.applications_count || 0;
            const jobStatus = job.status || 'active';

            return (
              <View 
                key={job.id} 
                className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-base font-bold text-slate-900">{job.title}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">₱{job.salary} • {job.category || 'General'}</Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${
                    jobStatus === 'active' ? 'bg-emerald-50' : 'bg-red-50'
                  }`}>
                    <Text className={`text-[10px] font-bold uppercase ${
                      jobStatus === 'active' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {jobStatus}
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-100">
                  <View className="flex-row items-center gap-1.5">
                    <MaterialIcons name="people" size={16} color="#64748b" />
                    <Text className="text-xs font-semibold text-slate-700">{applicantCount} Applicants</Text>
                  </View>

                  <TouchableOpacity 
                    onPress={() => router.push(`/employer/applicants-list?jobId=${job.id}&jobTitle=${encodeURIComponent(job.title)}`)}
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-xs font-semibold text-red-600">View Applicants</Text>
                    <MaterialIcons name="chevron-right" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View className="items-center justify-center py-20">
            <MaterialIcons name="work-off" size={48} color="#94a3b8" />
            <Text className="text-sm font-semibold text-slate-600 mt-2">No jobs found</Text>
            <Text className="text-xs text-slate-400 mt-1">Try changing the filter or post a new job.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}