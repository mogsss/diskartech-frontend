import Avatar from '@/components/ui/Avatar';
import EmployerTabBarSpacer from '@/components/employer/EmployerTabBarSpacer';
import { LinearGradient } from 'expo-linear-gradient';
import { getSalaryUnit } from '@/utils/jobRate';
import JobDetailsModal from '@/components/employer/modals/JobDetailsModal';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, BackHandler, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import DrawerMenuButton from '@/components/ui/DrawerMenuButton';
import api, { STORAGE_URL } from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

type IconName = keyof typeof MaterialIcons.glyphMap;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0]?.slice(0, 2).toUpperCase() || 'ST');
}

function avatarUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  return /^https?:\/\//i.test(value) ? value : STORAGE_URL + value.replace(/^\/?storage\//, '').replace(/^\//, '');
}

function applicantCount(job: any) {
  const count = Number(job.applications_count ?? (Array.isArray(job.applications) ? job.applications.length : 0));
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function dailyRate(value: unknown) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !String(value).trim()) return 'Rate not set';
  const amount = Number(value);
  return Number.isFinite(amount) ? '\u20B1' + amount.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : 'Rate not set';
}

function jobIsActive(job: any) {
  return !['closed', 'inactive', 'archived', '0', 'false'].includes(String(job.status ?? '').trim().toLowerCase());
}

