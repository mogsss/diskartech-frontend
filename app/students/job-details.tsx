import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  Share,
} from 'react-native';
import api from '@/api/axios';
import { resolveMediaUrl } from '@/utils/media';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import {
  ensureChatRoom,
  getStudentParticipantFromStorage,
  isGenericName,
  resolveOwnerFromJob,
} from '@/utils/chat';
import { sendAppNotification } from '@/utils/notifications';
import { getCreatedApplicationId } from '@/utils/notificationFeed';
import { getAppliedJobIds } from '@/utils/jobApplications';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryLabel, getSalaryUnit } from '@/utils/jobRate';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';
import WeeklyScheduleSummary from '@/components/schedule/WeeklyScheduleSummary';
import ScheduleMatchNotice from '@/components/schedule/ScheduleMatchNotice';

export default function JobDetailsScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [hasReported, setHasReported] = useState(false);

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

  // Helper para i-parse ang JSON arrays (requirements, skills)
  const parseJsonField = (field: any) => {
    if (!field) return [];
    if (Array.isArray(field)) return field.filter((item): item is string => typeof item === 'string' && !!item.trim());
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
    } catch {
      return [];
    }
  };

  // Helper para kumuha ng initials ng employer o household
  const getInitials = (name: string) => {
    if (!name) return 'DT';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchJobDetails = async (isBackground = false) => {
        if (!id) return;
        try {
          if (!isBackground) setLoading(true);
          const response = await api.get(`/jobs/${id}`);
          if (isMounted && response.data && response.data.status === 'success') {
            const newJob = response.data.job;
            setJob((prev: any) => {
              if (JSON.stringify(prev) === JSON.stringify(newJob)) return prev;
              return newJob;
            });
            const reported = response.data.has_reported !== undefined
              ? Boolean(response.data.has_reported)
              : response.data.job?.has_reported !== undefined
                ? Boolean(response.data.job.has_reported)
                : false;
            setHasReported((prev) => (prev !== reported ? reported : prev));
          }

          // I-check kung naka-save na sa database (initial load lang, hindi kailangan sa background polling)
          if (!isBackground) {
            const savedResponse = await api.get('/student/saved-jobs');
            if (isMounted && savedResponse.data && savedResponse.data.status === 'success') {
              const isAlreadySaved = savedResponse.data.jobs.some(
                (savedJob: any) => savedJob.id.toString() === id?.toString()
              );
              setIsBookmarked(isAlreadySaved);
            }
          }

          // I-check kung na-applyan na ang trabaho
          const appResponse = await api.get('/student/applications');
          if (isMounted && appResponse.data && appResponse.data.status === 'success') {
            const hasApplied = getAppliedJobIds(appResponse.data.applications || []).has(String(id));
            setIsApplied((prev) => (prev !== hasApplied ? hasApplied : prev));
          }
        } catch (error) {
          if (!isBackground) console.error('Error fetching job details:', error);
        } finally {
          if (isMounted && !isBackground) {
            setLoading(false);
          }
        }
      };

      fetchJobDetails(false);

      const pollInterval = setInterval(() => {
        if (isMounted) fetchJobDetails(true);
      }, 15000);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
      };
    }, [id])
  );

  const handleToggleBookmark = async () => {
    try {
      const response = await api.post('/student/toggle-save-job', { job_id: id });
      if (response.data && response.data.status === 'success') {
        const nextState = !isBookmarked;
        setIsBookmarked(nextState);
        setNotification({
          visible: true,
          title: nextState ? 'Job Saved' : 'Job Unsaved',
          message:
            response.data.message ||
            (nextState ? 'Job added to your saved bookmarks.' : 'Job removed from your saved bookmarks.'),
          iconName: nextState ? 'bookmark' : 'bookmark-border',
          iconColor: '#DC2626',
          iconBgColor: 'bg-red-50',
          primaryButtonText: 'OK',
          onPrimaryPress: closeNotification,
        });
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
      setNotification({
        visible: true,
        title: 'Notice',
        message: 'Unable to save job at this time.',
        iconName: 'error-outline',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: closeNotification,
      });
    }
  };

  const handleShareJob = async () => {
    try {
      setMenuVisible(false);
      await Share.share({
        title: job?.title || 'Job Opportunity on DiskarTech',
        message: `Check out this job opportunity: "${job?.title || 'Job'}" by ${companyName} on DiskarTech!`,
      });
    } catch (err) {
      console.error('Error sharing job:', err);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <MaterialIcons name="work-off" size={40} color={colors.accent} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 12, marginBottom: 4 }}>Job Not Found</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
          This job may have been closed or is no longer available.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: '#DC2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const companyName =
    job.household?.household_name ||
    job.employer?.employer_name ||
    job.employer?.business_name ||
    job.employer?.company_name ||
    job.company_name ||
    job.companyName ||
    job.business_name ||
    'Employer';

  const location =
    job.location ||
    job.household?.location ||
    job.employer?.location ||
    'Location upon request';

  const requirements = parseJsonField(job.requirements);
  const skills = parseJsonField(job.skills);
  let parsedDays: unknown = job.available_days;
  if (typeof parsedDays === 'string') {
    try { parsedDays = JSON.parse(parsedDays); } catch { /* Keep plain-text schedules. */ }
  }
  const workDays = Array.isArray(parsedDays)
    ? parsedDays.filter((day): day is string => typeof day === 'string' && !!day.trim()).join(', ') || 'Not specified'
    : typeof parsedDays === 'string' && parsedDays.trim() ? parsedDays : 'Not specified';
  const amount = Number(job.salary);
  const hasRate = job.salary !== null && job.salary !== undefined && String(job.salary).trim() !== '' && Number.isFinite(amount);
  const dailyRate = hasRate ? '\u20B1' + amount.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : 'Not specified';
  const accentColor = isDark ? colors.accent : '#B91C1C';


  const rawLogo =
    job.employer?.profile_image ||
    job.employer?.avatar ||
    job.household?.profile_image ||
    job.household?.avatar ||
    job.company_logo ||
    job.companyLogo;

  const companyLogoUrl = resolveMediaUrl(rawLogo);

  const initials = getInitials(companyName);

  const handleApplyJob = async () => {
    try {
      let isStudentVerified = false;
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          isStudentVerified = parsed.isVerified === 1 || parsed.isVerified === true;
        }
      } catch { }

      if (!isStudentVerified) {
        try {
          const profileRes = await api.get('/user/profile');
          const p = profileRes.data?.profile;
          if (p) {
            isStudentVerified = p.isVerified === 1 || p.isVerified === true;
            await AsyncStorage.setItem('userProfile', JSON.stringify(p));
          }
        } catch { }
      }

      if (!isStudentVerified) {
        setNotification({
          visible: true,
          title: 'Verification Required',
          message:
            'Please verify your student account first before applying. Upload your required documents (School ID / COR) in your Verification Status.',
          iconName: 'verified-user',
          iconColor: '#DC2626',
          iconBgColor: 'bg-red-50',
          primaryButtonText: 'Verify Account',
          onPrimaryPress: () => {
            closeNotification();
            router.push('/students/verification-status');
          },
          secondaryButtonText: 'Cancel',
          onSecondaryPress: closeNotification,
        });
        return;
      }

      const response = await api.post('/student/apply-job', {
        job_id: job.id,
      });

      if (response.data && response.data.status === 'success') {
        setIsApplied(true);
        setNotification({
          visible: true,
          title: 'Application Submitted!',
          message: 'You have successfully applied for this job. You can monitor your application status anytime.',
          iconName: 'check-circle',
          iconColor: '#16A34A',
          iconBgColor: 'bg-emerald-50',
          primaryButtonText: 'View Applications',
          onPrimaryPress: () => {
            closeNotification();
            router.push('/students/(tabs)/applications');
          },
          secondaryButtonText: 'Done',
          onSecondaryPress: closeNotification,
        });

        try {
          const owner = resolveOwnerFromJob(job);
          const student = await getStudentParticipantFromStorage();
          const createdAppId = getCreatedApplicationId(response.data);
          if (!createdAppId) throw new Error('The application response did not include an application ID.');
          if (owner.owner_user_id && owner.owner_user_id !== 'unknown') {
            await sendAppNotification({
              recipientId: owner.owner_user_id,
              senderId: student.student_user_id,
              senderName: student.student_name,
              title: 'New Applicant',
              body: `${student.student_name || 'A student'} applied for "${job.title || 'Job'}".`,
              type: 'application',
              targetId: createdAppId,
              applicationId: createdAppId,
              jobId: job.id,
            });
          }
        } catch (notifErr) {
          console.error('Error sending application notification:', notifErr);
        }
      }
    } catch (error: any) {
      if (
        error.response?.status === 403 ||
        error.response?.data?.needs_verification ||
        (error.response?.data?.message &&
          error.response.data.message.toLowerCase().includes('verify'))
      ) {
        setNotification({
          visible: true,
          title: 'Verification Required',
          message:
            error.response?.data?.message ||
            'Please verify your account first before applying for jobs. Upload your required documents in your Verification Status.',
          iconName: 'verified-user',
          iconColor: '#DC2626',
          iconBgColor: 'bg-red-50',
          primaryButtonText: 'Verify Account',
          onPrimaryPress: () => {
            closeNotification();
            router.push('/students/verification-status');
          },
          secondaryButtonText: 'Cancel',
          onSecondaryPress: closeNotification,
        });
        return;
      }

      const errorMessage =
        error.response?.data?.message || 'An error occurred while applying.';
      setNotification({
        visible: true,
        title: 'Notice',
        message: errorMessage,
        iconName: 'error-outline',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: closeNotification,
      });
    }
  };

  const handleSendMessage = async () => {
    try {
      if (!job) return;
      const student = await getStudentParticipantFromStorage();
      let owner = resolveOwnerFromJob(job);
      if (isGenericName(owner.owner_name) && companyName && !isGenericName(companyName)) {
        owner = {
          ...owner,
          owner_name: companyName,
        };
      }
      const chatId = await ensureChatRoom({
        jobId: job.id,
        jobTitle: job.title || 'Job Position',
        owner,
        student,
      });

      router.push(`/chat?id=${chatId}` as any);
    } catch (error) {
      console.error('Error starting chat:', error);
      setNotification({
        visible: true,
        title: 'Notice',
        message: 'Unable to open chat at this time.',
        iconName: 'error-outline',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: closeNotification,
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.surface} style={isDark ? 'light' : 'dark'} withSpacer={false} />
      <View className="px-5 pb-3 border-b" style={{ paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              activeOpacity={0.7}
              className="w-11 h-11 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>Job details</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handleToggleBookmark}
              accessibilityRole="button"
              accessibilityLabel={isBookmarked ? 'Unsave job' : 'Save job'}
              accessibilityState={{ selected: isBookmarked }}
              activeOpacity={0.7}
              className="w-11 h-11 rounded-xl items-center justify-center"
              style={{ backgroundColor: isBookmarked ? (isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2') : (isDark ? colors.background : '#F1F5F9') }}
            >
              <MaterialIcons name={isBookmarked ? 'bookmark' : 'bookmark-border'} size={21} color={isBookmarked ? accentColor : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="More options"
              activeOpacity={0.7}
              className="w-11 h-11 rounded-xl items-center justify-center"
              style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
            >
              <MaterialIcons name="more-vert" size={21} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
      >
        <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="self-start px-2.5 py-1.5 rounded-lg mb-3" style={{ maxWidth: '100%', backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
            <Text className="text-[11px] font-medium" style={{ color: colors.textSecondary }}>{job.category || 'General'}</Text>
          </View>
          <Text className="text-2xl font-bold tracking-tight leading-8 mb-4" style={{ color: colors.text }}>{job.title}</Text>
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 rounded-xl border overflow-hidden items-center justify-center" style={{ borderColor: colors.border, backgroundColor: isDark ? colors.background : '#FEF2F2' }}>
              {companyLogoUrl ? (
                <Image source={{ uri: companyLogoUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <Text className="text-base font-bold" style={{ color: accentColor }}>{initials}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-semibold tracking-wide mb-1" style={{ color: colors.textSecondary }}>{job.household ? 'HOUSEHOLD' : 'EMPLOYER'}</Text>
              <Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{companyName}</Text>
            </View>
          </View>
          <View className="flex-row border-t pt-4" style={{ borderTopColor: colors.border }}>
            <View className="flex-1 pr-3" style={{ minWidth: 0 }}>
              <Text className="text-[10px] font-semibold tracking-wide mb-2" style={{ color: colors.textSecondary }}>{getSalaryLabel(job.salary_type).toUpperCase()}</Text>
              <Text className="text-2xl font-bold tracking-tight" style={{ color: colors.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{dailyRate}</Text>
              {hasRate && <Text className="text-[11px] mt-1" style={{ color: colors.textSecondary }}>{getSalaryUnit(job.salary_type, 'long')}</Text>}
            </View>
            <View className="flex-1 pl-3 border-l" style={{ borderLeftColor: colors.border }}>
              <View className="flex-row items-center gap-1 mb-2">
                <MaterialIcons name="location-on" size={14} color={colors.textSecondary} />
                <Text className="text-[10px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>LOCATION</Text>
              </View>
              <Text className="text-xs font-medium leading-5" style={{ color: colors.text }}>{location}</Text>
            </View>
          </View>
          <View className="border-t pt-4 mt-4" style={{ borderTopColor: colors.border }}>
            <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>About the role</Text>
            <Text className="text-sm leading-6" style={{ color: colors.text }}>{job.description || 'No description provided for this opening.'}</Text>
          </View>
        </View>

        <ApplicationSection title="Work schedule" icon="calendar-today">
          <ScheduleMatchNotice match={job.schedule_match} />
          {job.schedule_slots?.length ? <WeeklyScheduleSummary slots={job.schedule_slots} /> : <>
          <View className="mb-3">
            <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Work days</Text>
            <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{workDays}</Text>
          </View>
          <View className="border-t pt-3" style={{ borderTopColor: colors.border }}>
            <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Time slot</Text>
            <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{job.time_slot || 'Not specified'}</Text>
          </View>
          </>}
        </ApplicationSection>
        {(skills.length > 0 || requirements.length > 0) && (
          <ApplicationSection title="Skills & requirements" icon="checklist">
            {skills.length > 0 && (
              <View>
                <Text className="text-sm font-semibold mb-3" style={{ color: colors.text }}>Skills needed</Text>
                <View className="flex-row flex-wrap gap-2">
                  {skills.map((skill, index) => (
                    <View key={index} className="rounded-lg px-3 py-2" style={{ maxWidth: '100%', backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
                      <Text className="text-xs font-medium leading-4" style={{ color: colors.text, flexShrink: 1 }}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {requirements.length > 0 && (
              <View className={skills.length > 0 ? 'border-t pt-4 mt-4' : undefined} style={skills.length > 0 ? { borderTopColor: colors.border } : undefined}>
                <Text className="text-sm font-semibold mb-3" style={{ color: colors.text }}>Requirements</Text>
                <View className="gap-3">
                  {requirements.map((requirement, index) => (
                    <View key={index} className="flex-row items-start gap-2.5">
                      <MaterialIcons name="check-circle-outline" size={16} color={accentColor} accessible={false} style={{ marginTop: 2 }} />
                      <Text className="flex-1 text-sm leading-5" style={{ color: colors.text }}>{requirement}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ApplicationSection>
        )}
      </ScrollView>

      <View className="px-5 pt-3 border-t" style={{ paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.surface, borderTopColor: colors.border }}>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handleSendMessage}
            accessibilityRole="button"
            accessibilityLabel="Message employer"
            activeOpacity={0.7}
            className="flex-1 flex-row items-center justify-center gap-2 px-3 py-3 rounded-2xl border"
            style={{ minHeight: 48, backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border }}
          >
            <MaterialIcons name="chat-bubble-outline" size={18} color={colors.textSecondary} />
            <Text className="text-[13px] font-semibold" style={{ color: colors.text }}>Message</Text>
          </TouchableOpacity>
          {isApplied ? (
            <View
              accessibilityLabel="Application submitted"
              className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-2xl border"
              style={{ flex: 1.4, minHeight: 48, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0' }}
            >
              <MaterialIcons name="check-circle" size={18} color={isDark ? '#6EE7B7' : '#047857'} />
              <Text className="text-sm font-semibold" style={{ color: isDark ? '#6EE7B7' : '#047857' }}>Applied</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleApplyJob}
              accessibilityRole="button"
              accessibilityLabel="Apply now"
              activeOpacity={0.8}
              className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-600"
              style={{ flex: 1.4, minHeight: 48 }}
            >
              <Text className="text-sm font-semibold text-white">Apply now</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Three-dots Menu Dropdown Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={{
              position: 'absolute',
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 8,
              borderWidth: 1,
              borderColor: colors.border,
              width: 224,
              top: insets.top + 60,
              right: 20,
              elevation: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 14,
            }}
          >
            {/* Save / Unsave Option */}
            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                handleToggleBookmark();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 12 }}
            >
              <MaterialIcons
                name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                size={20}
                color={isBookmarked ? '#DC2626' : colors.text}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  {isBookmarked ? 'Saved' : 'Save Job'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {isBookmarked ? 'Remove from saved' : 'Add to bookmarks'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Share Option */}
            <TouchableOpacity
              onPress={handleShareJob}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 12 }}
            >
              <MaterialIcons name="share" size={20} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Share Job</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>Send to classmates</Text>
              </View>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4, marginHorizontal: 8 }} />

            {/* Report Option */}
            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);
                if (hasReported) {
                  setNotification({
                    visible: true,
                    title: 'Report Already Submitted',
                    message:
                      'You have already reported this job. Our safety and moderation team is currently reviewing your report.',
                    iconName: 'check-circle',
                    iconColor: '#16A34A',
                    iconBgColor: isDark ? 'rgba(22, 163, 74, 0.15)' : 'bg-emerald-50',
                    primaryButtonText: 'Understood',
                    onPrimaryPress: closeNotification,
                  });
                } else {
                  router.push({
                    pathname: '/students/report',
                    params: {
                      targetName: job?.title || companyName,
                      targetType: 'job',
                      jobId: String(job?.id || id || ''),
                      reportedUserId: String(job?.employer?.user_id || job?.household?.user_id || job?.user_id || ''),
                    },
                  });
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 12 }}
            >
              <MaterialIcons name="outlined-flag" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#EF4444' }}>
                  {hasReported ? 'Already Reported' : 'Report Job'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {hasReported ? 'Under admin review' : 'Flag suspicious job'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
      />
    </View>
  );
}
