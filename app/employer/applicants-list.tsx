import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios'; 
import { useDarkMode } from '@/hooks/useDarkMode';

const FILTER_TABS = ['All', 'Pending', 'Viewed', 'Interview', 'Accepted', 'Rejected', 'Cancelled'] as const;

export default function ApplicantsListScreen() {
  const { isDark, colors } = useDarkMode();
  const { jobId, jobTitle } = useLocalSearchParams<{ jobId?: string; jobTitle?: string }>();
  
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');


  const fetchApplicants = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const url = jobId ? `/employer/jobs/${jobId}/applicants` : '/employer/applicants';
      const response = await api.get(url);

      if (response.data && response.data.status === 'success') {
        setApplicants(response.data.applicants || []);
      }
    } catch (error) {
      if (!isBackground) console.error('Error fetching applicants:', error);
    } finally {
      if (!isBackground) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      fetchApplicants(false);

      // Live auto-polling bawat 2.5 seconds para hindi na kailangang mag-back
      const pollInterval = setInterval(() => {
        if (isMounted) fetchApplicants(true);
      }, 2500);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
      };
    }, [jobId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplicants(false);
  };

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
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View 
        className="px-6 pt-12 pb-4 border-b"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <View className="flex-row items-center mb-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold" numberOfLines={1} style={{ color: colors.text }}>
              {jobTitle ? `Applicants for ${jobTitle}` : 'All Applicants'}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View 
          className="flex-row items-center rounded-xl px-4 py-2.5 border mt-2"
          style={{ 
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
            borderColor: colors.border 
          }}
        >
          <MaterialIcons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by name or position..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-sm p-0"
            style={{ color: colors.text }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
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
                className="flex-row items-center px-4 py-2 rounded-full border gap-1.5"
                style={{
                  backgroundColor: isActive ? '#DC2626' : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF'),
                  borderColor: isActive ? '#DC2626' : colors.border,
                }}
              >
                <Text 
                  className="text-xs font-semibold"
                  style={{ color: isActive ? '#FFFFFF' : colors.textSecondary }}
                >
                  {filter}
                </Text>
                <View 
                  className="rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: isActive ? 'rgba(255, 255, 255, 0.3)' : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9') }}
                >
                  <Text 
                    className="text-[10px] font-bold"
                    style={{ color: isActive ? '#FFFFFF' : colors.textSecondary }}
                  >
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#dc2626']} tintColor={isDark ? '#FFFFFF' : '#DC2626'} />}
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
                className="flex-row rounded-2xl p-4 mb-3 shadow-sm items-center border"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                onPress={() => router.push(`/employer/applicant-details?applicationId=${app.id}` as any)}
                activeOpacity={0.7}
              >
                <View className="mr-4">
                  <Avatar 
                    uri={app.student?.avatar}
                    name={app.student?.student_name} 
                    size={50} 
                  />
                </View>

                <View className="flex-1 justify-center pr-2">
                  <Text className="text-base font-bold" numberOfLines={1} style={{ color: colors.text }}>
                    {app.student?.student_name || 'Unknown Candidate'}
                  </Text>
                  <Text className="text-xs font-semibold mt-0.5" numberOfLines={1} style={{ color: isDark ? colors.accent : '#DC2626' }}>
                    {app.job?.title || 'General Application'}
                  </Text>
                  <Text className="text-xs mt-1" numberOfLines={1} style={{ color: colors.textSecondary }}>
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
                        : 'error'
                    }
                  />
                  <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View 
            className="items-center justify-center py-24 rounded-2xl border border-dashed mt-4"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View 
              className="w-14 h-14 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC' }}
            >
              <MaterialIcons name="person-off" size={28} color={colors.textSecondary} />
            </View>
            <Text className="text-base font-bold" style={{ color: colors.text }}>No applicants found</Text>
            <Text className="text-xs mt-1 text-center px-6" style={{ color: colors.textSecondary }}>
              {searchQuery ? 'Try checking your search spelling or filter criteria.' : 'There are no applicants under this category yet.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
