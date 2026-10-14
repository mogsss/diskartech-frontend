import api from '@/api/axios';
import InputField from '@/components/ui/InputField';
import InputSuggestions from '@/components/ui/InputSuggestions';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { REQUIREMENT_SUGGESTIONS } from '@/data/jobRequirements';
import { SKILL_SUGGESTIONS } from '@/data/skills';
import { AVAILABLE_DAYS, TIME_SLOTS, parseTimeSlots, serializeTimeSlots, toggleTimeSlot } from '@/data/jobSchedule';
import { useDarkMode } from '@/hooks/useDarkMode';
import { sendAppNotification } from '@/utils/notifications';
import { getSalaryType, getSalaryUnit, SalaryType } from '@/utils/jobRate';
import { JobQuota, jobQuotaAvailability, jobQuotaError, jobQuotaMessage, jobQuotaUsage, normalizeJobQuota } from '@/utils/jobQuota';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORY_OPTIONS = ['Food Service', 'Retail', 'Tutoring', 'Delivery', 'Cleaning', 'General', 'Other'];

export default function JobPostingScreen() {
  const { jobId, type } = useLocalSearchParams<{ jobId?: string; type?: string }>();
  const isEditing = Boolean(jobId);
  const isHousehold = type === 'household';
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const fieldBackground = isDark ? colors.background : '#F8FAFC';
  const accentBackground = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2';
  const accentColor = isDark ? colors.accent : '#B91C1C';

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
    onPrimaryPress: () => { },
  });

  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [jobQuota, setJobQuota] = useState<JobQuota | null>(null);

  useFocusEffect(useCallback(() => {
    if (isEditing || isHousehold) return;
    const controller = new AbortController();
    api.get('/employer/job-quota', { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setJobQuota(normalizeJobQuota(response.data.job_quota));
    }).catch(() => { /* The backend still checks every create request. */ });
    return () => controller.abort();
  }, [isEditing, isHousehold]));

  const showQuotaNotice = (message: string) => setNotificationConfig({
    visible: true, title: 'Active job limit reached', message, iconName: 'work-outline',
    primaryButtonText: 'OK', onPrimaryPress: () => setNotificationConfig(prev => ({ ...prev, visible: false })),
    secondaryButtonText: 'View plans', onSecondaryPress: () => { setNotificationConfig(prev => ({ ...prev, visible: false })); router.push('/employer/subscription'); },
  });

  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [salary, setSalary] = useState('');
  const [salaryType, setSalaryType] = useState<SalaryType>('day');
  const [isSalaryTypeOpen, setIsSalaryTypeOpen] = useState(false);

  // Category state at dropdown visibility toggle
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [customCategory, setCustomCategory] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // New postings start without a schedule; edit mode loads the saved selections.
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const timeOptions = [...new Set([...TIME_SLOTS, ...selectedTimeSlots])];

  const [requirementInput, setRequirementInput] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);

  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'requirements' | 'skills' | null>(null);
  const requirementInputRef = useRef<TextInput>(null);
  const skillInputRef = useRef<TextInput>(null);

  const [loading, setLoading] = useState(false);
  const submissionBusy = useRef(false);

  // States at PanResponder para sa textarea corner resize grip (katulad ng browser textarea)
  const [descriptionHeight, setDescriptionHeight] = useState(120);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);
  const descriptionHeightRef = useRef(120);
  const dragStartHeightRef = useRef(120);
  const isDraggingRef = useRef(false);

  const cornerResizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsScrollEnabled(false);
        dragStartHeightRef.current = descriptionHeightRef.current;
        isDraggingRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 4) {
          isDraggingRef.current = true;
        }
        const nextHeight = Math.max(100, Math.min(dragStartHeightRef.current + gestureState.dy, 450));
        descriptionHeightRef.current = nextHeight;
        setDescriptionHeight(nextHeight);
      },
      onPanResponderRelease: () => {
        setIsScrollEnabled(true);
        // Kung simpleng tap lang sa corner icon nang hindi nag-drag, i-toggle ang height
        if (!isDraggingRef.current) {
          const next = descriptionHeightRef.current > 160 ? 120 : 250;
          descriptionHeightRef.current = next;
          setDescriptionHeight(next);
        }
      },
      onPanResponderTerminate: () => {
        setIsScrollEnabled(true);
      },
    })
  ).current;

  // Kapag may jobId, i-fetch ang existing job details para mai-populate ang fields
  useEffect(() => {
    if (!jobId) return;

    const fetchJobForEdit = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/jobs/${jobId}`);
        if (response.data && response.data.status === 'success') {
          const j = response.data.job;
          setJobTitle(j.title || '');
          setDescription(j.description || '');
          setSalary(String(j.salary || ''));
          setSalaryType(getSalaryType(j.salary_type));
          if (j.category) {
            if (CATEGORY_OPTIONS.includes(j.category) && j.category !== 'Other') {
              setSelectedCategory(j.category);
              setCustomCategory('');
            } else {
              setSelectedCategory('Other');
              setCustomCategory(j.category === 'Other' ? '' : j.category);
            }
          }
          setSelectedTimeSlots(parseTimeSlots(j.time_slot));

          if (j.available_days) {
            try {
              const days = typeof j.available_days === 'string' ? JSON.parse(j.available_days) : j.available_days;
              if (Array.isArray(days)) setSelectedDays(days);
            } catch { }
          }

          if (j.requirements) {
            try {
              const reqs = typeof j.requirements === 'string' ? JSON.parse(j.requirements) : j.requirements;
              if (Array.isArray(reqs)) setRequirements(reqs);
            } catch { }
          }

          if (j.skills) {
            try {
              const sks = typeof j.skills === 'string' ? JSON.parse(j.skills) : j.skills;
              if (Array.isArray(sks)) setSkills(sks);
            } catch { }
          }
        }
      } catch (error) {
        console.error('Error fetching job for edit:', error);
        setNotificationConfig({
          visible: true,
          title: 'Error',
          message: 'Unable to load job details for editing.',
          iconName: 'error-outline',
          iconColor: '#DC2626',
          iconBgColor: 'bg-red-50',
          primaryButtonText: 'OK',
          onPrimaryPress: () => {
            setNotificationConfig((prev) => ({ ...prev, visible: false }));
            router.back();
          },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchJobForEdit();
  }, [jobId]);

  // Suriin kung verified ang employer o household
  useEffect(() => {
    const checkVerification = async () => {
      try {
        let verified = false;
        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          verified = parsed.isVerified === 1 || parsed.isVerified === true;
        }

        try {
          const res = await api.get('/user/profile');
          if (res.data?.profile) {
            verified = res.data.profile.isVerified === 1 || res.data.profile.isVerified === true;
            await AsyncStorage.setItem('userProfile', JSON.stringify(res.data.profile));
          }
        } catch { }

        setIsVerified(verified);

        if (!verified && !isEditing) {
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
              router.replace(`/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`);
            },
            secondaryButtonText: 'Go Back',
            onSecondaryPress: () => {
              setNotificationConfig((prev) => ({ ...prev, visible: false }));
              router.back();
            },
          });
        }
      } catch (err) {
        console.error('Error checking verification:', err);
      }
    };

    checkVerification();
  }, [isHousehold, isEditing]);

  // Toggle days selection
  const handleToggleDay = (day: string) => {
    setSelectedDays((previous) => previous.includes(day)
      ? previous.filter((selectedDay) => selectedDay !== day)
      : [...previous, day]
    );
  };

  // Salary input handler para siguradong numbers lang
  const handleSalaryChange = (text: string) => {
    const [whole, ...decimals] = text.replace(/[^0-9.]/g, '').split('.');
    setSalary(decimals.length ? whole + '.' + decimals.join('').slice(0, 2) : whole);
  };

  const handleAddRequirement = () => {
    if (!requirementInput.trim()) return;

    // Hiwalayin gamit ang comma para kung maglagay ng maramihan (e.g. "driver, delivery")
    const newItems = Array.from(
      new Set(
        requirementInput
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );

    if (newItems.length > 0) {
      setRequirements((prev) => {
        const unique = newItems.filter((item) => !prev.includes(item));
        return [...prev, ...unique];
      });
      setRequirementInput('');
    }
  };

  const handleRemoveRequirement = (indexToRemove: number) => {
    setRequirements(requirements.filter((_, index) => index !== indexToRemove));
  };

  const handleAddSkill = () => {
    if (!skillInput.trim()) return;

    // Hiwalayin gamit ang comma para kung maglagay ng maramihan (e.g. "driver, delivery")
    const newItems = Array.from(
      new Set(
        skillInput
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );

    if (newItems.length > 0) {
      setSkills((prev) => {
        const unique = newItems.filter((item) => !prev.includes(item));
        return [...prev, ...unique];
      });
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (indexToRemove: number) => {
    setSkills(skills.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (submissionBusy.current) return;
    if (isVerified === false) {
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
          router.replace(`/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`);
        },
        secondaryButtonText: 'Cancel',
        onSecondaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    // Include typed entries even when Add has not been pressed yet.
    if (!isEditing && !isHousehold && jobQuota && !jobQuota.can_post_job) {
      showQuotaNotice(jobQuotaMessage(jobQuota));
      return;
    }
    const pendingReqs = requirementInput.split(',').map((item) => item.trim()).filter(Boolean);
    const finalRequirements = [...new Set([
      ...requirements, ...pendingReqs,
    ].map((item) => item.trim()).filter(Boolean))];
    const pendingSkills = skillInput.split(',').map((item) => item.trim()).filter(Boolean);
    const finalSkills = [...new Set([
      ...skills, ...pendingSkills,
    ].map((item) => item.trim()).filter(Boolean))];

    const missingDetails = [
      !jobTitle.trim() && 'Job Title',
      !description.trim() && 'Description',
      !salary.trim() && 'Salary',
      finalRequirements.length === 0 && 'Requirements (at least one)',
      finalSkills.length === 0 && 'Skills Needed (at least one)',
    ].filter(Boolean);

    if (missingDetails.length > 0) {
      setNotificationConfig({
        visible: true,
        title: 'Incomplete Details',
        message: `Please complete the required fields: ${missingDetails.join(', ')}.`,
        iconName: 'warning',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'Got It',
        onPrimaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    if (selectedDays.length === 0 || selectedTimeSlots.length === 0) {
      setNotificationConfig({
        visible: true,
        title: 'Schedule Required',
        message: selectedDays.length === 0
          ? (selectedTimeSlots.length === 0
            ? 'Please select at least one work day and a time slot.'
            : 'Please select at least one work day.')
          : 'Please select a time slot.',
        iconName: 'calendar-today',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'Got It',
        onPrimaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    submissionBusy.current = true;
    setLoading(true);

    const finalCategory =
      selectedCategory === 'Other'
        ? (customCategory.trim() || 'General')
        : selectedCategory;

    try {
      if (isEditing) {
        // Edit Mode: I-update ang job gamit ang PUT /api/jobs/{id}
        const response = await api.put(`/jobs/${jobId}`, {
          title: jobTitle,
          description: description,
          salary: salary,
          salary_type: salaryType,
          category: finalCategory,
          available_days: selectedDays,
          time_slot: serializeTimeSlots(selectedTimeSlots),
          requirements: finalRequirements,
          skills: finalSkills,
        });

        if (response.data && response.data.status === 'success') {
          setNotificationConfig({
            visible: true,
            title: 'Job Updated',
            message: 'Job opening details have been updated successfully!',
            iconName: 'check-circle',
            iconColor: '#16A34A',
            iconBgColor: 'bg-emerald-50',
            primaryButtonText: 'Done',
            onPrimaryPress: () => {
              setNotificationConfig((prev) => ({ ...prev, visible: false }));
              router.back();
            },
          });
        } else {
          setNotificationConfig({
            visible: true,
            title: 'Notice',
            message: response.data?.message || 'Something went wrong.',
            iconName: 'info',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'OK',
            onPrimaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
          });
        }
      } else {
        // Create Mode
        const token = await AsyncStorage.getItem('userToken');

        const response = await fetch(`${api.defaults.baseURL}/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: jobTitle,
            description: description,
            salary: salary,
            salary_type: salaryType,
            category: finalCategory,
            available_days: selectedDays,
            time_slot: serializeTimeSlots(selectedTimeSlots),
            requirements: finalRequirements,
            skills: finalSkills,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // I-dispatch ang Firestore in-app & push notification sa mga estudyanteng pasok sa 3-5km radius
          try {
            const userDataStr = await AsyncStorage.getItem('userData');
            const currentUser = userDataStr ? JSON.parse(userDataStr) : null;
            const senderName = currentUser?.name || (isHousehold ? 'Household Employer' : 'Employer');

            if (Array.isArray(data.matched_students) && data.matched_students.length > 0) {
              data.matched_students.forEach((st: any) => {
                if (st.user_id) {
                  sendAppNotification({
                    recipientId: st.user_id,
                    senderId: currentUser?.id,
                    senderName: senderName,
                    title: `New job is near you!`,
                    body: `New job post: "${jobTitle}" ${st.formatted_distance || 'near your location'}. Open to apply!`,
                    type: 'new_job',
                    targetId: data.job?.id,
                  }).catch((err) => console.warn('Failed to notify student:', err));
                }
              });
            }
          } catch (notifErr) {
            console.warn('Error broadcasting new job notifications:', notifErr);
          }

          const matchedCount = data.matched_students_count || 0;
          const matchMsg = matchedCount > 0
            ? `Your job has been successfully posted`
            : 'Your job has been successfully posted!';

          setNotificationConfig({
            visible: true,
            title: 'Job Posted!',
            message: matchMsg,
            iconName: 'check-circle',
            iconColor: '#16A34A',
            iconBgColor: 'bg-emerald-50',
            primaryButtonText: 'Ok',
            onPrimaryPress: () => {
              setNotificationConfig((prev) => ({ ...prev, visible: false }));
              router.back();
            },
          });
        } else {
          const quotaError = jobQuotaError(data);
          if (response.status === 422 && quotaError) { showQuotaNotice(quotaError); return; }
          if (
            response.status === 403 ||
            data.needs_verification ||
            (data.message && data.message.toLowerCase().includes('document'))
          ) {
            setNotificationConfig({
              visible: true,
              title: 'Verification Required',
              message: data.message || 'Upload required documents to post a job.',
              iconName: 'verified-user',
              iconColor: '#DC2626',
              iconBgColor: 'bg-red-50',
              primaryButtonText: 'Upload Documents',
              onPrimaryPress: () => {
                setNotificationConfig((prev) => ({ ...prev, visible: false }));
                router.replace(`/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`);
              },
              secondaryButtonText: 'Cancel',
              onSecondaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
            });
            return;
          }

          setNotificationConfig({
            visible: true,
            title: 'Error',
            message: data.message || 'Something went wrong.',
            iconName: 'error-outline',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'OK',
            onPrimaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
          });
        }
      }
    } catch (error) {
      console.error(error);
      setNotificationConfig({
        visible: true,
        title: 'Network Error',
        message: 'Unable to complete the request. Please check your connection.',
        iconName: 'wifi-off',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: () => setNotificationConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      submissionBusy.current = false;
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setIsCategoryOpen(false); setActiveSuggestionField(null); }}>
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 36 }}
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={Platform.OS === 'ios' ? 0 : 100}
          extraHeight={120}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          scrollEnabled={isScrollEnabled}
        >
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="w-11 h-11 rounded-2xl border items-center justify-center"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: accentBackground }}>
              <MaterialIcons name={isHousehold ? 'home-work' : 'business-center'} size={18} color={accentColor} />
            </View>
          </View>

          <Text className="text-[28px] font-bold tracking-tight mb-2" style={{ color: colors.text }}>
            {isEditing ? 'Edit Job Posting' : isHousehold ? 'Post Household Opening' : 'Post a New Job'}
          </Text>
          <Text className="text-sm leading-5 mb-5" style={{ color: colors.textSecondary }}>
            {isEditing ? 'Keep your opening up to date for student applicants.' : 'Find the right student for your next opening.'}
          </Text>
          <View className="flex-row items-center gap-1.5 mb-5">
            <MaterialIcons name="info-outline" size={14} color={colors.textSecondary} />
            <Text className="text-xs" style={{ color: colors.textSecondary }}>Fields marked * are required</Text>
          </View>

          {!isEditing && !isHousehold && jobQuota && <View className="rounded-2xl border p-4 mb-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>{jobQuotaUsage(jobQuota)}</Text>
            <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{jobQuotaAvailability(jobQuota)}</Text>
          </View>}

          <JobFormSection number="01" title="Job details" subtitle="Tell applicants about the role." icon="work-outline">
            <InputField
              label="Job Title *"
              placeholder="e.g. Service Crew, Barista"
              value={jobTitle}
              onChangeText={setJobTitle}
              icon="work-outline"
            />

            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Job Description *</Text>
              <View
                style={{ height: descriptionHeight, backgroundColor: fieldBackground, borderColor: colors.border }}
                className="border rounded-xl relative overflow-hidden"
              >
                <TextInput
                  style={{ flex: 1, padding: 14, paddingBottom: 24, paddingRight: 28, color: colors.text }}
                  className="text-sm"
                  placeholder="What will the student do? Describe the tasks and expectations."
                  placeholderTextColor={colors.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                />
                <View
                  {...cornerResizePanResponder.panHandlers}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 6, paddingBottom: 6 }}
                >
                  <MaterialCommunityIcons name="resize-bottom-right" size={18} color={colors.textSecondary} />
                </View>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Pay rate *</Text>
              <View className="flex-row items-center border rounded-xl px-3.5 h-[52px]" style={{ backgroundColor: fieldBackground, borderColor: colors.border }}>
                <Text className="text-lg font-semibold mr-2" style={{ color: colors.textSecondary }}>{'\u20B1'}</Text>
                <TextInput
                  className="flex-1 text-base p-0"
                  style={{ color: colors.text }}
                  placeholder="e.g. 500"
                  placeholderTextColor={colors.textSecondary}
                  value={salary}
                  onChangeText={handleSalaryChange}
                  keyboardType="decimal-pad"
                  accessibilityLabel={salaryType === 'hour' ? 'Hourly rate in pesos' : 'Daily rate in pesos'}
                  onFocus={() => setIsSalaryTypeOpen(false)}
                />
                <TouchableOpacity
                  onPress={() => { Keyboard.dismiss(); setIsSalaryTypeOpen(!isSalaryTypeOpen); }}
                  accessibilityRole="button"
                  accessibilityLabel={'Pay basis: ' + getSalaryUnit(salaryType, 'long')}
                  accessibilityState={{ expanded: isSalaryTypeOpen }}
                  className="flex-row items-center justify-center gap-1 min-h-12 pl-3 ml-2 border-l"
                  style={{ borderLeftColor: colors.border }}
                >
                  <Text className="text-sm font-semibold" style={{ color: colors.primary }}>{getSalaryUnit(salaryType)}</Text>
                  <MaterialIcons name={isSalaryTypeOpen ? 'expand-less' : 'expand-more'} size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
              {isSalaryTypeOpen && (
                <View className="mt-2 border rounded-xl p-1 gap-1" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  {(['day', 'hour'] as const).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      onPress={() => { setSalaryType(unit); setIsSalaryTypeOpen(false); }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: salaryType === unit }}
                      accessibilityLabel={unit === 'hour' ? 'Per hour' : 'Per day'}
                      className="flex-row items-center justify-between rounded-lg px-3 min-h-12"
                      style={{ backgroundColor: salaryType === unit ? accentBackground : colors.surface }}
                    >
                      <Text className="text-sm font-medium" style={{ color: salaryType === unit ? accentColor : colors.text }}>{unit === 'hour' ? 'Per hour' : 'Per day'}</Text>
                      <MaterialIcons name={salaryType === unit ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={salaryType === unit ? colors.accent : colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Job Category</Text>
              <TouchableOpacity
                onPress={() => setIsCategoryOpen(!isCategoryOpen)}
                accessibilityRole="button"
                accessibilityLabel={'Job category: ' + selectedCategory}
                accessibilityState={{ expanded: isCategoryOpen }}
                className="flex-row items-center justify-between border rounded-xl px-3.5 h-[52px]"
                style={{ backgroundColor: fieldBackground, borderColor: colors.border }}
              >
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="category" size={18} color={colors.textSecondary} />
                  <Text className="text-sm" style={{ color: colors.text }}>{selectedCategory}</Text>
                </View>
                <MaterialIcons name={isCategoryOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              {isCategoryOpen && (
                <ScrollView
                  style={{ maxHeight: 220, flexGrow: 0, backgroundColor: fieldBackground, borderColor: colors.border }}
                  className="border rounded-xl mt-2"
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {CATEGORY_OPTIONS.map((category, index) => {
                    const selected = selectedCategory === category;
                    return (
                      <TouchableOpacity
                        key={category}
                        onPress={() => { setSelectedCategory(category); setIsCategoryOpen(false); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className="flex-row items-center justify-between px-3.5 py-3"
                        style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border, backgroundColor: selected ? accentBackground : undefined }}
                      >
                        <Text className="text-sm" style={{ color: selected ? accentColor : colors.text, fontWeight: selected ? '600' : '400' }}>{category}</Text>
                        {selected && <MaterialIcons name="check" size={18} color={accentColor} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {selectedCategory === 'Other' && (
                <View className="mt-3">
                  <InputField
                    label="Category name *"
                    placeholder="e.g. Photography, Warehouse"
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    icon="edit"
                    autoFocus
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              )}
            </View>
          </JobFormSection>

          <JobFormSection number="02" title="Work schedule" subtitle="Choose when you need help." icon="calendar-today">
            <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Available Days *</Text>
            <View className="flex-row gap-1 mb-5">
              {AVAILABLE_DAYS.map((day) => {
                const selected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => handleToggleDay(day)}
                    accessibilityRole="button"
                    accessibilityLabel={day}
                    accessibilityState={{ selected }}
                    className="flex-1 items-center justify-center rounded-xl border py-3"
                    style={{ minHeight: 44, backgroundColor: selected ? accentBackground : fieldBackground, borderColor: selected ? accentColor : colors.border }}
                  >
                    <Text className="text-[11px] font-semibold" style={{ color: selected ? accentColor : colors.textSecondary }}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className="text-sm font-semibold mb-1" style={{ color: colors.text }}>Time Slots *</Text>
            <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>Choose up to 2 time slots, or select Whole Day.</Text>
            <View className="flex-row flex-wrap gap-2">
              {timeOptions.map((slot, index) => {
                const selected = selectedTimeSlots.includes(slot);
                const disabled = !selected && slot !== 'Whole Day' && selectedTimeSlots.length >= 2;
                const slotIcon = (['wb-sunny', 'light-mode', 'dark-mode', 'schedule'] as const)[index] ?? 'schedule';
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setSelectedTimeSlots((current) => toggleTimeSlot(current, slot))}
                    disabled={disabled}
                    accessibilityRole="checkbox"
                    accessibilityLabel={slot}
                    accessibilityState={{ checked: selected, disabled }}
                    className="rounded-2xl border p-3"
                    style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: selected ? accentBackground : fieldBackground, borderColor: selected ? accentColor : colors.border, opacity: disabled ? 0.45 : 1 }}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <MaterialIcons name={slotIcon} size={20} color={selected ? accentColor : colors.textSecondary} />
                      <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={16} color={selected ? accentColor : colors.textSecondary} />
                    </View>
                    <Text className="text-sm font-semibold mb-1" style={{ color: selected ? accentColor : colors.text }}>{slot.split(' (')[0]}</Text>
                    <Text className="text-[10px]" style={{ color: colors.textSecondary }}>{slot.match(/\((.*)\)/)?.[1] || (slot === 'Whole Day' ? 'Full-day schedule' : 'Saved schedule')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </JobFormSection>

          <JobFormSection number="03" title="Candidate profile" subtitle="Help students see if they are a good fit." icon="person-outline">
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Requirements *</Text>
                {requirements.length > 0 && <Text className="text-xs" style={{ color: colors.textSecondary }}>{requirements.length} added</Text>}
              </View>
              <View className="flex-row items-center gap-2 mb-2">
                <TextInput
                  ref={requirementInputRef}
                  className="flex-1 border rounded-xl px-3.5 text-sm"
                  style={{ height: 48, paddingVertical: 0, backgroundColor: fieldBackground, borderColor: colors.border, color: colors.text }}
                  placeholder="e.g. Valid ID, Resume"
                  placeholderTextColor={colors.textSecondary}
                  value={requirementInput}
                  onChangeText={setRequirementInput}
                  onFocus={() => setActiveSuggestionField('requirements')}
                  onSubmitEditing={handleAddRequirement}
                  returnKeyType="done"
                  accessibilityLabel="Requirements"
                />
                <TouchableOpacity
                  onPress={handleAddRequirement}
                  accessibilityRole="button"
                  accessibilityLabel="Add requirements"
                  className="w-12 h-12 rounded-xl items-center justify-center"
                  style={{ backgroundColor: accentBackground }}
                >
                  <MaterialIcons name="add" size={23} color={accentColor} />
                </TouchableOpacity>
              </View>
              {activeSuggestionField === 'requirements' && (
                <InputSuggestions
                  value={requirementInput}
                  options={REQUIREMENT_SUGGESTIONS}
                  existingValues={requirements}
                  label="Suggested requirements"
                  onChangeText={(value) => { setRequirementInput(value); requirementInputRef.current?.focus(); }}
                />
              )}
              <View className="flex-row flex-wrap gap-2">
                {requirements.map((requirement, index) => (
                  <View key={index} className="flex-row items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border" style={{ maxWidth: '100%', backgroundColor: fieldBackground, borderColor: colors.border }}>
                    <Text className="text-xs" style={{ color: colors.text, flexShrink: 1 }}>{requirement}</Text>
                    <TouchableOpacity onPress={() => handleRemoveRequirement(index)} accessibilityRole="button" accessibilityLabel={'Remove ' + requirement} hitSlop={6} className="w-6 h-6 items-center justify-center">
                      <MaterialIcons name="close" size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <View className="border-t pt-4" style={{ borderTopColor: colors.border }}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Skills Needed *</Text>
                {skills.length > 0 && <Text className="text-xs" style={{ color: colors.textSecondary }}>{skills.length} added</Text>}
              </View>
              <View className="flex-row items-center gap-2 mb-2">
                <TextInput
                  ref={skillInputRef}
                  className="flex-1 border rounded-xl px-3.5 text-sm"
                  style={{ height: 48, paddingVertical: 0, backgroundColor: fieldBackground, borderColor: colors.border, color: colors.text }}
                  placeholder="e.g. Driving, Delivery"
                  placeholderTextColor={colors.textSecondary}
                  value={skillInput}
                  onChangeText={setSkillInput}
                  onFocus={() => setActiveSuggestionField('skills')}
                  onSubmitEditing={handleAddSkill}
                  returnKeyType="done"
                  accessibilityLabel="Skills Needed"
                />
                <TouchableOpacity
                  onPress={handleAddSkill}
                  accessibilityRole="button"
                  accessibilityLabel="Add skills"
                  className="w-12 h-12 rounded-xl items-center justify-center"
                  style={{ backgroundColor: accentBackground }}
                >
                  <MaterialIcons name="add" size={23} color={accentColor} />
                </TouchableOpacity>
              </View>
              {activeSuggestionField === 'skills' && (
                <InputSuggestions
                  value={skillInput}
                  options={SKILL_SUGGESTIONS}
                  existingValues={skills}
                  label="Suggested skills"
                  onChangeText={(value) => { setSkillInput(value); skillInputRef.current?.focus(); }}
                />
              )}
              <View className="flex-row flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <View key={index} className="flex-row items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border" style={{ maxWidth: '100%', backgroundColor: fieldBackground, borderColor: colors.border }}>
                    <Text className="text-xs" style={{ color: colors.text, flexShrink: 1 }}>{skill}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSkill(index)} accessibilityRole="button" accessibilityLabel={'Remove ' + skill} hitSlop={6} className="w-6 h-6 items-center justify-center">
                      <MaterialIcons name="close" size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
            <Text className="text-[11px] leading-4 mt-4" style={{ color: colors.textSecondary }}>
              Type your own or select a suggestion. Use commas to add multiple entries.
            </Text>
          </JobFormSection>

          <View className="px-1 mt-1">
            <Text className="text-sm font-semibold mb-1" style={{ color: colors.text }}>{isEditing ? 'Ready to save?' : 'Ready to post?'}</Text>
            <Text className="text-xs leading-5 mb-4" style={{ color: colors.textSecondary }}>Review your details before submitting.</Text>
            <PrimaryButton
              title={loading ? (isEditing ? 'Saving Changes...' : 'Posting Job...') : (isEditing ? 'Save Changes' : 'Submit Job Posting')}
              onPress={handleSubmit}
              size="medium"
              icon={<MaterialIcons name={isEditing ? 'check' : 'arrow-forward'} size={18} color="#FFFFFF" />}
              disabled={loading}
              loading={loading}
            />
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
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
    </View>
  );
}

function JobFormSection({ number, title, subtitle, icon, children }: {
  number: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="rounded-3xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-center gap-3 mb-5">
        <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2' }}>
          <MaterialIcons name={icon} size={20} color={isDark ? colors.accent : '#B91C1C'} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold mb-0.5" style={{ color: colors.text }}>{title}</Text>
          <Text className="text-[11px] leading-4" style={{ color: colors.textSecondary }}>{subtitle}</Text>
        </View>
        <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>{number}</Text>
      </View>
      {children}
    </View>
  );
}
