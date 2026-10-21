import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import HomeJobCard from '@/components/student/HomeJobCard';
import SearchBar from '@/components/ui/SearchBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { resolveMediaUrl } from '@/utils/media';
import { buildForYouJobs, isFeaturedJob, moveAppliedJobsLast } from '@/utils/jobFeatured';
import { getAppliedJobIds } from '@/utils/jobApplications';
import { matchJobWithQuery } from '@/utils/fuzzySearch';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useToast } from '@/hooks/useToast';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';

type JobFeed = 'all' | 'nearby' | 'ai_match' | 'saved';
const feedTabs: { id: JobFeed; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'all', label: 'All jobs', icon: 'work-outline' },
  { id: 'nearby', label: 'Nearby', icon: 'near-me' },
  { id: 'ai_match', label: 'For you', icon: 'auto-awesome' },
  { id: 'saved', label: 'Saved', icon: 'bookmark-border' },
];

export default function HomeScreen() {
  const { showToast } = useToast();
  // Pigilan ang pagbalik sa login page kapag pinindot ang hardware back button sa root dashboard
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        BackHandler.exitApp();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const [studentName, setStudentName] = useState('Student');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<JobFeed>('all');

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
      const days = parseJsonField(job.available_days);
      return days.length ? `${days.join(', ')} · ${job.time_slot}` : job.time_slot;
    }
    return 'Flexible';
  };

  const formatDistance = (rawDist: any) => {
    if (rawDist == null || isNaN(parseFloat(rawDist))) return '';
    const dist = parseFloat(rawDist);
    if (dist < 0.1) return '< 100m away';
    if (dist < 1) return `${Math.round(dist * 1000)}m away`;
    return `${dist.toFixed(1)} km away`;
  };

  const parseJsonField = (field: any) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const fetchStudentData = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        if (profile) {
          const fullName = profile.student_name || 'Student';
          const firstName = fullName.split(' ')[0];
          setStudentName(firstName);
          const nameParts = fullName.trim().split(' ');
          const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : fullName.substring(0, 2).toUpperCase();
          const avatarUrl = resolveMediaUrl(profile.avatar_url ?? profile.avatar ?? profile.profile_picture);
          setStudentProfile({
            name: fullName,
            avatarUri: avatarUrl,
            avatarInitials: initials,
            isVerified: profile.isVerified === 1 || profile.isVerified === true,
            rejectionReason: profile.rejection_reason || null,
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  const formatJobsWithMetadata = (
    jobsList: any[],
    savedList: any[],
    appliedIds: Set<string> = appliedJobIds
  ) => {
    const savedIds = new Set(savedList.map((s: any) => s.id?.toString()));
    return jobsList.map((job) => ({
      ...job,
      bookmarked: savedIds.has(job.id?.toString()),
      isApplied: appliedIds.has(job.id?.toString()),
    }));
  };

  const fetchAppliedJobs = async () => {
    try {
      const response = await api.get('/student/applications');
      if (response.data && response.data.status === 'success') {
        const ids = getAppliedJobIds(response.data.applications || []);
        setAppliedJobIds(ids);
        return ids;
      }
    } catch (error) {
      console.error('Error fetching applications for applied status:', error);
    }
    return new Set<string>();
  };

  const fetchNearbyJobsFromAPI = async (
    currentSaved: any[] = savedJobs,
    currentApplied: Set<string> = appliedJobIds
  ) => {
    try {
      const response = await api.get('/student/nearby-jobs');
      if (response.data && response.data.status === 'success') {
        const newJobs = formatJobsWithMetadata(response.data.jobs, currentSaved, currentApplied);
        setRealNearbyJobs((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(newJobs)) return prev;
          return newJobs;
        });
      }
    } catch (error) {
      console.error('Error fetching nearby jobs:', error);
    } finally {
      setLoadingNearby(false);
    }
  };

  const fetchAllJobsFromAPI = async (
    currentSaved: any[] = savedJobs,
    currentApplied: Set<string> = appliedJobIds
  ) => {
    try {
      const response = await api.get('/student/all-jobs');
      if (response.data && response.data.status === 'success') {
        const newJobs = formatJobsWithMetadata(response.data.jobs, currentSaved, currentApplied);
        setRealAllJobs((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(newJobs)) return prev;
          return newJobs;
        });
      }
    } catch (error) {
      console.error('Error fetching all jobs:', error);
    } finally {
      setLoadingAll(false);
    }
  };

  const fetchAiMatchedJobsFromAPI = async (
    currentSaved: any[] = savedJobs,
    currentApplied: Set<string> = appliedJobIds
  ) => {
    try {
      const response = await api.get('/student/ai-matched-jobs');
      if (response.data && response.data.status === 'success') {
        const newJobs = formatJobsWithMetadata(response.data.matched_jobs, currentSaved, currentApplied);
        setAiMatchedJobs((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(newJobs)) return prev;
          return newJobs;
        });
        setMatchedSource(response.data.matched_by);
      }
    } catch (error) {
      console.error('Error fetching AI matched jobs:', error);
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchSavedJobs = async (
    currentApplied: Set<string> = appliedJobIds,
    showLoading: boolean = false
  ) => {
    if (showLoading) setLoadingSaved(true);
    try {
      const response = await api.get('/student/saved-jobs');
      if (response.data && response.data.status === 'success') {
        const fetchedSaved = response.data.jobs.map((job: any) => ({
          ...job,
          bookmarked: true,
          isApplied: currentApplied.has(job.id?.toString()),
        }));
        setSavedJobs((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(fetchedSaved)) return prev;
          return fetchedSaved;
        });
        return fetchedSaved;
      }
    } catch (error) {
      console.error('Error fetching saved jobs:', error);
    } finally {
      if (showLoading) setLoadingSaved(false);
    }
    return [];
  };

  const loadAllData = async (isInitial = false) => {
    await fetchStudentData();
    const applied = await fetchAppliedJobs();
    const saved = await fetchSavedJobs(applied, isInitial && savedJobs.length === 0);

    // 🚀 I-load agad ang All Jobs at Nearby Jobs para mag-render agad ang Home screen (~500ms)
    await Promise.all([
      fetchAllJobsFromAPI(saved, applied),
      fetchNearbyJobsFromAPI(saved, applied),
    ]);

    // 🚀 Background fetch para sa AI Matched Jobs nang hindi nag-freeze ang app
    fetchAiMatchedJobsFromAPI(saved, applied);
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData(true);
      const interval = setInterval(() => {
        loadAllData(false);
      }, 15000);

      return () => {
        clearInterval(interval);
      };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData(false);
    setRefreshing(false);
  };

  const handleJobPress = (jobId: string) => {
    router.push(`/students/job-details?id=${jobId}`);
  };

  const handleToggleBookmark = async (jobId: string, wasBookmarked: boolean) => {
    try {
      const response = await api.post('/student/toggle-save-job', { job_id: jobId });
      if (response.data && response.data.status === 'success') {
        showToast({
          type: 'success',
          title: wasBookmarked ? 'Job removed' : 'Job saved',
          message: response.data.message || (wasBookmarked
            ? 'Job removed from your saved bookmarks.'
            : 'Job added to your saved bookmarks.'),
        });
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
      showToast({ type: 'error', title: 'Could not update saved jobs', message: 'Please try again in a moment.' });
    }
  };

  const filterBySearch = (jobs: any[]) => {
    if (!searchQuery.trim()) {
      return jobs;
    }

    const scored = jobs.map((job) => {
      const companyName = job.household?.household_name || job.employer?.employer_name || 'Employer';
      const locationName = job.household?.location || job.employer?.location || 'Pinamalayan';
      const skills = parseJsonField(job.skills);
      const requirements = parseJsonField(job.requirements);

      const match = matchJobWithQuery(searchQuery, [
        { value: job.title, weight: 1.0 },       // Job Title ang primary (100%)
        { value: job.category, weight: 0.85 },   // Category
        { value: companyName, weight: 0.8 },     // Employer / Household name
        { value: skills, weight: 0.75 },         // Skills
        { value: requirements, weight: 0.7 },   // Requirements
        { value: locationName, weight: 0.65 },   // Location
        { value: job.description, weight: 0.6 }, // Description
      ]);

      return { job, score: match.score, matches: match.matches };
    });

    // PURE QUERY RELEVANCE: Kung ano ang pinakamalapit sa query, iyon ang nasa ibabaw!
    const matched = scored.filter((item) => item.matches);
    if (matched.length > 0) {
      return matched.sort((a, b) => b.score - a.score).map((item) => item.job);
    }

    // Fallback: ipakita ang mga pinakamalapit na resulta sa query
    const closest = scored
      .filter((item) => item.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.job);

    return closest;
  };

  const forYouJobs = buildForYouJobs(aiMatchedJobs, realAllJobs);

  const filteredJobsList =
    activeTab === 'nearby'
      ? filterBySearch(realNearbyJobs)
      : activeTab === 'ai_match'
        ? filterBySearch(forYouJobs)
        : activeTab === 'saved'
          ? filterBySearch(savedJobs)
          : filterBySearch(realAllJobs);

  const currentJobsList = moveAppliedJobsLast(filteredJobsList, appliedJobIds);

  const isCurrentLoading =
    activeTab === 'nearby'
      ? loadingNearby
      : activeTab === 'ai_match'
        ? loadingAi && forYouJobs.length === 0
        : activeTab === 'saved'
          ? loadingSaved
          : loadingAll;

  const { colors, isDark } = useDarkMode();
  const { hasUnread: hasUnreadNotifs } = useUnreadNotifications();

  const feedTitle = { all: 'Explore opportunities', nearby: 'Jobs near you', ai_match: 'Recommended for you', saved: 'Your saved jobs' }[activeTab];
  const feedDescription = {
    all: 'Find a role that match with your schedule.',
    nearby: 'Opportunities close to your profile location.',
    ai_match: matchedSource === 'fallback_math'
      ? 'Featured Premium openings plus matches based on your available days.'
      : 'Featured Premium openings plus matches based on your skills and schedule.',
    saved: 'Keep your favorite opportunities in one place.',
  }[activeTab];
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;

  const renderHeader = () => (
    <View>
      <View className="px-6 pt-3 pb-5">
        <Text className="text-xl font-medium mb-2" style={{ color: colors.textSecondary }} numberOfLines={1}>Hi, {studentName}</Text>
        <Text className="text-3xl font-bold leading-10 tracking-tight" style={{ color: colors.text }}>Find work that fits your schedule.</Text>
      </View>
      <View className="px-6 mb-4"><SearchBar placeholder="Search jobs, skills or employers" value={searchQuery} onChangeText={setSearchQuery} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-6 gap-2 pb-1" keyboardShouldPersistTaps="handled">
        {feedTabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} activeOpacity={0.8} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.id === 'ai_match' ? 'Recommended jobs' : tab.label} className="flex-row items-center gap-1.5 border rounded-xl px-4 py-3 min-h-12" style={{ backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }}>
              <MaterialIcons name={tab.icon} size={16} color={selected ? '#FFFFFF' : colors.textSecondary} />
              <Text className="text-sm font-semibold" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View className="px-6 pt-6 pb-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-lg font-bold shrink" style={{ color: colors.text }}>{searchQuery.trim() ? 'Search results' : feedTitle}</Text>
          <TouchableOpacity onPress={() => router.push('/students/(tabs)/search')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Open job search and filters" className="flex-row items-center gap-1 ml-auto min-h-10 pl-2">
            <MaterialIcons name="tune" size={17} color={accentText} />
            <Text className="text-xs font-semibold" style={{ color: accentText }}>Filters</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-s leading-5 mt-0.5" style={{ color: colors.textSecondary }}>{searchQuery.trim() ? `Results for “${searchQuery.trim()}”` : feedDescription}</Text>
      </View>
    </View>
  );

  const renderEmptyState = () => {
    if (isCurrentLoading) return (
      <View className="border rounded-3xl mx-6 px-6 py-8 items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text className="text-lg font-bold text-center mt-4" style={{ color: colors.text }}>Finding opportunities</Text>
        <Text className="text-sm leading-6 text-center mt-2 max-w-xs" style={{ color: colors.textSecondary }}>Your jobs will appear here shortly.</Text>
      </View>
    );
    const searching = Boolean(searchQuery.trim());
    const emptyTitle = searching ? 'No matching results' : activeTab === 'saved' ? 'Start your shortlist' : activeTab === 'nearby' ? 'No nearby openings yet' : activeTab === 'ai_match' ? 'No matches just yet' : 'New opportunities are on the way';
    const emptyMessage = searching ? 'Try a different job title, skill or employer name.' : activeTab === 'saved' ? 'Tap the bookmark on a job to keep it here for later.' : activeTab === 'nearby' ? 'Check your profile location or explore all available jobs.' : activeTab === 'ai_match' ? 'Keep your skills and availability up to date, or browse all jobs.' : 'Pull down to refresh and check for new job openings.';
    return (
      <View className="border rounded-3xl mx-6 px-6 py-8 items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <View className="w-16 h-16 rounded-3xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={searching ? 'search-off' : activeTab === 'saved' ? 'bookmark-border' : 'work-outline'} size={30} color={accentText} /></View>
        <Text className="text-lg font-bold text-center mt-4" style={{ color: colors.text }}>{emptyTitle}</Text>
        <Text className="text-sm leading-6 text-center mt-2 max-w-xs" style={{ color: colors.textSecondary }}>{emptyMessage}</Text>
        <TouchableOpacity onPress={() => { if (searching) setSearchQuery(''); else if (activeTab === 'all') onRefresh(); else setActiveTab('all'); }} activeOpacity={0.8} accessibilityRole="button" className="flex-row items-center gap-2 min-h-12 rounded-xl px-5 py-3 mt-6" style={{ backgroundColor: accentSurface }}>
          <Text className="text-sm font-semibold" style={{ color: accentText }}>{searching ? 'Clear search' : activeTab === 'all' ? 'Refresh jobs' : 'Explore all jobs'}</Text>
          <MaterialIcons name={activeTab === 'all' && !searching ? 'refresh' : 'arrow-forward'} size={16} color={accentText} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderJob = ({ item: job }: { item: any }) => {
    const owner = job.household || job.employer;
    const rawAvatar = owner?.avatar || '';
    const numericSalary = Number(job.salary);
    const isApplied = appliedJobIds.has(String(job.id));
    return (
      <View className="px-6">
        <HomeJobCard job={{
          jobTitle: job.title,
          companyName: owner?.household_name || owner?.employer_name || 'Employer',
          companyLogo: resolveMediaUrl(rawAvatar) ?? '',
          salary: Number.isFinite(numericSalary) ? `₱${numericSalary.toLocaleString('en-PH')}` : `₱${job.salary}`,
          salary_type: job.salary_type,
          location: owner?.location || 'Pinamalayan',
          distance: formatDistance(job.distance),
          schedule: getCleanSchedule(job),
          scheduleMatch: activeTab === 'ai_match' ? undefined : job.schedule_match,
          category: job.category || 'General',
          requirements: parseJsonField(job.requirements),
          skills: parseJsonField(job.skills),
          bookmarked: job.bookmarked ?? false,
          isApplied,
          verified: owner?.isVerified === true || owner?.isVerified === 1,
          applicants: job.applications_count ?? 0,
          featured: isFeaturedJob(job),
        }} onPress={() => handleJobPress(job.id.toString())} onBookmark={() => handleToggleBookmark(job.id.toString(), Boolean(job.bookmarked))} />
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <View className="flex-row items-center gap-3 px-6 pt-2 pb-3 w-full max-w-2xl self-center">
        <TouchableOpacity onPress={() => setDrawerVisible(true)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open navigation menu" className="w-12 h-12 items-center justify-center"><MaterialIcons name="menu" size={23} color={colors.text} /></TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>DiskarTech<Text style={{ color: colors.primary }}>.</Text></Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={hasUnreadNotifs ? 'Notifications, unread updates' : 'Notifications'} className="w-12 h-12 items-center justify-center">
          <MaterialIcons name="notifications-none" size={23} color={colors.text} />
          {hasUnreadNotifs && <View className="absolute top-2.5 right-3 w-2 h-2 rounded-full border-2" style={{ backgroundColor: colors.primary, borderColor: colors.surface }} />}
        </TouchableOpacity>
      </View>
      <FlatList
        data={isCurrentLoading ? [] : currentJobsList}
        keyExtractor={(job) => job.id.toString()}
        renderItem={renderJob}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderEmptyState()}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-6 max-w-2xl w-full self-center"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      />
      <SideDrawerMenu visible={isDrawerVisible} onClose={() => setDrawerVisible(false)} user={{ name: studentProfile.name, role: 'student', avatarUri: studentProfile.avatarUri, avatarInitials: studentProfile.avatarInitials, isVerified: studentProfile.isVerified, rejectionReason: studentProfile.rejectionReason }} />
    </View>
  );
}
