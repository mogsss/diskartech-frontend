import api, { STORAGE_URL } from '@/api/axios';
import JobDetailsModal from '@/components/employer/modals/JobDetailsModal';
import EmployerTabBarSpacer from '@/components/employer/EmployerTabBarSpacer';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import DrawerMenuButton from '@/components/ui/DrawerMenuButton';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryUnit } from '@/utils/jobRate';
import { JobQuota, jobQuotaAvailability, jobQuotaMessage, jobQuotaUsage, normalizeJobQuota } from '@/utils/jobQuota';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type JobFilterTab = 'all' | 'active' | 'closed';

function isJobActive(job: any): boolean {
  if (job.status === undefined || job.status === null || String(job.status).trim() === '') return true;
  const s = String(job.status).toLowerCase().trim();
  if (s === 'closed' || s === 'inactive' || s === 'archived' || s === '0' || s === 'false') {
    return false;
  }
  return true;
}

function formatWorkDays(value: unknown): string {
  let days = value;
  if (typeof value === 'string') {
    try {
      days = JSON.parse(value);
    } catch {
      return value.trim() || 'Not specified';
    }
  }
  if (!Array.isArray(days)) return 'Not specified';
  return days.filter((day) => typeof day === 'string' && day.trim()).map((day) => day.trim()).join(', ') || 'Not specified';
}

function formatDailyRate(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return 'Rate not set';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? '\u20B1' + amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })
    : 'Rate not set';
}

