import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

// Shared mock list ng mga aplikante para tugma ang bilang
const allApplicants = [
  { id: '1', name: 'Junnyl Mabini', position: 'Service Crew', status: 'pending' },
  { id: '2', name: 'Ana Santos', position: 'Barista', status: 'accepted' },
  { id: '3', name: 'Carlos Reyes', position: 'Sales Associate', status: 'pending' },
  { id: '4', name: 'Maria Santos', position: 'Household Kasambahay', status: 'pending' },
  { id: '5', name: 'Juan Dela Cruz', position: 'Family Driver', status: 'accepted' },
  { id: '6', name: 'John Doe', position: 'Service Crew', status: 'accepted' },
];

const businessJobs = [
  { id: '1', title: 'Service Crew', status: 'active', salary: '₱75 - ₱95/hr', type: 'Part-time' },
  { id: '2', title: 'Barista', status: 'active', salary: '₱80 - ₱100/hr', type: 'Full-time' },
  { id: '3', title: 'Cashier', status: 'active', salary: '₱70 - ₱85/hr', type: 'Part-time' },
  { id: '4', title: 'Service Crew (Night)', status: 'closed', salary: '₱85 - ₱110/hr', type: 'Night Shift' },
];

const householdJobs = [
  { id: 'h1', title: 'Household Kasambahay', status: 'active', salary: '₱8,000 - ₱10,000/mo', type: 'Live-in' },
  { id: 'h2', title: 'Family Driver', status: 'active', salary: '₱12,000 - ₱15,000/mo', type: 'Full-time' },
];

export default function EmployerJobsScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const initialJobs = isHousehold ? householdJobs : businessJobs;
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'active') return job.status === 'active';
    if (filter === 'closed') return job.status === 'closed';
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
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => {
            // Bilangin kung ilan ang tugma sa posisyong ito mula sa allApplicants list
            const applicantCount = allApplicants.filter(
              (app) => app.position.toLowerCase() === job.title.toLowerCase()
            ).length;

            return (
              <View 
                key={job.id} 
                className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-base font-bold text-slate-900">{job.title}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">{job.salary} • {job.type}</Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${
                    job.status === 'active' ? 'bg-emerald-50' : 'bg-red-50'
                  }`}>
                    <Text className={`text-[10px] font-bold uppercase ${
                      job.status === 'active' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {job.status}
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-100">
                  <View className="flex-row items-center gap-1.5">
                    <MaterialIcons name="people" size={16} color={Colors.gray500} />
                    <Text className="text-xs font-semibold text-slate-700">{applicantCount} Applicants</Text>
                  </View>

                  <TouchableOpacity 
                    onPress={() => router.push(`/employer/applicants-list?jobTitle=${encodeURIComponent(job.title)}`)}
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
            <MaterialIcons name="work-off" size={48} color={Colors.gray400} />
            <Text className="text-sm font-semibold text-slate-600 mt-2">No jobs found</Text>
            <Text className="text-xs text-slate-400 mt-1">Try changing the filter or post a new job.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}