export default function SharedDashboardScreen() {
  const { colors, isDark } = useDarkMode();
  const { hasUnread: hasUnreadNotifs } = useUnreadNotifications();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';
  const role = isHousehold ? 'household' : 'business';
  const verificationRoute = `/employer/verification-status?type=${role}` as const;
  const jobsRoute = `/employer/(tabs)/jobs?type=${role}` as const;
  const profileRoute = `/employer/(tabs)/profile?type=${role}` as const;
  const accent = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const subtle = isDark ? '#263449' : '#F1F5F9';
  const success = isDark ? '#6EE7B7' : '#15803D';

  const [notificationConfig, setNotificationConfig] = useState<{
    visible: boolean; title: string; message: string;
    iconName?: IconName; iconColor?: string; iconBgColor?: string;
    primaryButtonText?: string; onPrimaryPress: () => void;
    secondaryButtonText?: string; onSecondaryPress?: () => void;
  }>({ visible: false, title: '', message: '', onPrimaryPress: () => {} });
  const [displayName, setDisplayName] = useState(isHousehold ? 'Household Employer' : 'Business Employer');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [postedJobs, setPostedJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [recentApplicants, setRecentApplicants] = useState<any[]>([]);
  const [totalApplicantsCount, setTotalApplicantsCount] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState(false);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, []));

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    const applyProfile = (profile: any) => {
      setIsVerified(profile.isVerified === true || profile.isVerified === 1 || profile.isVerified === '1');
      setRejectionReason(profile.rejection_reason || null);
      setAvatarUri(avatarUrl(profile.avatar || profile.avatar_url || profile.profile_picture) || null);
      const name = isHousehold ? profile.household_name || profile.name : profile.employer_name || profile.business_name || profile.name;
      if (typeof name === 'string' && name.trim()) setDisplayName(name.trim());
    };
    try {
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        const cached = storedProfile ? JSON.parse(storedProfile) : null;
        if (cached && typeof cached === 'object') {
          applyProfile(cached);
          if (!isBackground) setLoadingProfile(false);
        }
      } catch { console.warn('Unable to read the cached dashboard profile.'); }

      const [profileResult, jobsResult] = await Promise.allSettled([
        api.get('/dashboard-data'),
        api.get('/employer/jobs'),
      ]);
      if (profileResult.status === 'fulfilled' && profileResult.value.data?.status === 'success' && profileResult.value.data.profile) {
        const profile = profileResult.value.data.profile;
        applyProfile(profile);
        try { await AsyncStorage.setItem('userProfile', JSON.stringify(profile)); }
        catch { console.warn('Unable to cache the dashboard profile.'); }
      }
      if (jobsResult.status !== 'fulfilled' || jobsResult.value.data?.status !== 'success' || !Array.isArray(jobsResult.value.data.jobs)) {
        setJobsError(true);
        return;
      }
      const jobs = jobsResult.value.data.jobs;
      const applicants: any[] = [];
      let total = 0;
      jobs.forEach((job: any) => {
        total += applicantCount(job);
        if (!Array.isArray(job.applications)) return;
        job.applications.forEach((application: any) => {
          const student = application.student || application.user || {};
          const name = student.student_name || student.name || student.fullname || 'Student Applicant';
          applicants.push({
            id: application.id, name, position: job.title,
            status: String(application.status || 'pending').trim().toLowerCase(),
            avatar: avatarUrl(student.avatar || student.profile_picture),
            initials: getInitials(name),
            createdAt: new Date(application.created_at || 0).getTime() || 0,
          });
        });
      });
      applicants.sort((a, b) => b.createdAt - a.createdAt);
      setPostedJobs(jobs);
      setRecentApplicants(applicants);
      setTotalApplicantsCount(total);
      setJobsError(false);
    } catch (error) {
      setJobsError(true);
      if (!isBackground) console.warn('Unable to load dashboard data:', error);
    } finally {
      if (!isBackground) {
        setLoadingProfile(false);
        setLoadingJobs(false);
        setRefreshing(false);
      }
    }
  }, [isHousehold]);

  useFocusEffect(useCallback(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(true), 3000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]));

  const onRefresh = () => { setRefreshing(true); fetchDashboardData(); };
  const closeNotification = () => setNotificationConfig((current) => ({ ...current, visible: false }));
  const handlePost = () => {
    if (isVerified) { router.push(`/employer/job-posting?type=${role}`); return; }
    setNotificationConfig({
      visible: true, title: 'Verification Required',
      message: 'Upload required documents and wait for account approval before posting a job.',
      iconName: 'verified-user', iconColor: colors.primary, iconBgColor: 'bg-red-50',
      primaryButtonText: 'View verification', secondaryButtonText: 'Cancel',
      onPrimaryPress: () => { closeNotification(); router.push(verificationRoute); },
      onSecondaryPress: closeNotification,
    });
  };
  const hour = new Date().getHours();
  const greeting = isHousehold
    ? hour >= 5 && hour < 12 ? 'Magandang umaga' : hour >= 12 && hour < 18 ? 'Magandang hapon' : 'Magandang gabi'
    : hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
  const stats: { label: string; value: number; icon: IconName }[] = [
    { label: isHousehold ? 'Posted openings' : 'Posted jobs', value: postedJobs.length, icon: 'work-outline' },
    { label: 'Applicants', value: totalApplicantsCount, icon: 'people-outline' },
    { label: 'Pending review', value: recentApplicants.filter((app) => app.status === 'pending').length, icon: 'hourglass-empty' },
    { label: 'Hired', value: recentApplicants.filter((app) => app.status === 'accepted').length, icon: 'check-circle-outline' },
  ];
  const shortcuts: { label: string; icon: IconName; route: string }[] = [
    { label: isHousehold ? 'Openings' : 'My jobs', icon: 'work-outline', route: jobsRoute },
    { label: 'Applicants', icon: 'people-outline', route: '/employer/applicants-list' },
    { label: 'Messages', icon: 'chat-bubble-outline', route: '/employer/(tabs)/messages' },
    { label: 'Verification', icon: 'verified-user', route: verificationRoute },
  ];
  const applicationStatus = (status: string) => {
    const info: Record<string, { label: string; color: string; background: string }> = {
      pending: { label: 'Pending', color: isDark ? '#FCD34D' : '#B45309', background: isDark ? '#422F16' : '#FFFBEB' },
      viewed: { label: 'Viewed', color: isDark ? '#93C5FD' : '#1D4ED8', background: isDark ? '#172F4D' : '#EFF6FF' },
      shortlisted: { label: 'Shortlisted', color: isDark ? '#C7D2FE' : '#4338CA', background: isDark ? '#2A2850' : '#EEF2FF' },
      interview: { label: 'Interview', color: isDark ? '#67E8F9' : '#0E7490', background: isDark ? '#163B45' : '#ECFEFF' },
      accepted: { label: 'Accepted', color: success, background: isDark ? '#143B32' : '#F0FDF4' },
      completed: { label: 'Completed', color: success, background: isDark ? '#143B32' : '#F0FDF4' },
      rejected: { label: 'Rejected', color: accent, background: accentSurface },
      terminated: { label: 'Terminated', color: accent, background: accentSurface },
      cancelled: { label: 'Cancelled', color: colors.textSecondary, background: subtle },
    };
    return info[status] || { label: status || 'Unknown', color: colors.textSecondary, background: subtle };
  };

  if (loadingProfile) return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text className="text-sm mt-4" style={{ color: colors.textSecondary }}>Loading your dashboard...</Text>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center px-6 pt-2 pb-3 flex-row items-center gap-3">
        <DrawerMenuButton onPress={() => setDrawerVisible(true)} />
        <Text className="flex-1 text-xl font-bold tracking-tight" style={{ color: colors.text }}>DiskarTech<Text style={{ color: colors.primary }}>.</Text></Text>
        <TouchableOpacity onPress={() => router.push('/notifications')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={hasUnreadNotifs ? 'Notifications, unread updates' : 'Notifications'} className="w-12 h-12 rounded-2xl border items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <MaterialIcons name="notifications-none" size={23} color={colors.text} />
          {hasUnreadNotifs && <View className="absolute top-2 right-2 w-2 h-2 rounded-full border" style={{ backgroundColor: colors.primary, borderColor: colors.surface }} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(profileRoute)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="View your profile">
          <Avatar uri={avatarUri || ''} name={getInitials(displayName)} size={42} />
        </TouchableOpacity>
      </View>

      <View className="flex-1">
        <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center px-6 pt-3 pb-6" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={accent} />}>
          <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>{greeting}</Text>
          <View className="flex-row items-center gap-2">
            <Text className="shrink text-2xl font-bold leading-8 tracking-tight" numberOfLines={2} style={{ color: colors.text }}>{displayName}</Text>
            {isVerified && <TouchableOpacity onPress={() => router.push(verificationRoute)} accessibilityRole="button" accessibilityLabel="View verified account status" hitSlop={8}><MaterialIcons name="verified" size={21} color={success} /></TouchableOpacity>}
          </View>
          <Text className="text-sm leading-6 mt-2 mb-5" style={{ color: colors.textSecondary }}>{isHousehold ? 'Find student help for your home and manage your openings.' : 'Keep your job listings and student applications in one place.'}</Text>

          {!isVerified && rejectionReason && <TouchableOpacity onPress={() => router.push(verificationRoute)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Review rejected verification documents" className="rounded-2xl border p-4 flex-row items-start gap-3 mb-5" style={{ backgroundColor: accentSurface, borderColor: isDark ? '#66303A' : '#FECDD3' }}>
            <MaterialIcons name="error-outline" size={22} color={accent} />
            <View className="flex-1"><Text className="text-sm font-semibold" style={{ color: accent }}>Update verification documents</Text><Text className="text-xs leading-5 mt-1" numberOfLines={2} style={{ color: accent }}>{rejectionReason}</Text></View>
            <MaterialIcons name="chevron-right" size={22} color={accent} />
          </TouchableOpacity>}

          <View className="rounded-3xl border p-5 mb-6" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-row items-start gap-3 mb-4">
              <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={isHousehold ? 'home-work' : 'work-outline'} size={24} color={accent} /></View>
              <View className="flex-1"><Text className="text-lg font-bold leading-6" style={{ color: colors.text }}>{isHousehold ? 'Need a helping hand?' : 'Find your next team member'}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Share an opening with students looking for part-time work.</Text></View>
            </View>
            <TouchableOpacity onPress={handlePost} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={isHousehold ? 'Post an opening' : 'Post a new job'} className="min-h-12 rounded-xl flex-row items-center justify-center gap-2 px-4 py-3" style={{ backgroundColor: colors.primary }}>
              <MaterialIcons name="add" size={21} color="#FFFFFF" /><Text className="text-sm font-semibold text-white">{isHousehold ? 'Post an opening' : 'Post a new job'}</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>Overview</Text>
          <View className="gap-3 mb-6">
            {[stats.slice(0, 2), stats.slice(2)].map((row, index) => <View key={index} className="flex-row gap-3">{row.map((stat) => <View key={stat.label} className="flex-1 rounded-2xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: accentSurface }}><MaterialIcons name={stat.icon} size={20} color={colors.accent} /></View>
              <Text className="text-2xl font-bold" style={{ color: colors.text }}>{loadingJobs || jobsError ? '\u2014' : stat.value}</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{stat.label}</Text>
            </View>)}</View>)}
          </View>

          <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>Quick access</Text>
          <View className="flex-row gap-2 mb-6">{shortcuts.map((item) => <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={item.label} className="flex-1 items-center rounded-2xl border px-1 py-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: accentSurface }}><MaterialIcons name={item.icon} size={20} color={colors.accent} /></View>
            <Text className="text-xs font-medium text-center" numberOfLines={2} style={{ color: colors.textSecondary }}>{item.label}</Text>
          </TouchableOpacity>)}</View>

          {jobsError && <TouchableOpacity onPress={onRefresh} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Retry dashboard update" className="flex-row items-center gap-2 rounded-xl p-3 mb-5" style={{ backgroundColor: accentSurface }}>
            <MaterialIcons name="refresh" size={18} color={accent} /><Text className="flex-1 text-xs leading-5" style={{ color: accent }}>Could not update your dashboard. Tap to retry.</Text>
          </TouchableOpacity>}

          <View className="rounded-3xl border p-4 mb-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="flex-1 text-lg font-bold" style={{ color: colors.text }}>Recent applicants</Text>
              <TouchableOpacity onPress={() => router.push('/employer/applicants-list')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="View all applicants" className="min-h-12 items-center justify-center px-1"><Text className="text-xs font-semibold" style={{ color: accent }}>View all</Text></TouchableOpacity>
            </View>
            {loadingJobs ? <ActivityIndicator color={colors.primary} className="my-5" /> : recentApplicants.length ? recentApplicants.slice(0, 3).map((app, index) => {
              const status = applicationStatus(app.status);
              return <TouchableOpacity key={app.id} onPress={() => router.push(`/employer/applicant-details?applicationId=${app.id}`)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`View application from ${app.name}`} className={index ? 'flex-row items-center gap-3 py-4 border-t' : 'flex-row items-center gap-3 py-3'} style={{ borderTopColor: colors.border }}>
                <Avatar uri={app.avatar} name={app.initials} size={40} />
                <View className="flex-1"><Text className="text-sm font-semibold" numberOfLines={1} style={{ color: colors.text }}>{app.name}</Text><Text className="text-xs leading-5 mt-1" numberOfLines={1} style={{ color: colors.textSecondary }}>{app.position}</Text><View className="self-start rounded-lg px-2 py-1 mt-2" style={{ backgroundColor: status.background }}><Text className="text-xs font-medium" style={{ color: status.color }}>{status.label}</Text></View></View>
                <MaterialIcons name="chevron-right" size={21} color={colors.textSecondary} />
              </TouchableOpacity>;
            }) : <View className="items-center py-5"><View className="w-12 h-12 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: subtle }}><MaterialIcons name={jobsError ? 'wifi-off' : 'people-outline'} size={24} color={colors.textSecondary} /></View><Text className="text-sm font-semibold text-center" style={{ color: colors.text }}>{jobsError ? 'Applicants unavailable' : 'No applicants yet'}</Text><Text className="text-xs leading-5 text-center mt-1" style={{ color: colors.textSecondary }}>{jobsError ? 'Pull down to refresh and try again.' : 'New applications will appear here.'}</Text></View>}
          </View>

          <View className="rounded-3xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="flex-1 text-lg font-bold" style={{ color: colors.text }}>{isHousehold ? 'Posted openings' : 'Posted jobs'}</Text>
              <TouchableOpacity onPress={() => router.push(jobsRoute)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="View all job listings" className="min-h-12 items-center justify-center px-1"><Text className="text-xs font-semibold" style={{ color: accent }}>View all</Text></TouchableOpacity>
            </View>
            {loadingJobs ? <ActivityIndicator color={colors.primary} className="my-5" /> : postedJobs.length ? postedJobs.slice(0, 3).map((job, index) => {
              const active = jobIsActive(job);
              const label = active ? 'Active' : String(job.status).toLowerCase() === 'archived' ? 'Archived' : String(job.status).toLowerCase() === 'inactive' ? 'Inactive' : 'Closed';
              const rate = dailyRate(job.salary);
              const count = applicantCount(job);
              return <TouchableOpacity key={job.id} onPress={() => { setSelectedJob(job); setIsDetailsModalVisible(true); }} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`View details for ${job.title}`} className={index ? 'py-4 border-t' : 'py-3'} style={{ borderTopColor: colors.border }}>
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: subtle }}><MaterialIcons name={isHousehold ? 'home-work' : 'work-outline'} size={20} color={colors.textSecondary} /></View>
                  <View className="flex-1"><Text className="text-sm font-semibold leading-5" numberOfLines={2} style={{ color: colors.text }}>{job.title}</Text><View className="flex-row flex-wrap gap-1 mt-1"><Text className="text-xs font-semibold" style={{ color: colors.text }}>{rate}</Text>{rate !== 'Rate not set' && <Text className="text-xs" style={{ color: colors.textSecondary }}>{getSalaryUnit(job.salary_type)}</Text>}</View></View>
                  <MaterialIcons name="chevron-right" size={21} color={colors.textSecondary} />
                </View>
                <View className="flex-row flex-wrap items-center justify-between gap-2 mt-3">
                  <View className="flex-row items-center gap-1.5 rounded-lg px-2 py-1" style={{ backgroundColor: active ? (isDark ? '#143B32' : '#F0FDF4') : subtle }}><View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? success : colors.textSecondary }} /><Text className="text-xs font-medium" style={{ color: active ? success : colors.textSecondary }}>{label}</Text></View>
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>{count} {count === 1 ? 'applicant' : 'applicants'}</Text>
                </View>
              </TouchableOpacity>;
            }) : <View className="items-center py-5"><View className="w-12 h-12 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: subtle }}><MaterialIcons name={jobsError ? 'wifi-off' : 'work-outline'} size={24} color={colors.textSecondary} /></View><Text className="text-sm font-semibold text-center" style={{ color: colors.text }}>{jobsError ? 'Listings unavailable' : 'No openings yet'}</Text><Text className="text-xs leading-5 text-center mt-1" style={{ color: colors.textSecondary }}>{jobsError ? 'Pull down to refresh and try again.' : 'Post an opening to start receiving applications.'}</Text>{!jobsError && <TouchableOpacity onPress={handlePost} activeOpacity={0.75} accessibilityRole="button" className="min-h-12 flex-row items-center gap-1 rounded-xl px-3 mt-4" style={{ backgroundColor: accentSurface }}><MaterialIcons name="add" size={18} color={accent} /><Text className="text-xs font-semibold" style={{ color: accent }}>{isHousehold ? 'Post an opening' : 'Post a job'}</Text></TouchableOpacity>}</View>}
          </View>
          <EmployerTabBarSpacer />
        </ScrollView>
        <LinearGradient
          accessible={false}
          pointerEvents="none"
          colors={[colors.background, `${colors.background}00`]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20 }}
        />
      </View>

      <JobDetailsModal visible={isDetailsModalVisible} job={selectedJob} onClose={() => { setIsDetailsModalVisible(false); setSelectedJob(null); }} onJobUpdated={() => fetchDashboardData(true)} />
      <NotificationModal visible={notificationConfig.visible} title={notificationConfig.title} message={notificationConfig.message} iconName={notificationConfig.iconName} iconColor={notificationConfig.iconColor} iconBgColor={notificationConfig.iconBgColor} primaryButtonText={notificationConfig.primaryButtonText} onPrimaryPress={notificationConfig.onPrimaryPress} secondaryButtonText={notificationConfig.secondaryButtonText} onSecondaryPress={notificationConfig.onSecondaryPress} buttonLayout="row" />
      <SideDrawerMenu visible={isDrawerVisible} onClose={() => setDrawerVisible(false)} user={{ name: displayName, role, avatarUri, avatarInitials: getInitials(displayName), isVerified, rejectionReason }} />
    </View>
  );
}