function getApplicantCount(job: any): number {
  const count = Number(job.applications_count ?? (Array.isArray(job.applications) ? job.applications.length : 0));
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

export default function EmployerJobsScreen() {
  const { colors, isDark } = useDarkMode();
  const accentColor = isDark ? colors.accent : '#B91C1C';
  const accentBackground = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2';
  const mutedBackground = isDark ? colors.background : '#F8FAFC';
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<JobFilterTab>('all');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [jobQuota, setJobQuota] = useState<JobQuota | null>(null);
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    avatarUri?: string | null;
    avatarInitials?: string;
    rejectionReason?: string | null;
  }>({
    name: isHousehold ? 'Household Employer' : 'Business Employer',
  });

  const [notificationConfig, setNotificationConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: any;
    iconColor?: string;
    iconBgColor?: string;
    primaryButtonText?: string;
    onPrimaryPress: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onPrimaryPress: () => {},
  });

  // Fetch employer verification & jobs galing sa Laravel backend
  const fetchEmployerJobs = useCallback(async () => {
    try {
      const profileRes = await api.get('/user/profile').catch(() => null);
      let prof = profileRes?.data?.profile;
      if (!prof) {
        const stored = await AsyncStorage.getItem('userProfile');
        if (stored) prof = JSON.parse(stored);
      }
      if (prof) {
        const verified = prof.isVerified === 1 || prof.isVerified === true;
        setIsVerified(verified);
        const resolvedName = isHousehold
          ? (prof.household_name || prof.name || 'Household Employer')
          : (prof.employer_name || prof.business_name || prof.name || 'Business Employer');
        const nameParts = resolvedName.trim().split(' ');
        const initials = nameParts.length >= 2
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : (isHousehold ? 'VF' : 'MD');
        const avatarUrl = prof.avatar
          ? (prof.avatar.startsWith('http') ? prof.avatar : `${STORAGE_URL}${prof.avatar}`)
          : null;
        setUserProfile({
          name: resolvedName,
          avatarUri: avatarUrl,
          avatarInitials: initials,
          rejectionReason: prof.rejection_reason || null,
        });
      }

      const response = await api.get('/employer/jobs');
      if (response.data && response.data.status === 'success') {
        const fetched = response.data.jobs || [];
        setJobs(fetched);
        setJobQuota(normalizeJobQuota(response.data.job_quota));
      }
    } catch (error) {
      console.error('Error fetching employer jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isHousehold]);

  useFocusEffect(
    useCallback(() => {
      fetchEmployerJobs();
      const interval = setInterval(() => {
        fetchEmployerJobs();
      }, 3500);

      return () => {
        clearInterval(interval);
      };
    }, [fetchEmployerJobs])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEmployerJobs();
  }, [fetchEmployerJobs]);

  const allCount = jobs.length;
  const activeCount = useMemo(() => jobs.filter(isJobActive).length, [jobs]);
  const closedCount = useMemo(() => jobs.filter((j) => !isJobActive(j)).length, [jobs]);

  const filteredJobs = useMemo(() => {
    if (filter === 'active') {
      return jobs.filter(isJobActive);
    }
    if (filter === 'closed') {
      return jobs.filter((j) => !isJobActive(j));
    }
    return jobs;
  }, [jobs, filter]);

  const handlePostJob = () => {
    if (!isVerified) {
      setNotificationConfig({
        visible: true,
        title: 'Verification Required',
        message: 'Upload required documents to post a job.',
        iconName: 'verified-user',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'Upload Documents',
        onPrimaryPress: () => {
          setNotificationConfig((prev) => ({ ...prev, visible: false }));
          router.push({
            pathname: '/employer/verification-status',
            params: { type: isHousehold ? 'household' : 'business' },
          });
        },
        secondaryButtonText: 'Cancel',
        onSecondaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }
    if (!isHousehold && jobQuota && !jobQuota.can_post_job) {
      setNotificationConfig({
        visible: true, title: 'Job Posting limit reached', message: jobQuotaMessage(jobQuota), iconName: 'work-outline',
        primaryButtonText: jobQuota.plan === 'basic' ? 'View Premium' : 'OK',
        onPrimaryPress: () => { setNotificationConfig(prev => ({ ...prev, visible: false })); if (jobQuota.plan === 'basic') router.push('/employer/subscription'); },
        secondaryButtonText: jobQuota.plan === 'basic' ? 'Cancel' : undefined,
        onSecondaryPress: jobQuota.plan === 'basic' ? () => setNotificationConfig(prev => ({ ...prev, visible: false })) : undefined,
      });
      return;
    }
    router.push(isHousehold
      ? { pathname: '/employer/job-posting', params: { type: 'household' } }
      : '/employer/job-posting'
    );
  };

  const filterOptions = [
    { key: 'all' as const, label: 'All', count: allCount },
    { key: 'active' as const, label: 'Active', count: activeCount },
    { key: 'closed' as const, label: 'Closed', count: closedCount },
  ];

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar backgroundColor={colors.background} />
      <View className="w-full max-w-2xl self-center px-6 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center gap-3">
            <DrawerMenuButton onPress={() => setDrawerVisible(true)} />
            <Text className="text-[10px] font-semibold tracking-widest" style={{ color: colors.textSecondary }}>
              {isHousehold ? 'HOUSEHOLD' : 'EMPLOYER'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handlePostJob}
            accessibilityRole="button"
            accessibilityLabel={isHousehold ? 'Post a new opening' : 'Post a new job'}
            activeOpacity={0.8}
            className="flex-row items-center gap-1.5 px-3.5 py-3 rounded-xl bg-red-600"
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
            <Text className="text-xs font-semibold text-white">{isHousehold ? 'Post Opening' : 'Post Job'}</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-[28px] font-bold tracking-tight mb-1.5" style={{ color: colors.text }}>
          {isHousehold ? 'Household Openings' : 'Job Listings'}
        </Text>
        <Text className="text-sm leading-5 mb-5" style={{ color: colors.textSecondary }}>
          Keep track of your openings and applicants.
        </Text>

        {!isHousehold && jobQuota && <View className="rounded-2xl border p-4 mb-4 flex-row items-center gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-1">
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>{jobQuotaUsage(jobQuota)}</Text>
            <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{jobQuota.plan === 'premium' ? 'Premium plan' : 'Basic plan'} · {jobQuotaAvailability(jobQuota)}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/employer/subscription')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="View subscription plans" className="min-h-12 px-3 rounded-xl justify-center" style={{ backgroundColor: accentBackground }}><Text className="text-xs font-semibold" style={{ color: accentColor }}>View plans</Text></TouchableOpacity>
        </View>}

        <View className="flex-row gap-1 p-1 rounded-2xl border" style={{ backgroundColor: mutedBackground, borderColor: colors.border }}>
          {filterOptions.map((option) => {
            const selected = filter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setFilter(option.key)}
                accessibilityRole="tab"
                accessibilityLabel={option.label + ' listings'}
                accessibilityState={{ selected }}
                activeOpacity={0.75}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
                style={{ backgroundColor: selected ? accentBackground : 'transparent' }}
              >
                <Text className="text-xs font-semibold" style={{ color: selected ? accentColor : colors.textSecondary }}>{option.label}</Text>
                <View className="px-1.5 py-0.5 rounded-md" style={{ backgroundColor: selected ? (isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2') : colors.surface }}>
                  <Text className="text-[10px] font-semibold" style={{ color: selected ? accentColor : colors.textSecondary }}>{loading ? '\u2014' : option.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} tintColor={accentColor} />}
      >
        {loading ? (
          <View className="items-center justify-center py-16">
            <ActivityIndicator size="large" color={accentColor} />
            <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>Loading your listings...</Text>
          </View>
        ) : (
          <>
            <View className="flex-row items-center justify-between px-1 mb-3">
              <Text className="text-sm font-semibold" style={{ color: colors.text }}>
                {filter === 'active' ? 'Active openings' : filter === 'closed' ? 'Closed openings' : 'Your openings'}
              </Text>
              <Text className="text-[11px]" style={{ color: colors.textSecondary }}>
                {filteredJobs.length} {filteredJobs.length === 1 ? 'listing' : 'listings'}
              </Text>
            </View>
            {filteredJobs.length > 0 ? filteredJobs.map((job) => {
              const active = isJobActive(job);
              const status = String(job.status ?? '').toLowerCase().trim();
              const statusLabel = active ? 'Active' : status === 'archived' ? 'Archived' : status === 'inactive' ? 'Inactive' : 'Closed';
              const statusColor = active ? (isDark ? '#6EE7B7' : '#047857') : colors.textSecondary;
              const applicantCount = getApplicantCount(job);
              const rateLabel = formatDailyRate(job.salary);
              return (
                <View key={job.id} className="rounded-3xl border mb-4 overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={'View details for ' + job.title}
                    onPress={() => { setSelectedJob(job); setIsDetailsModalVisible(true); }}
                    className="p-4"
                  >
                    <View className="flex-row items-start gap-3 mb-4">
                      <View className="w-11 h-11 items-center justify-center">
                        <MaterialIcons name={isHousehold ? 'home-work' : 'work-outline'} size={22} color={accentColor} />
                      </View>
                      <View className="flex-1" style={{ minWidth: 0 }}>
                        <View className="flex-row items-center justify-between gap-2 mb-1.5">
                          <Text className="flex-1 text-[10px] font-semibold tracking-wide" style={{ color: colors.textSecondary }} numberOfLines={1}>
                            {job.category || 'General'}
                          </Text>
                          <Text className="py-1 text-[10px] font-semibold" style={{ color: statusColor }}>{statusLabel}</Text>
                        </View>
                        <Text className="text-base font-bold leading-5" style={{ color: colors.text }} numberOfLines={2}>{job.title}</Text>
                      </View>
                    </View>

                    <View className="flex-row items-baseline gap-1.5 mb-4">
                      <Text className="text-[22px] font-bold tracking-tight" style={{ color: colors.text }}>{rateLabel}</Text>
                      {rateLabel !== 'Rate not set' && <Text className="text-s" style={{ color: colors.textSecondary }}>{getSalaryUnit(job.salary_type)}</Text>}
                    </View>

                    <View className="flex-row rounded-2xl p-3" style={{ backgroundColor: mutedBackground }}>
                      <View className="flex-1 pr-3" style={{ minWidth: 0 }}>
                        <View className="flex-row items-center gap-1 mb-1.5">
                          <MaterialIcons name="calendar-today" size={12} color={colors.textSecondary} />
                          <Text className="text-[9px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>WORK DAYS</Text>
                        </View>
                        <Text className="text-xs leading-4" style={{ color: colors.text }} numberOfLines={2}>{formatWorkDays(job.available_days)}</Text>
                      </View>
                      <View className="flex-1 pl-3 border-l" style={{ minWidth: 0, borderLeftColor: colors.border }}>
                        <View className="flex-row items-center gap-1 mb-1.5">
                          <MaterialIcons name="schedule" size={13} color={colors.textSecondary} />
                          <Text className="text-[9px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>TIME SLOT</Text>
                        </View>
                        <Text className="text-xs leading-4" style={{ color: colors.text }} numberOfLines={2}>{job.time_slot || 'Not specified'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <View className="flex-row items-center justify-between gap-2 px-4 py-3 border-t" style={{ borderTopColor: colors.border }}>
                    <View className="flex-row items-center gap-2 flex-1">
                      <MaterialIcons name="people-outline" size={20} color={colors.textSecondary} />
                      <Text className="text-xs" style={{ color: colors.textSecondary }}>
                        <Text className="font-semibold" style={{ color: colors.text }}>{applicantCount}</Text>
                        {applicantCount === 1 ? ' applicant' : ' applicants'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={'View applicants for ' + job.title}
                      onPress={() => router.push({
                        pathname: '/employer/applicants-list',
                        params: { jobId: String(job.id), jobTitle: job.title },
                      })}
                      activeOpacity={0.75}
                      className="flex-row items-center justify-center gap-1 px-3 py-2.5 rounded-xl"
                      style={{ backgroundColor: accentBackground, minHeight: 44 }}
                    >
                      <Text className="text-[11px] font-semibold" style={{ color: accentColor }}>View applicants</Text>
                      <MaterialIcons name="chevron-right" size={17} color={accentColor} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }) : (
              <View className="rounded-3xl border items-center p-6 mt-2" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="w-16 h-16 rounded-3xl items-center justify-center mb-4" style={{ backgroundColor: accentBackground }}>
                  <MaterialIcons name={filter === 'closed' ? 'inventory-2' : 'work-outline'} size={30} color={accentColor} />
                </View>
                <Text className="text-base font-bold text-center mb-2" style={{ color: colors.text }}>
                  {filter === 'active' ? 'No active openings' : filter === 'closed' ? 'No closed openings' : 'No jobs posted yet'}
                </Text>
                <Text className="text-xs leading-5 text-center mb-5" style={{ color: colors.textSecondary }}>
                  {filter === 'all' ? 'Create your first opening to start receiving student applications.' : 'Switch to All to see your other openings.'}
                </Text>
                <TouchableOpacity
                  onPress={filter === 'all' ? handlePostJob : () => setFilter('all')}
                  accessibilityRole="button"
                  accessibilityLabel={filter === 'all' ? 'Create your first opening' : 'View all listings'}
                  className="flex-row items-center gap-1.5 px-4 py-3 rounded-xl bg-red-600"
                  activeOpacity={0.8}
                >
                  <MaterialIcons name={filter === 'all' ? 'add' : 'arrow-back'} size={17} color="#FFFFFF" />
                  <Text className="text-xs font-semibold text-white">{filter === 'all' ? (isHousehold ? 'Post Opening' : 'Post Job') : 'View all listings'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        <EmployerTabBarSpacer />
      </ScrollView>

      <JobDetailsModal
        visible={isDetailsModalVisible}
        onClose={() => { setIsDetailsModalVisible(false); setSelectedJob(null); }}
        job={selectedJob}
        onJobUpdated={fetchEmployerJobs}
      />
      <NotificationModal
        visible={notificationConfig.visible}
        title={notificationConfig.title}
        message={notificationConfig.message}
        iconName={notificationConfig.iconName}
        iconColor={notificationConfig.iconColor}
        iconBgColor={notificationConfig.iconBgColor}
        primaryButtonText={notificationConfig.primaryButtonText}
        onPrimaryPress={notificationConfig.onPrimaryPress}
        secondaryButtonText={notificationConfig.secondaryButtonText}
        onSecondaryPress={notificationConfig.onSecondaryPress}
      />
      <SideDrawerMenu
        visible={isDrawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={{ name: userProfile.name, role: isHousehold ? 'household' : 'business', avatarUri: userProfile.avatarUri, avatarInitials: userProfile.avatarInitials, isVerified, rejectionReason: userProfile.rejectionReason }}
      />
    </View>
  );
}
