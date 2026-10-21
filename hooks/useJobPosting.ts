import api from '@/api/axios';
import type NotificationModal from '@/components/ui/modals/NotificationModal';
import { CATEGORY_OPTIONS } from '@/data/jobCategories';
import { parseTimeSlots, serializeTimeSlots } from '@/data/jobSchedule';
import { ScheduleDraft, ScheduleSlot, scheduleDraft, scheduleError } from '@/utils/weeklySchedule';
import { supportsWeeklySchedules } from '@/utils/weeklyScheduleApi';
import { sendAppNotification } from '@/utils/notifications';
import { getSalaryType, SalaryType } from '@/utils/jobRate';
import { JobQuota, jobQuotaError, jobQuotaMessage, normalizeJobQuota } from '@/utils/jobQuota';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';

interface JobPostingOptions {
  jobId?: string;
  type?: string;
}

export function useJobPosting({ jobId, type }: JobPostingOptions) {
  const isEditing = Boolean(jobId);
  const isHousehold = type === 'household';

  const [notificationConfig, setNotificationConfig] = useState<ComponentProps<typeof NotificationModal>>({
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

  // Saved category values are shared by the details fields and submission.
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [customCategory, setCustomCategory] = useState('');

  // New postings start without a schedule; edit mode loads the saved selections.
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [weeklySlots, setWeeklySlots] = useState<ScheduleSlot[]>([]);
  const weeklySchedule = { days: selectedDays as ScheduleDraft['days'], slots: weeklySlots };
  const setWeeklySchedule = (value: ScheduleDraft) => {
    setSelectedDays(value.days);
    setWeeklySlots(value.slots);
  };

  const [requirementInput, setRequirementInput] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);

  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const submissionBusy = useRef(false);

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
          setWeeklySlots(scheduleDraft(j.schedule_slots, j.available_days, j.time_slot).slots);

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

    const effectiveSchedule = weeklySlots.length ? weeklySchedule : scheduleDraft([], selectedDays, serializeTimeSlots(selectedTimeSlots));
    if (scheduleError(effectiveSchedule)) {
      setNotificationConfig({
        visible: true,
        title: 'Schedule Required',
        message: scheduleError(effectiveSchedule) || 'Please set a weekly schedule.',
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
      if (!await supportsWeeklySchedules()) {
        setNotificationConfig({ visible: true, title: 'Schedule update unavailable', message: 'Weekly schedules are not ready on the server yet. Your draft is kept here. Please try again after the server update.',
          primaryButtonText: 'OK', onPrimaryPress: () => setNotificationConfig(prev => ({ ...prev, visible: false })) });
        return;
      }
      if (isEditing) {
        // Edit Mode: I-update ang job gamit ang PUT /api/jobs/{id}
        const response = await api.put(`/jobs/${jobId}`, {
          title: jobTitle,
          description: description,
          salary: salary,
          salary_type: salaryType,
          category: finalCategory,
          available_days: selectedDays,
          schedule_slots: effectiveSchedule.slots,
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
            schedule_slots: effectiveSchedule.slots,
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

  return {
    isEditing,
    isHousehold,
    loading,
    jobQuota,
    notificationConfig,
    handleSubmit,
    details: {
      jobTitle, setJobTitle, description, setDescription,
      salary, handleSalaryChange, salaryType, setSalaryType,
      selectedCategory, setSelectedCategory, customCategory, setCustomCategory,
    },
    schedule: { selectedDays, handleToggleDay, selectedTimeSlots, setSelectedTimeSlots, weeklySchedule, setWeeklySchedule, defaultToToday: isHousehold && !isEditing },
    candidate: {
      requirementInput, setRequirementInput, requirements, handleAddRequirement, handleRemoveRequirement,
      skillInput, setSkillInput, skills, handleAddSkill, handleRemoveSkill,
    },
  };
}

export type JobPostingForm = ReturnType<typeof useJobPosting>;
