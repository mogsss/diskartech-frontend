import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios'; 

const FILTER_TABS = ['All', 'Pending', 'Viewed', 'Interview', 'Accepted', 'Rejected', 'Cancelled'] as const;

export default function ApplicantsListScreen() {
  const { jobId, jobTitle } = useLocalSearchParams<{ jobId?: string; jobTitle?: string }>();
  
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  const STORAGE_URL = api.defaults.baseURL ? api.defaults.baseURL.replace('/api', '/storage/') : 'http://192.168.1.2:8000/storage/';

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchApplicants = async () => {
        try {
          const url = jobId ? `/employer/jobs/${jobId}/applicants` : '/employer/applicants';
          const response = await api.get(url);

          if (isMounted && response.data && response.data.status === 'success') {
            setApplicants(response.data.applicants || []);
          }
        } catch (error) {
          console.error('Error fetching applicants:', error);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchApplicants();
      return () => {
        isMounted = false;
      };
    }, [jobId])
  );

  // Filter logic
  const filteredApplicants = applicants.filter((app) => {
    const name = app.student?.student_name || 'Unknown Student';
    const position = app.job?.title || app.position || 'N/A';
    const status = app.status ? app.status.toLowerCase() : '';

    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      position.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedFilter.toLowerCase() === 'all' ||
      status === selectedFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-900" numberOfLines={1}>
              {jobTitle ? `Applicants for ${jobTitle}` : 'All Applicants'}
            </Text>
            <Text className="text-xs text-slate-500 mt-[2px]">Manage and review job candidates</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-50 rounded-xl px-4 py-2.5 border border-gray-200 mt-2">
          <MaterialIcons name="search" size={20} color={Colors.gray400} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by name or position..."
            placeholderTextColor={Colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-sm text-slate-900 p-0"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color={Colors.gray400} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips na may Cancelled Tab at Counts */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mt-4" contentContainerClassName="gap-2 items-center">
          {FILTER_TABS.map((filter) => {
            const isActive = selectedFilter === filter;
            
            const count = filter === 'All' 
              ? applicants.length 
              : applicants.filter((a) => a.status?.toLowerCase() === filter.toLowerCase()).length;

            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.7}
                className={`flex-row items-center px-4 py-2 rounded-full border gap-1.5 ${
                  isActive ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                  {filter}
                </Text>
                <View className={`rounded-full px-1.5 py-0.5 ${isActive ? 'bg-white/30' : 'bg-gray-100'}`}>
                  <Text className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List of Applicants */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#DC2626" />
          </View>
        ) : filteredApplicants.length > 0 ? (
          filteredApplicants.map((app) => {
            const currentStatus = app.status ? app.status.toLowerCase() : 'pending';
            const formattedStatus = currentStatus === 'interview' 
              ? 'For Interview' 
              : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);

            return (
              <TouchableOpacity
                key={app.id}
                className="flex-row bg-white rounded-2xl p-4 mb-3 shadow-sm items-center border border-gray-100"
                onPress={() => router.push(`/employer/applicant-details?applicationId=${app.id}` as any)}
                activeOpacity={0.7}
              >
                <View className="mr-4">
                  <Avatar 
                    uri={app.student?.avatar ? `${STORAGE_URL}${app.student.avatar}` : undefined} 
                    name={app.student?.student_name} 
                    size={50} 
                  />
                </View>

                <View className="flex-1 justify-center pr-2">
                  <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                    {app.student?.student_name || 'Unknown Candidate'}
                  </Text>
                  <Text className="text-xs text-red-600 font-semibold mt-0.5" numberOfLines={1}>
                    {app.job?.title || 'General Application'}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-1" numberOfLines={1}>
                    {app.student?.student_school_name || 'No school specified'}
                  </Text>
                </View>

                <View className="items-end gap-2">
                  <Badge
                    text={formattedStatus}
                    variant={
                      currentStatus === 'pending' 
                        ? 'default' 
                        : currentStatus === 'viewed' 
                        ? 'info' 
                        : currentStatus === 'interview'
                        ? 'warning'
                        : currentStatus === 'accepted' || currentStatus === 'completed'
                        ? 'success' 
                        : 'error' // Sasalo sa rejected at cancelled para maging kulay pula/error
                    }
                  />
                  <MaterialIcons name="chevron-right" size={20} color={Colors.gray400} />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View className="items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200 mt-4">
            <View className="w-14 h-14 rounded-full bg-slate-50 items-center justify-center mb-3">
              <MaterialIcons name="person-off" size={28} color={Colors.gray400} />
            </View>
            <Text className="text-base font-bold text-slate-800">No applicants found</Text>
            <Text className="text-xs text-slate-400 mt-1 text-center px-6">
              {searchQuery ? 'Try checking your search spelling or filter criteria.' : 'There are no applicants under this category yet.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}