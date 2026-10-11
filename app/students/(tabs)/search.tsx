import HomeJobCard from '@/components/student/HomeJobCard';
import SearchBar from '@/components/ui/SearchBar';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import api from '@/api/axios';
import { resolveMediaUrl } from '@/utils/media';
import { matchJobWithQuery } from '@/utils/fuzzySearch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import NotificationModal from '@/components/ui/modals/NotificationModal';

const salaryFilters = ['₱50-₱75/day', '₱75-₱100/day', '₱100-₱150/day', '₱150+/day'];
const distanceFilters = ['< 1 km', '< 3 km', '< 5 km', 'Any'];
const scheduleFilters = ['Flexible', 'Morning', 'Afternoon', 'Evening', 'Whole Day', 'Midnight', 'Weekends'];
const defaultCategories = ['Food Service', 'Retail', 'Tutoring', 'Delivery', 'Admin', 'Freelance'];

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

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<any>>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bookmarkErrorVisible, setBookmarkErrorVisible] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // States para sa mga karagdagang filters
  const [selectedSalary, setSelectedSalary] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);

  // States para sa API data
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
          const avatarUrl = resolveMediaUrl(profile.avatar_url ?? profile.avatar ?? profile.profile_picture);
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

  const getCleanSchedule = (job: any) => {
    if (!job.time_slot) return 'Flexible';
    const days = parseJsonField(job.available_days);
    return days.length ? `${days.join(', ')} · ${job.time_slot}` : job.time_slot;
  };

  const formatDistance = (rawDist: any) => {
    if (rawDist == null || isNaN(parseFloat(rawDist))) return '';
    const dist = parseFloat(rawDist);
    if (dist < 0.1) return '< 100m away';
    if (dist < 1) return `${Math.round(dist * 1000)}m away`;
    return `${dist.toFixed(1)} km away`;
  };


  const fetchJobsData = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await api.get('/student/all-jobs');
      if (response.data && response.data.status === 'success') {
        setAllJobs(response.data.jobs);
      } else {
        setLoadError(true);
      }

      // Kunin ang saved jobs para malaman kung alin ang naka-pula
      const savedResponse = await api.get('/student/saved-jobs');
      if (savedResponse.data && savedResponse.data.status === 'success') {
        setSavedJobs(savedResponse.data.jobs);
      }

      // Kunin ang student applications para malaman kung alin ang applied na
      const appResponse = await api.get('/student/applications');
      if (appResponse.data && appResponse.data.status === 'success') {
        setAppliedJobs(appResponse.data.applications || []);
      }
    } catch (error) {
      console.error('Error fetching jobs for search:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobsData();
    }, [fetchJobsData])
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
      setBookmarkErrorVisible(true);
    }
  };

  // Pinagsamang filtering at fuzzy matching logic para sa totoong API data
  const { filteredJobs, isShowingClosest } = useMemo(() => {
    if (!allJobs || allJobs.length === 0) {
      return { filteredJobs: [], isShowingClosest: false };
    }

    // 1. Unang i-filter ayon sa Category, Schedule, Salary, at Distance
    const baseFiltered = allJobs.filter((job) => {
      const matchesCategory = selectedCategory
        ? job.category?.trim().toLowerCase() === selectedCategory.toLowerCase()
        : true;

      const timeSlot = String(job.time_slot || '').toLowerCase();
      const days = parseJsonField(job.available_days).map((day: string) => String(day).toLowerCase());
      const matchesSchedule = !selectedSchedule ? true
        : selectedSchedule === 'Weekends' ? days.some((day: string) => day.startsWith('sat') || day.startsWith('sun'))
          : selectedSchedule === 'Flexible' ? !timeSlot || timeSlot.includes('flexible')
            : timeSlot.includes(selectedSchedule.toLowerCase()) || days.some((day: string) => day.includes(selectedSchedule.toLowerCase()));

      let matchesSalary = true;
      if (selectedSalary) {
        const sal = parseFloat(job.salary) || 0;
        if (selectedSalary === '₱50-₱75/day') matchesSalary = sal >= 50 && sal <= 75;
        else if (selectedSalary === '₱75-₱100/day') matchesSalary = sal >= 75 && sal <= 100;
        else if (selectedSalary === '₱100-₱150/day') matchesSalary = sal >= 100 && sal <= 150;
        else if (selectedSalary === '₱150+/day') matchesSalary = sal >= 150;
        // These filters compare daily rates; hourly amounts are a different basis.
        matchesSalary = matchesSalary && job.salary_type !== 'hour';
      }

      let matchesDistance = true;
      if (selectedDistance && selectedDistance !== 'Any') {
        const dist = parseFloat(job.distance);
        matchesDistance = Number.isFinite(dist) && dist >= 0;
        if (matchesDistance) {
          if (selectedDistance === '< 1 km') matchesDistance = dist < 1;
          else if (selectedDistance === '< 3 km') matchesDistance = dist < 3;
          else if (selectedDistance === '< 5 km') matchesDistance = dist < 5;
        }
      }

      return matchesCategory && matchesSchedule && matchesSalary && matchesDistance;
    });

    if (!searchQuery.trim()) {
      return { filteredJobs: baseFiltered, isShowingClosest: false };
    }

    // 2. Fuzzy / Typo matching gamit ang query proximity at field weights
    const scoredJobs = baseFiltered.map((job) => {
      const companyName = job.household?.household_name || job.employer?.employer_name || 'Employer';
      const locationName = job.household?.location || job.employer?.location || 'Pinamalayan';
      const skills = parseJsonField(job.skills);
      const requirements = parseJsonField(job.requirements);

      const match = matchJobWithQuery(searchQuery, [
        { value: job.title, weight: 1.0 },       // Job Title ang pinaka-mataas na priority (100%)
        { value: job.category, weight: 0.85 },   // Category
        { value: companyName, weight: 0.8 },     // Employer / Household name
        { value: skills, weight: 0.75 },         // Skills
        { value: requirements, weight: 0.7 },   // Requirements
        { value: locationName, weight: 0.65 },   // Location
        { value: job.description, weight: 0.6 }, // Description
      ]);

      return {
        job,
        score: match.score,
        matches: match.matches,
        isApproximate: match.isApproximate,
      };
    });

    // PURE QUERY RELEVANCE: Kung ano ang pinakamalapit na result sa query, iyon ang nasa ibabaw!
    const matchedJobs = scoredJobs
      .filter((item) => item.matches)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.job);

    if (matchedJobs.length > 0) {
      return { filteredJobs: matchedJobs, isShowingClosest: false };
    }

    // 3. Fallback: kung walang direct match, ipakita ang mga pinakamalapit na resulta sa query (score > 0.05)
    const closestJobs = scoredJobs
      .filter((item) => item.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.job);

    if (closestJobs.length > 0) {
      return { filteredJobs: closestJobs, isShowingClosest: true };
    }

    return { filteredJobs: [], isShowingClosest: false };
  }, [allJobs, searchQuery, selectedCategory, selectedSchedule, selectedSalary, selectedDistance]);

  const { colors, isDark } = useDarkMode();
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;
  const categories = useMemo(() => {
    const options = [...defaultCategories, ...allJobs.map((job) => job.category).filter(Boolean)];
    const unique = new Map<string, string>();
    options.forEach((category: string) => {
      const label = category.trim();
      if (label) unique.set(label.toLowerCase(), label);
    });
    return ['All', ...unique.values()];
  }, [allJobs]);
  const activeFilters = [
    selectedCategory && { label: selectedCategory, clear: () => setSelectedCategory(null) },
    selectedSalary && { label: selectedSalary, clear: () => setSelectedSalary(null) },
    selectedDistance && selectedDistance !== 'Any' && { label: selectedDistance, clear: () => setSelectedDistance(null) },
    selectedSchedule && { label: selectedSchedule, clear: () => setSelectedSchedule(null) },
  ].filter((filter): filter is { label: string; clear: () => void } => Boolean(filter));

  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedSalary(null);
    setSelectedDistance(null);
    setSelectedSchedule(null);
  };

  const renderFilterGroup = (
    title: string,
    icon: keyof typeof MaterialIcons.glyphMap,
    options: string[],
    selected: string | null,
    select: (value: string | null) => void,
  ) => (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-2">
        <MaterialIcons name={icon} size={16} color={colors.textSecondary} />
        <Text className="text-sm font-semibold" style={{ color: colors.text }}>{title}</Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => select(isSelected ? null : option)} activeOpacity={0.75} className="flex-row items-center gap-1.5 min-h-12 px-3 py-2 rounded-xl border" style={{ backgroundColor: isSelected ? accentSurface : colors.surface, borderColor: isSelected ? colors.primary : colors.border }}>
              {isSelected && <MaterialIcons name="check" size={14} color={accentText} />}
              <Text className="text-xs font-medium" style={{ color: isSelected ? accentText : colors.textSecondary }}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderListHeader = () => (
    <View>
      {!showFilters && activeFilters.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-6 gap-2 pt-3" keyboardShouldPersistTaps="handled">
          {activeFilters.map((filter) => (
            <TouchableOpacity key={filter.label} onPress={filter.clear} accessibilityRole="button" accessibilityLabel={`Remove ${filter.label} filter`} activeOpacity={0.75} className="flex-row items-center gap-2 min-h-10 px-3 py-2 rounded-lg" style={{ backgroundColor: accentSurface }}>
              <Text className="text-xs font-medium" style={{ color: accentText }}>{filter.label}</Text>
              <MaterialIcons name="close" size={14} color={accentText} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View className="px-6 pt-5 pb-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-lg font-bold shrink" style={{ color: colors.text }}>{searchQuery.trim() ? 'Search results' : 'Available opportunities'}</Text>
          {!showFilters && activeFilters.length > 0 && (
            <TouchableOpacity onPress={resetFilters} accessibilityRole="button" activeOpacity={0.75} className="min-h-10 justify-center">
              <Text className="text-xs font-semibold" style={{ color: accentText }}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
        {!loading && <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} found{searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ''}</Text>}
        {isShowingClosest && !loading && (
          <View className="flex-row items-start gap-2 rounded-xl p-3 mt-3" style={{ backgroundColor: isDark ? '#422F16' : '#FFFBEB' }}>
            <MaterialIcons name="search" size={18} color={isDark ? '#FCD34D' : '#B45309'} />
            <Text className="flex-1 text-xs leading-5" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>No exact match. These are the closest opportunities to your search.</Text>
          </View>
        )}
        {loadError && allJobs.length > 0 && (
          <TouchableOpacity onPress={onRefresh} activeOpacity={0.75} accessibilityRole="button" className="flex-row items-center gap-2 rounded-xl p-3 mt-3" style={{ backgroundColor: accentSurface }}>
            <MaterialIcons name="refresh" size={18} color={accentText} />
            <Text className="flex-1 text-xs leading-5" style={{ color: accentText }}>Could not refresh all job details. Tap to retry.</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View className="mx-6 border rounded-3xl px-6 py-8 items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      {loading ? <ActivityIndicator size="large" color={colors.primary} /> : (
        <View className="w-16 h-16 rounded-3xl items-center justify-center" style={{ backgroundColor: accentSurface }}>
          <MaterialIcons name={loadError ? 'wifi-off' : 'search-off'} size={30} color={accentText} />
        </View>
      )}
      <Text className="text-lg font-bold text-center mt-4" style={{ color: colors.text }}>{loading ? 'Finding opportunities' : loadError ? 'Unable to load jobs' : 'No matching opportunities'}</Text>
      <Text className="text-sm leading-6 text-center mt-2" style={{ color: colors.textSecondary }}>{loading ? 'Your search results will appear here shortly.' : loadError ? 'Check your connection and try again.' : 'Try a different keyword or clear your filters to explore more jobs.'}</Text>
      {!loading && (
        <TouchableOpacity onPress={() => { if (loadError) onRefresh(); else { setSearchQuery(''); resetFilters(); } }} activeOpacity={0.8} accessibilityRole="button" className="min-h-12 flex-row items-center gap-2 px-4 rounded-xl mt-5" style={{ backgroundColor: accentSurface }}>
          <Text className="text-sm font-semibold" style={{ color: accentText }}>{loadError ? 'Try again' : 'Clear search & filters'}</Text>
          <MaterialIcons name={loadError ? 'refresh' : 'arrow-forward'} size={16} color={accentText} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderJob = ({ item: job }: { item: any }) => {
    const owner = job.household || job.employer;
    const rawAvatar = owner?.avatar || '';
    const salary = Number(job.salary);
    return (
      <View className="px-6">
        <HomeJobCard
          job={{
            jobTitle: job.title,
            companyName: owner?.household_name || owner?.employer_name || 'Employer',
            companyLogo: resolveMediaUrl(rawAvatar) ?? '',
            salary: Number.isFinite(salary) ? `₱${salary.toLocaleString('en-PH')}` : `₱${job.salary}`,
            salary_type: job.salary_type,
            location: owner?.location || 'Pinamalayan',
            distance: formatDistance(job.distance),
            schedule: getCleanSchedule(job),
            category: job.category || 'General',
            requirements: parseJsonField(job.requirements),
            skills: parseJsonField(job.skills),
            bookmarked: savedJobs.some((saved) => saved.id?.toString() === job.id?.toString()),
            isApplied: appliedJobs.some((application) => (application.job_id || application.job?.id)?.toString() === job.id?.toString()),
            verified: owner?.isVerified === true || owner?.isVerified === 1,
            applicants: job.applications_count ?? 0,
          }}
          onPress={() => router.push(`/students/job-details?id=${job.id}`)}
          onBookmark={() => handleToggleBookmark(job.id.toString())}
        />
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center shrink-0 px-6 pt-2 pb-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => setDrawerVisible(true)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open navigation menu" className="w-12 h-12 border rounded-2xl items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <MaterialIcons name="menu" size={23} color={colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>Search jobs</Text>
            <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>Find your next opportunity</Text>
          </View>
          <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowFilters(true); }} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open search filters" accessibilityState={{ expanded: showFilters }} className="w-12 h-12 border rounded-2xl items-center justify-center" style={{ backgroundColor: showFilters || activeFilters.length ? accentSurface : colors.surface, borderColor: showFilters ? colors.primary : colors.border }}>
            <MaterialIcons name="tune" size={23} color={showFilters || activeFilters.length ? accentText : colors.text} />
            {activeFilters.length > 0 && <View className="absolute top-1 right-1 min-w-4 h-4 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}><Text className="text-xs font-semibold text-white">{activeFilters.length}</Text></View>}
          </TouchableOpacity>
        </View>
        <View className="mt-3"><SearchBar placeholder="Search jobs, skills or employers" value={searchQuery} onChangeText={setSearchQuery} onSearch={() => setShowFilters(false)} /></View>
        <Text className="text-xs font-medium mt-3 mb-2" style={{ color: colors.textSecondary }}>Browse by category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-1" keyboardShouldPersistTaps="handled">
          {categories.map((category) => {
            const selected = category === 'All' ? !selectedCategory : selectedCategory?.toLowerCase() === category.toLowerCase();
            return (
              <TouchableOpacity key={category} onPress={() => { setSelectedCategory(category === 'All' ? null : category); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected }} className="min-h-12 px-4 py-2.5 rounded-xl border justify-center" style={{ backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }}>
                <Text className="text-xs font-semibold" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        ref={listRef}
        className="flex-1"
        data={loading ? [] : filteredJobs}
        keyExtractor={(job) => job.id.toString()}
        renderItem={renderJob}
        ListHeaderComponent={renderListHeader()}
        ListEmptyComponent={renderEmptyState()}
        contentContainerClassName="pb-6 w-full max-w-2xl self-center"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      />
      <Modal transparent visible={showFilters} animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <View className="flex-1 justify-end" style={{ paddingTop: insets.top, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close search filters" onPress={() => setShowFilters(false)} className="absolute inset-0" />
          <View accessibilityViewIsModal className="w-full max-w-2xl self-center rounded-t-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '85%', paddingBottom: Math.max(insets.bottom, 16) }}>
            <View className="shrink-0 px-6 pt-5 pb-4">
              <View className="flex-row items-center justify-between gap-3">
                <Text accessibilityRole="header" className="text-xl font-bold shrink" style={{ color: colors.text }}>Refine your search</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)} accessibilityRole="button" accessibilityLabel="Close search filters" activeOpacity={0.75} className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}>
                  <MaterialIcons name="close" size={20} color={accentText} />
                </TouchableOpacity>
              </View>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Choose the rate, distance and schedule that work for you.</Text>
            </View>
            <ScrollView className="grow-0 shrink" contentContainerClassName="px-6 pt-1 pb-2" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {renderFilterGroup('Daily rate', 'payments', salaryFilters, selectedSalary, setSelectedSalary)}
              {renderFilterGroup('Distance', 'near-me', distanceFilters, selectedDistance, setSelectedDistance)}
              {renderFilterGroup('Work schedule', 'schedule', scheduleFilters, selectedSchedule, setSelectedSchedule)}
            </ScrollView>
            <View className="shrink-0 flex-row items-center gap-3 px-6 pt-4 border-t" style={{ borderColor: colors.border }}>
              <TouchableOpacity onPress={resetFilters} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Clear all filters" className="min-h-12 px-4 rounded-xl border items-center justify-center" style={{ borderColor: colors.border }}>
                <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>Clear filters</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowFilters(false); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }} activeOpacity={0.8} accessibilityRole="button" className="flex-1 min-h-12 px-3 rounded-xl items-center justify-center" style={{ backgroundColor: colors.primary }}>
                <Text className="text-sm font-semibold text-white">Show results</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <SideDrawerMenu visible={isDrawerVisible} onClose={() => setDrawerVisible(false)} user={{ name: studentProfile.name, role: 'student', avatarUri: studentProfile.avatarUri, avatarInitials: studentProfile.avatarInitials, isVerified: studentProfile.isVerified, rejectionReason: studentProfile.rejectionReason }} />
      <NotificationModal visible={bookmarkErrorVisible} title="Could not update saved jobs" message="Please try again in a moment." iconName="bookmark-border" onPrimaryPress={() => setBookmarkErrorVisible(false)} />
    </View>
  );
}
