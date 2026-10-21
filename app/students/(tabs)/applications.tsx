import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Avatar from '@/components/ui/Avatar';
import { formatDate } from '@/utils/helpers';
import api, { STORAGE_URL } from '@/api/axios';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryUnit } from '@/utils/jobRate';
import { sortApplicationsNewestFirst } from '@/utils/jobApplications';

const tabs = [
  'All',
  'Pending',
  'Viewed',
  'Shortlisted',
  'Interview',
  'Accepted',
  'Rejected',
  'Completed',
  'Terminated',
  'Cancelled',
] as const;

export default function ApplicationsScreen() {
  const { colors, isDark } = useDarkMode();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('All');
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const listRef = useRef<FlatList<any>>(null);

  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [studentProfile, setStudentProfile] = useState<{
    name: string;
    avatarUri?: string | null;
    avatarInitials?: string;
    isVerified?: boolean;
    rejectionReason?: string | null;
  }>({
    name: 'Student',
  });

  useEffect(() => {
    AsyncStorage.getItem('userProfile').then((stored) => {
      if (stored) {
        try {
          const profile = JSON.parse(stored);
          const fullName = profile.student_name || 'Student';
          const nameParts = fullName.trim().split(' ');
          const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : fullName.substring(0, 2).toUpperCase();
          const avatarUrl = profile.avatar
            ? (profile.avatar.startsWith('http') ? profile.avatar : `${STORAGE_URL}${profile.avatar}`)
            : null;
          setStudentProfile({
            name: fullName,
            avatarUri: avatarUrl,
            avatarInitials: initials,
            isVerified: profile.isVerified === 1 || profile.isVerified === true,
            rejectionReason: profile.rejection_reason || null,
          });
        } catch {
          console.warn('Unable to read the stored student profile.');
        }
      }
    }).catch(() => console.warn('Unable to load the student profile.'));
  }, []);

  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof MaterialIcons.glyphMap;
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
    onPrimaryPress: () => { },
  });

  const closeNotification = () => setNotification((prev) => ({ ...prev, visible: false }));

  const handleDirectCancel = (app: any) => {
    setNotification({
      visible: true,
      title: 'Cancel Application',
      message: 'Are you sure you want to cancel this application? This action cannot be undone.',
      iconName: 'remove-circle-outline',
      iconColor: '#DC2626',
      iconBgColor: 'bg-red-50',
      primaryButtonText: 'Yes, Cancel',
      secondaryButtonText: 'Keep Application',
      onSecondaryPress: closeNotification,
      onPrimaryPress: async () => {
        closeNotification();
        try {
          setCancellingId(app.id);
          const response = await api.post(`/student/applications/${app.id}/cancel`);
          if (response.data && response.data.status === 'success') {
            setNotification({
              visible: true,
              title: 'Application Cancelled',
              message: 'Your application has been successfully cancelled.',
              iconName: 'check-circle',
              iconColor: '#16A34A',
              iconBgColor: 'bg-emerald-50',
              primaryButtonText: 'Done',
              onPrimaryPress: closeNotification,
            });
            await fetchApplications(true);
          } else {
            throw new Error(response.data?.message || 'Unable to update application at this time.');
          }
        } catch (error: any) {
          console.error('Error cancelling application:', error);
          const msg = error.response?.data?.message || error.message || 'Unable to cancel application at this time.';
          setNotification({
            visible: true,
            title: 'Notice',
            message: msg,
            iconName: 'error-outline',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'OK',
            onPrimaryPress: closeNotification,
          });
        } finally {
          setCancellingId(null);
        }
      },
    });
  };

  const handleDirectDelete = (app: any) => {
    setNotification({
      visible: true,
      title: 'Delete Application',
      message: 'Are you sure you want to delete this application record? This action cannot be undone.',
      iconName: 'delete-outline',
      iconColor: '#DC2626',
      iconBgColor: 'bg-red-50',
      primaryButtonText: 'Yes, Delete',
      secondaryButtonText: 'Cancel',
      onSecondaryPress: closeNotification,
      onPrimaryPress: async () => {
        closeNotification();
        try {
          setDeletingId(app.id);
          const response = await api.delete(`/student/applications/${app.id}`);
          if (response.data && response.data.status === 'success') {
            setNotification({
              visible: true,
              title: 'Application Deleted',
              message: 'The application record has been removed.',
              iconName: 'check-circle',
              iconColor: '#16A34A',
              iconBgColor: 'bg-emerald-50',
              primaryButtonText: 'Done',
              onPrimaryPress: closeNotification,
            });
            await fetchApplications(true);
          } else {
            throw new Error(response.data?.message || 'Unable to update application at this time.');
          }
        } catch (error: any) {
          console.error('Error deleting application:', error);
          const msg = error.response?.data?.message || error.message || 'Unable to delete application at this time.';
          setNotification({
            visible: true,
            title: 'Notice',
            message: msg,
            iconName: 'error-outline',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'OK',
            onPrimaryPress: closeNotification,
          });
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const [refreshing, setRefreshing] = useState(false);

  const fetchApplications = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) { setLoading(true); setLoadError(false); }
      const response = await api.get('/student/applications');
      if (response.data && response.data.status === 'success') {
        setApplications(sortApplicationsNewestFirst(response.data.applications || []));
        setLoadError(false);
      } else {
        throw new Error('Unable to load applications.');
      }
    } catch (error) {
      if (!isBackground) {
        console.error('Error fetching applications:', error);
        setLoadError(true);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      fetchApplications(false);

      // Live auto-polling bawat 2.5 seconds para updated lagi
      const pollInterval = setInterval(() => {
        if (isMounted) fetchApplications(true);
      }, 2500);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
      };
    }, [fetchApplications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplications(false);
  };

  // Awtomatikong binabasa ang ID mula sa notification at binubuksan ang modal/page
  useEffect(() => {
    const checkSelectedApp = async () => {
      try {
        const savedId = await AsyncStorage.getItem('selected_application_id');
        if (savedId && applications.length > 0) {
          const found = applications.find((a) => a.id.toString() === savedId.toString());
          if (found) {
            const targetStatus = found.status
              ? found.status.charAt(0).toUpperCase() + found.status.slice(1)
              : '';
            if (tabs.includes(targetStatus as any)) {
              setActiveTab(targetStatus as any);
            }
            router.push({
              pathname: '/students/application-details' as any,
              params: { applicationId: found.id.toString() },
            });
          }
          await AsyncStorage.removeItem('selected_application_id');
        }
      } catch (e) {
        console.error('Error opening selected app:', e);
      }
    };
    checkSelectedApp();
  }, [applications]);

  const filteredApplications = applications.filter((app) => {
    if (activeTab === 'All') return true;
    const status = String(app.status || '').toLowerCase();
    return status === activeTab.toLowerCase();
  });

  const handleCardPress = (app: any) => {
    router.push({
      pathname: '/students/application-details' as any,
      params: { applicationId: app.id.toString() },
    });
  };

  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;
  const subtle = isDark ? '#263449' : '#F1F5F9';
  const statusCounts = applications.reduce<Record<string, number>>((counts, app) => {
    const status = String(app.status || '').toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const getStatusConfig = (statusRaw?: string) => {
    const status = String(statusRaw || '').toLowerCase();
    const configs: Record<string, { label: string; icon: keyof typeof MaterialIcons.glyphMap; light: string; dark: string; fill: string; darkFill: string }> = {
      pending: { label: 'Pending', icon: 'hourglass-empty', light: '#B45309', dark: '#FCD34D', fill: '#FFFBEB', darkFill: '#422F16' },
      viewed: { label: 'Viewed', icon: 'visibility', light: '#1D4ED8', dark: '#93C5FD', fill: '#EFF6FF', darkFill: '#172F4D' },
      shortlisted: { label: 'Shortlisted', icon: 'star-outline', light: '#4338CA', dark: '#C7D2FE', fill: '#EEF2FF', darkFill: '#2A2850' },
      interview: { label: 'For interview', icon: 'event-available', light: '#B45309', dark: '#FCD34D', fill: '#FFFBEB', darkFill: '#422F16' },
      accepted: { label: 'Accepted', icon: 'check-circle-outline', light: '#047857', dark: '#6EE7B7', fill: '#ECFDF5', darkFill: '#143B32' },
      completed: { label: 'Completed', icon: 'task-alt', light: '#0F766E', dark: '#5EEAD4', fill: '#F0FDFA', darkFill: '#153C3D' },
      rejected: { label: 'Declined', icon: 'cancel', light: '#BE123C', dark: '#FDA4AF', fill: '#FFF1F2', darkFill: '#43232F' },
      terminated: { label: 'Terminated', icon: 'block', light: '#BE123C', dark: '#FDA4AF', fill: '#FFF1F2', darkFill: '#43232F' },
      cancelled: { label: 'Cancelled', icon: 'remove-circle-outline', light: '#475569', dark: '#CBD5E1', fill: '#F1F5F9', darkFill: '#263449' },
    };
    const config = configs[status] || { label: statusRaw || 'Unknown status', icon: 'info-outline' as const, light: '#475569', dark: '#CBD5E1', fill: '#F1F5F9', darkFill: '#263449' };
    return { label: config.label, icon: config.icon, color: isDark ? config.dark : config.light, background: isDark ? config.darkFill : config.fill };
  };

  const renderApplication = ({ item: app }: { item: any }) => {
    const job = app.job || {};
    const owner = job.household || job.employer;
    const companyName = owner?.household_name || owner?.employer_name || 'Employer';
    const location = job.location || owner?.location || 'Pinamalayan';
    const status = String(app.status || '').toLowerCase();
    const statusConfig = getStatusConfig(status);
    const canCancel = ['pending', 'viewed'].includes(status);
    const canDelete = ['cancelled', 'rejected', 'completed', 'terminated'].includes(status);
    const isBusy = cancellingId === app.id || deletingId === app.id;
    return (
      <View className="mx-6 mb-4 rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <TouchableOpacity onPress={() => handleCardPress(app)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`View application for ${job.title || 'Job Opening'} at ${companyName}`} className="p-5 pb-4">
          <View className="flex-row flex-wrap items-center justify-between gap-2 mb-4">
            <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: statusConfig.background }}>
              <MaterialIcons name={statusConfig.icon} size={14} color={statusConfig.color} />
              <Text className="text-xs font-semibold" style={{ color: statusConfig.color }}>{statusConfig.label}</Text>
            </View>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>Application #{app.id}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Avatar uri={owner?.avatar} name={companyName} size={44} />
            <View className="flex-1">
              <Text className="text-lg font-bold leading-7" style={{ color: colors.text }} numberOfLines={2}>{job.title || 'Job Opening'}</Text>
              <View className="flex-row items-center gap-1.5 mt-1">
                <Text className="text-sm shrink" style={{ color: colors.textSecondary }} numberOfLines={1}>{companyName}</Text>
                {(owner?.isVerified === true || owner?.isVerified === 1) && <MaterialIcons name="verified" size={15} color={isDark ? '#6EE7B7' : '#15803D'} />}
              </View>
            </View>
          </View>
          <View className="flex-row flex-wrap items-center gap-2 mt-4 mb-3">
            <Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>{'\u20B1'}{Number(job.salary || 0).toLocaleString('en-PH')}</Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{getSalaryUnit(job.salary_type)}</Text>
            {!!job.category && <View className="ml-auto rounded-lg px-2.5 py-1 max-w-full" style={{ backgroundColor: subtle }}><Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>{job.category}</Text></View>}
          </View>
          <View className="flex-row items-start gap-2 mt-2">
            <MaterialIcons name="location-on" size={17} color={colors.textSecondary} />
            <Text className="flex-1 text-sm leading-5" style={{ color: colors.textSecondary }} numberOfLines={2}>{location}</Text>
          </View>
          {!!app.created_at && <View className="flex-row items-center gap-2 mt-2"><MaterialIcons name="event-note" size={16} color={colors.textSecondary} /><Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>Applied {formatDate(app.created_at)}</Text></View>}
        </TouchableOpacity>
        <View className="flex-row flex-wrap items-center justify-between gap-2 border-t px-5 py-3" style={{ borderColor: colors.border }}>
          {(canCancel || canDelete) ? (
            <TouchableOpacity onPress={() => canCancel ? handleDirectCancel(app) : handleDirectDelete(app)} disabled={isBusy} activeOpacity={0.75} hitSlop={4} accessibilityRole="button" accessibilityLabel={canCancel ? 'Cancel application' : 'Remove application record'} accessibilityState={{ disabled: isBusy, busy: isBusy }} className={canCancel ? 'min-h-12 flex-row items-center justify-center gap-1.5 px-3 border rounded-xl' : 'min-h-12 flex-row items-center gap-1.5 px-3 rounded-xl'} style={{ backgroundColor: canCancel ? colors.surface : subtle, borderColor: colors.border, opacity: isBusy ? 0.6 : 1 }}>
              {isBusy ? <ActivityIndicator size="small" color={canCancel ? accentText : colors.textSecondary} /> : <MaterialIcons name={canCancel ? 'close' : 'delete-outline'} size={canCancel ? 20 : 17} color={canCancel ? accentText : colors.textSecondary} />}
              <Text className="text-xs font-semibold" style={{ color: canCancel ? accentText : colors.textSecondary }}>{canCancel ? 'Cancel Application' : 'Remove'}</Text>
            </TouchableOpacity>
          ) : <Text className="text-xs" style={{ color: colors.textSecondary }}>Track your progress</Text>}
          <TouchableOpacity onPress={() => handleCardPress(app)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`View details of application ${app.id}`} className="min-h-12 flex-row items-center gap-2 rounded-xl px-3" style={{ backgroundColor: accentSurface }}>
            <Text className="text-xs font-semibold" style={{ color: accentText }}>View details</Text>
            <MaterialIcons name="arrow-forward" size={17} color={accentText} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="mx-6 rounded-3xl border px-6 py-8 items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : <View className="w-16 h-16 rounded-3xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={loadError ? 'wifi-off' : activeTab === 'All' ? 'inbox' : 'filter-list'} size={30} color={accentText} /></View>}
      <Text className="text-lg font-bold text-center mt-4" style={{ color: colors.text }}>{loading ? 'Loading applications' : loadError ? 'Unable to load applications' : activeTab === 'All' ? 'No applications yet' : `No ${activeTab.toLowerCase()} applications`}</Text>
      <Text className="text-sm leading-6 text-center mt-2" style={{ color: colors.textSecondary }}>{loading ? 'Your application updates will appear here shortly.' : loadError ? 'Check your connection and try again.' : activeTab === 'All' ? 'Explore available jobs and find a role that fits your schedule.' : 'Choose another status or view all your applications.'}</Text>
      {!loading && <TouchableOpacity onPress={() => { if (loadError) onRefresh(); else if (activeTab === 'All') router.push('/students/(tabs)/home'); else setActiveTab('All'); }} activeOpacity={0.8} accessibilityRole="button" className="min-h-12 flex-row items-center gap-2 px-4 rounded-xl mt-5" style={{ backgroundColor: accentSurface }}><Text className="text-sm font-semibold" style={{ color: accentText }}>{loadError ? 'Try again' : activeTab === 'All' ? 'Explore jobs' : 'View all applications'}</Text><MaterialIcons name={loadError ? 'refresh' : 'arrow-forward'} size={16} color={accentText} /></TouchableOpacity>}
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center shrink-0 pt-2 pb-3">
        <View className="flex-row items-center gap-3 px-6">
          <TouchableOpacity onPress={() => setDrawerVisible(true)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open navigation menu" className="w-12 h-12 items-center justify-center"><MaterialIcons name="menu" size={23} color={colors.text} /></TouchableOpacity>
          <View className="flex-1"><Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>Applications</Text><Text className="text-xs leading-5 mt-0.5" style={{ color: colors.textSecondary }}>Keep track of your next opportunity</Text></View>
        </View>
        <Text className="text-xs font-medium mt-4 mb-2 px-6" style={{ color: colors.textSecondary }}>Filter by status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-6 gap-2 pb-1" keyboardShouldPersistTaps="handled">
          {tabs.map((tab) => {
            const selected = activeTab === tab;
            const count = tab === 'All' ? applications.length : statusCounts[tab.toLowerCase()] || 0;
            return <TouchableOpacity key={tab} onPress={() => { setActiveTab(tab); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected }} className="min-h-12 flex-row items-center gap-2 rounded-xl border px-3 py-2.5" style={{ backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }}><Text className="text-xs font-semibold" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{tab}</Text>{!loading && <View className="min-w-5 rounded-full items-center justify-center px-1.5 py-0.5" style={{ backgroundColor: selected ? 'rgba(255, 255, 255, 0.2)' : subtle }}><Text className="text-xs font-medium" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{count}</Text></View>}</TouchableOpacity>;
          })}
        </ScrollView>
      </View>
      <FlatList
        ref={listRef}
        className="flex-1"
        data={loading ? [] : filteredApplications}
        keyExtractor={(app) => app.id.toString()}
        renderItem={renderApplication}
        contentContainerClassName="w-full max-w-2xl self-center pb-6"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        ListHeaderComponent={<View className="px-6 pt-4 pb-4"><Text className="text-lg font-bold" style={{ color: colors.text }}>{activeTab === 'All' ? 'Your applications' : `${activeTab} applications`}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Open an application to see updates and next steps.</Text>{loadError && applications.length > 0 && <TouchableOpacity onPress={onRefresh} accessibilityRole="button" activeOpacity={0.75} className="flex-row items-center gap-2 rounded-xl p-3 mt-3" style={{ backgroundColor: accentSurface }}><MaterialIcons name="refresh" size={18} color={accentText} /><Text className="flex-1 text-xs leading-5" style={{ color: accentText }}>Could not refresh applications. Tap to retry.</Text></TouchableOpacity>}</View>}
        ListEmptyComponent={renderEmptyState()}
      />
      <NotificationModal
        visible={notification.visible}
        title={notification.title}
        message={notification.message}
        iconName={notification.iconName}
        iconColor={notification.iconColor}
        iconBgColor={notification.iconBgColor}
        primaryButtonText={notification.primaryButtonText}
        onPrimaryPress={notification.onPrimaryPress}
        secondaryButtonText={notification.secondaryButtonText}
        onSecondaryPress={notification.onSecondaryPress}
        buttonLayout="row"
      />
      <SideDrawerMenu visible={isDrawerVisible} onClose={() => setDrawerVisible(false)} user={{ name: studentProfile.name, role: 'student', avatarUri: studentProfile.avatarUri, avatarInitials: studentProfile.avatarInitials, isVerified: studentProfile.isVerified, rejectionReason: studentProfile.rejectionReason }} />
    </View>
  );
}
