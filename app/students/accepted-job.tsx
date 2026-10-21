import api from '@/api/axios';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import {
  ensureChatRoom,
  getStudentParticipantFromStorage,
  isGenericName,
  resolveOwnerFromJob,
} from '@/utils/chat';
import { formatDate } from '@/utils/helpers';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import CertificateModal from '@/components/common/CertificateModal';
import MapViewerModal from '@/components/ui/modals/MapViewerModal';
import * as WebBrowser from 'expo-web-browser';
import { sendAppNotification } from '@/utils/notifications';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryUnit } from '@/utils/jobRate';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AcceptedJobScreen() {
  const { colors } = useDarkMode();
  const { applicationId, jobId } = useLocalSearchParams<{
    applicationId?: string;
    jobId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [ownerId, setOwnerId] = useState('employer_default');
  const [companyName, setCompanyName] = useState('Employer');
  const [employerAvatar, setEmployerAvatar] = useState('');

  // Auto-redirect to unified Application Details screen
  useEffect(() => {
    if (applicationId) {
      router.replace({
        pathname: '/students/application-details' as any,
        params: { applicationId },
      });
    }
  }, [applicationId]);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certData, setCertData] = useState<any>(null);
  const [requestingCert, setRequestingCert] = useState(false);
  const [loadingCert, setLoadingCert] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [contractReview, setContractReview] = useState<any>(null);

  // Helper para sa initials kung walang picture
  const getInitials = (name: string) => {
    if (!name) return 'EM';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Helper para sa kumpletong avatar url
  const formatAvatarUrl = (raw: string) => {
    if (!raw) return '';
    if (raw.startsWith('http')) return raw;
    const baseUrl = api.defaults.baseURL
      ? api.defaults.baseURL.replace('/api', '')
      : 'https://diskartech-backend.onrender.com';
    return `${baseUrl}/storage/${raw.replace(/^\//, '')}`;
  };

  const getBaseWebUrl = () => {
    return api.defaults.baseURL
      ? api.defaults.baseURL.replace('/api', '')
      : 'https://diskartech-backend.onrender.com';
  };

  const handleRequestCertificate = () => {
    Alert.alert(
      'Request Certificate of Employment',
      'Would you like to send an official request to your employer to issue your Working Student Certificate of Employment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            try {
              setRequestingCert(true);
              const appId = application?.id || applicationId;
              const response = await api.post(`/student/applications/${appId}/request-certificate`);
              if (response.data && response.data.status === 'success') {
                Alert.alert(
                  'Request Submitted',
                  'Your certificate request has been sent to the employer. You will be notified once it is approved and ready.'
                );
                setApplication((prev: any) => ({
                  ...prev,
                  certificate_status: 'requested',
                  certificate_requested_at: new Date().toISOString(),
                }));

                // Live notification sa employer
                try {
                  const targetOwnerUser =
                    job?.employer?.user_id ||
                    job?.household?.user_id ||
                    job?.user_id ||
                    job?.employer?.user?.id ||
                    job?.household?.user?.id;
                  if (targetOwnerUser) {
                    await sendAppNotification({
                      recipientId: targetOwnerUser,
                      title: 'Certificate Request Received 📜',
                      body: `${application?.student?.student_name || 'Your working student'} requested a Working Student Certificate of Employment for "${job?.title || 'the job'}". Tap to review and issue.`,
                      type: 'application_status',
                      targetId: appId,
                    });
                  }
                } catch (notifErr) {
                  console.error('Error sending request notification to employer:', notifErr);
                }
              }
            } catch (err: any) {
              console.error('Error requesting certificate:', err);
              Alert.alert('Notice', err.response?.data?.message || 'Unable to request certificate at this time.');
            } finally {
              setRequestingCert(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenCertificate = async () => {
    try {
      setLoadingCert(true);
      const appId = application?.id || applicationId;
      const response = await api.get(`/applications/${appId}/certificate-data`);
      if (response.data && response.data.certificate) {
        setCertData(response.data.certificate);
        setCertModalVisible(true);
      } else {
        Alert.alert('Notice', 'Certificate details could not be loaded.');
      }
    } catch (err) {
      console.error('Error loading certificate:', err);
      Alert.alert('Notice', 'Unable to load certificate details at this time.');
    } finally {
      setLoadingCert(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const appId = application?.id || applicationId;
      const url = `${getBaseWebUrl()}/certificate/${appId}/view`;
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.error('Error opening certificate browser:', err);
      Linking.openURL(`${getBaseWebUrl()}/certificate/${application?.id || applicationId}/view`);
    }
  };

  // Helper para i-parse ang JSON arrays o comma-separated strings (requirements, skills)
  const parseJsonField = (field: any): string[] => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    try {
      const parsed = typeof field === 'string' ? JSON.parse(field) : field;
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return typeof field === 'string' && field.includes(',')
        ? field.split(',').map((s) => s.trim()).filter(Boolean)
        : [String(field)];
    }
  };

  const getCleanDays = (jobData: any) => {
    try {
      if (jobData?.available_days) {
        const parsed =
          typeof jobData.available_days === 'string'
            ? JSON.parse(jobData.available_days)
            : jobData.available_days;
        if (Array.isArray(parsed)) {
          return parsed.join(', ');
        }
      }
    } catch {
      return jobData?.available_days || 'Flexible Days';
    }
    return jobData?.available_days || 'Flexible Days';
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
          let matchedApp: any = null;
          let targetJobId = jobId;
          const targetAppId = applicationId || application?.id;

          // 1. Subukang kunin direkta ang application ID para sa napakabilis na live status update
          if (targetAppId) {
            try {
              const directAppRes = await api.get(`/student/applications/${targetAppId}`);
              if (directAppRes.data && directAppRes.data.status === 'success' && directAppRes.data.application) {
                matchedApp = directAppRes.data.application;
                if (isMounted) {
                  setApplication(matchedApp);
                }
                if (!targetJobId) {
                  targetJobId = matchedApp.job_id || matchedApp.job?.id;
                }
              }
            } catch (directErr) {
              // fallback sa list sa ibaba
            }
          }

          // Fallback sa buong listahan ng student applications
          if (!matchedApp) {
            try {
              const appRes = await api.get('/student/applications');
              if (appRes.data && appRes.data.status === 'success') {
                const list = appRes.data.applications || [];
                if (applicationId) {
                  matchedApp = list.find(
                    (a: any) => a.id.toString() === applicationId.toString()
                  );
                } else if (jobId) {
                  matchedApp = list.find(
                    (a: any) =>
                      a.job_id?.toString() === jobId.toString() ||
                      a.job?.id?.toString() === jobId.toString()
                  );
                }
                if (matchedApp && isMounted) {
                  setApplication(matchedApp);
                  if (!targetJobId) {
                    targetJobId = matchedApp.job_id || matchedApp.job?.id;
                  }
                }
              }
            } catch (appErr) {
              if (!isBackground) console.error('Error fetching student applications:', appErr);
            }
          }

          // 2. Kunin ang buong detalye ng Job kasama ang employer o household profile (sa initial load o kung wala pa si job)
          if (targetJobId && (!isBackground || !job)) {
            try {
              const jobRes = await api.get(`/jobs/${targetJobId}`);
              if (jobRes.data && jobRes.data.status === 'success' && isMounted) {
                const jobData = jobRes.data.job;
                setJob(jobData);

                const resolvedOwnerId =
                  jobData.employer_id ||
                  jobData.household_id ||
                  jobData.user_id ||
                  'employer_default';
                setOwnerId(resolvedOwnerId.toString());

                let rawAvatar = '';
                let resolvedName = 'Employer';

                if (jobData.household_id && jobData.household) {
                  resolvedName = jobData.household.household_name || 'Household Employer';
                  rawAvatar = jobData.household.avatar || '';
                } else if (jobData.employer_id && jobData.employer) {
                  resolvedName = jobData.employer.employer_name || 'Business Employer';
                  rawAvatar = jobData.employer.avatar || '';
                } else {
                  resolvedName =
                    jobData.household?.household_name ||
                    jobData.employer?.employer_name ||
                    'Employer';
                  rawAvatar = jobData.household?.avatar || jobData.employer?.avatar || '';
                }

                setCompanyName(resolvedName);
                setEmployerAvatar(formatAvatarUrl(rawAvatar));
              }
            } catch (jobErr) {
              if (!isBackground) console.error('Error fetching job details for accepted screen:', jobErr);
              if (matchedApp?.job && isMounted) {
                setJob(matchedApp.job);
              }
            }
          }

          // 3. Kunin ang review status para sa kontrata (kung terminated o active)
          const finalAppId = matchedApp?.id || applicationId || application?.id;
          if (finalAppId) {
            try {
              const revRes = await api.get(`/applications/${finalAppId}/reviews`);
              if (isMounted && revRes.data && revRes.data.status === 'success') {
                setContractReview(revRes.data.data);
              }
            } catch (rErr) {}
          }
        } catch (err) {
          if (!isBackground) console.error('Error loading accepted job data:', err);
        } finally {
          if (!isBackground && isMounted) {
            setLoading(false);
          }
        }
      };

      fetchData(false);

      // Live auto-polling bawat 2.5 seconds para real-time makita agad ang Certificate approval nang hindi nagba-back
      const pollInterval = setInterval(() => {
        fetchData(true);
      }, 2500);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
      };
    }, [applicationId, jobId])
  );

  // Handler para magsimula ng chat
  const handleOpenChat = async () => {
    if (!job && !application?.job) return;
    try {
      setIsOpeningChat(true);
      const activeJob = job || application?.job || {};
      const targetJobId = activeJob.id || jobId || application?.job_id;
      const student = await getStudentParticipantFromStorage();

      const jobData = {
        ...activeJob,
        id: targetJobId,
        employer_id: ownerId,
        employer: { employer_name: companyName, avatar: employerAvatar },
      };

      const owner = resolveOwnerFromJob(jobData);
      if (isGenericName(owner.owner_name) && companyName && !isGenericName(companyName)) {
        owner.owner_name = companyName;
      }

      const chatId = await ensureChatRoom({
        jobId: targetJobId,
        jobTitle: activeJob.title || 'Accepted Job',
        owner,
        student,
      });

      router.push(`/chat?id=${chatId}` as any);
    } catch (error) {
      console.error('Error starting chat with employer:', error);
      Alert.alert('Notice', 'Unable to open chat at this time. Please try again.');
    } finally {
      setIsOpeningChat(false);
    }
  };

  // Contacts & directions handlers (komprehensibong paghahanap sa lahat ng posibleng field mula sa backend)
  const contactNumber =
    job?.employer?.phone ||
    job?.employer?.contact_number ||
    job?.employer?.cp_number ||
    job?.employer?.phone_number ||
    job?.household?.phone ||
    job?.household?.contact_number ||
    job?.household?.cp_number ||
    job?.household?.phone_number ||
    job?.phone ||
    job?.contact_number ||
    job?.employer?.user?.phone ||
    job?.household?.user?.phone ||
    application?.job?.employer?.phone ||
    application?.job?.household?.phone ||
    application?.job?.employer?.contact_number ||
    application?.job?.household?.contact_number ||
    application?.employer?.phone ||
    application?.household?.phone ||
    '';

  const employerEmail =
    job?.employer?.user?.email ||
    job?.household?.user?.email ||
    job?.user?.email ||
    job?.employer?.email ||
    job?.household?.email ||
    job?.email ||
    job?.contact_email ||
    job?.employer_email ||
    job?.household_email ||
    job?.employer?.business_email ||
    job?.employer?.company_email ||
    application?.job?.employer?.user?.email ||
    application?.job?.household?.user?.email ||
    application?.job?.user?.email ||
    application?.employer_email ||
    application?.job?.employer?.email ||
    application?.job?.household?.email ||
    application?.employer?.email ||
    application?.household?.email ||
    '';

  const activeProfile =
    job?.employer ||
    job?.household ||
    application?.job?.employer ||
    application?.job?.household;

  const detailed =
    job?.detailed_address ||
    activeProfile?.detailed_address ||
    '';

  const loc =
    job?.location ||
    activeProfile?.location ||
    '';

  const fullAddress =
    detailed && loc
      ? `${detailed}, ${loc}`
      : detailed ||
      loc ||
      activeProfile?.address ||
      'Workplace Location';

  const handleCall = () => {
    if (contactNumber) {
      Linking.openURL(`tel:${contactNumber}`).catch(() => {
        Alert.alert('Cannot Open Phone', `Phone number: ${contactNumber}`);
      });
    } else {
      Alert.alert(
        'No Phone Number Listed',
        'The employer did not list a direct phone number. Would you like to message them directly via DiskarTech Chat instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Chat', onPress: handleOpenChat },
        ]
      );
    }
  };

  const handleEmail = () => {
    if (employerEmail) {
      Linking.openURL(`mailto:${employerEmail}`).catch(() => {
        Alert.alert('Cannot Open Email', `Email address: ${employerEmail}`);
      });
    } else {
      Alert.alert(
        'No Public Email Listed',
        'The employer did not provide a public email address for this job. You can message them directly anytime via DiskarTech Chat!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Chat', onPress: handleOpenChat },
        ]
      );
    }
  };

  const handleOpenMap = () => {
    setIsMapModalVisible(true);
  };

  if (loading) {
    return (
      <View style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={{ color: colors.textSecondary }} className="font-medium text-sm mt-3">Loading hired details...</Text>
      </View>
    );
  }

  const activeJob = job || application?.job || {};
  const requirements = parseJsonField(activeJob.requirements);
  const skills = parseJsonField(activeJob.skills);
  const formattedDays = getCleanDays(activeJob);
  const isHousehold = Boolean(activeJob.household_id || activeJob.household);

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Top Header */}
      <View 
        style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}
        className="flex-row items-center justify-between px-6 pt-12 pb-4 border-b"
      >
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center mr-3"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: colors.text }} className="text-lg font-bold">Hired Job Details</Text>
            <Text style={{ color: colors.textSecondary }} className="text-xs">Accepted Application</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleOpenChat}
          disabled={isOpeningChat}
          className="w-10 h-10 rounded-full bg-red-50 items-center justify-center border border-red-200"
        >
          <MaterialIcons name="chat" size={20} color="#dc2626" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="p-6 pb-28"
      >
        {/* Contract Status Banner (Matches DiskarTech Clean Theme) */}
        {(application?.status === 'terminated' || application?.status === 'completed') ? (
          <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-red-200">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
                <MaterialIcons name="cancel" size={15} color={colors.accent} />
                <Text className="text-red-700 text-xs font-bold uppercase tracking-wider">
                  Contract Concluded
                </Text>
              </View>
              <Text className="text-slate-400 text-xs font-semibold">
                ID: #{application?.id || activeJob.id}
              </Text>
            </View>

            <Text className="text-xl font-extrabold text-slate-900 mb-1">
              Employment Concluded
            </Text>
            <Text className="text-slate-600 text-xs leading-5">
              This employment contract has been concluded by the employer.
            </Text>

            {application?.termination_reason && (
              <View className="mt-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reason for Termination</Text>
                <Text className="text-xs text-slate-800 font-semibold mt-0.5 leading-relaxed">
                  {application.termination_reason.split(':')[0].trim()}
                </Text>
              </View>
            )}

            <View className="mt-4 pt-3 border-t border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="event" size={15} color="#64748B" />
                <Text className="text-slate-500 text-xs font-medium">
                  Terminated: {formatDate(application?.terminated_at || application?.updated_at || new Date().toISOString())}
                </Text>
              </View>
              <Badge text="Closed" variant="error" size="small" />
            </View>
          </View>
        ) : (
          <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-emerald-200">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                <MaterialIcons name="verified" size={15} color="#059669" />
                <Text className="text-emerald-700 text-xs font-bold uppercase tracking-wider">
                  Application Accepted
                </Text>
              </View>
              <Text className="text-slate-400 text-xs font-semibold">
                ID: #{application?.id || activeJob.id}
              </Text>
            </View>

            <Text className="text-2xl font-extrabold text-slate-900 mb-1">
              🎉 Congratulations!
            </Text>
            <Text className="text-slate-600 text-xs leading-5">
              You have been officially hired for this role. Review the job details below and connect with your employer to coordinate your start date.
            </Text>

            <View className="mt-4 pt-3 border-t border-slate-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="event-available" size={15} color="#059669" />
                <Text className="text-slate-500 text-xs font-medium">
                  Accepted: {formatDate(application?.updated_at || application?.created_at || new Date().toISOString())}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <View className="w-2 h-2 rounded-full bg-emerald-500" />
                <Text className="text-emerald-700 text-xs font-bold">Active Contract</Text>
              </View>
            </View>
          </View>
        )}

        {/* Contract Performance Rating Card (Matches DiskarTech Clean Theme) */}
        {(application?.status === 'terminated' || application?.status === 'completed') && (
          <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100">
            <View className="flex-row items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <View className="flex-row items-center gap-2.5">
                <View className="w-10 h-10 rounded-2xl bg-red-50 items-center justify-center">
                  <MaterialIcons name="star" size={22} color={colors.accent} />
                </View>
                <View>
                  <Text className="text-base font-bold text-slate-900">Contract Rating & Feedback</Text>
                  <Text className="text-xs text-slate-400">Rate your experience</Text>
                </View>
              </View>
              {contractReview?.has_reviewed ? (
                <View className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                  <Text className="text-[10px] font-bold text-emerald-700">Reviewed</Text>
                </View>
              ) : (
                <View className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
                  <Text className="text-[10px] font-bold text-red-600">Pending Rating</Text>
                </View>
              )}
            </View>

            {contractReview?.has_reviewed ? (
              <View className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <MaterialIcons name="verified" size={16} color="#059669" />
                    <Text className="text-xs font-bold text-slate-800">You Rated This Employer</Text>
                  </View>
                  <View className="flex-row items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                    <MaterialIcons name="star" size={14} color="#F59E0B" />
                    <Text className="text-xs font-extrabold text-slate-900">
                      {contractReview.my_review?.rating}.0
                    </Text>
                  </View>
                </View>

                {contractReview.my_review?.feedback ? (
                  <Text className="text-xs text-slate-700 italic mt-1 leading-relaxed">
                    &quot;{contractReview.my_review.feedback}&quot;
                  </Text>
                ) : null}

                <TouchableOpacity
                  onPress={() => {
                    const query = new URLSearchParams({
                      applicationId: (application?.id || applicationId).toString(),
                      companyName: companyName || '',
                      employerAvatar: employerAvatar || '',
                      jobTitle: job?.title || '',
                    }).toString();
                    router.push(`/reviews/rate-contract?${query}` as any);
                  }}
                  className="mt-3 flex-row items-center justify-center py-2.5 px-3 bg-white rounded-xl border border-slate-200 active:bg-slate-100"
                >
                  <Text className="text-xs font-bold text-slate-700">View Full Review</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                <Text className="text-xs font-bold text-slate-900 mb-1">
                  How was your experience working for {companyName}?
                </Text>
                <Text className="text-xs text-slate-600 leading-relaxed mb-3">
                  This contract has ended. Share your official rating and feedback about the employer and workplace environment to help other working students.
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    const query = new URLSearchParams({
                      applicationId: (application?.id || applicationId).toString(),
                      companyName: companyName || '',
                      employerAvatar: employerAvatar || '',
                      jobTitle: job?.title || '',
                    }).toString();
                    router.push(`/reviews/rate-contract?${query}` as any);
                  }}
                  className="py-3 px-4 rounded-xl bg-red-600 items-center justify-center flex-row gap-2 shadow-sm active:bg-red-700"
                >
                  <MaterialIcons name="star" size={18} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white uppercase tracking-wider">
                    Rate Employer & Workplace
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Official Employment Contract Card */}
        {(application?.start_date || application?.work_schedule || application?.agreed_rate) && (
          <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-emerald-100">
            <View className="flex-row items-center justify-between pb-3 border-b border-gray-100 mb-3.5">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl bg-emerald-100 items-center justify-center">
                  <MaterialIcons name="handshake" size={18} color="#059669" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-slate-900">Employment Contract</Text>
                  <Text className="text-[11px] text-slate-500">Agreed terms with employer</Text>
                </View>
              </View>
              <Badge text={application?.status === 'terminated' ? 'Terminated' : 'Active Terms'} variant={application?.status === 'terminated' ? 'error' : 'success'} size="small" />
            </View>

            {/* Contract Dates & Rate */}
            <View className="flex-row gap-2.5 mb-2.5">
              <View className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <Text className="text-[10px] text-slate-400 font-semibold uppercase">Start Date</Text>
                <Text className="text-xs font-bold text-slate-800 mt-0.5">{application.start_date || 'N/A'}</Text>
              </View>
              <View className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <Text className="text-[10px] text-slate-400 font-semibold uppercase">Contract End / Duration</Text>
                <Text className="text-xs font-bold text-slate-800 mt-0.5">{application.end_date || 'Project-based / Ongoing'}</Text>
              </View>
            </View>

            <View className="flex-row gap-2.5 mb-3">
              <View className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <Text className="text-[10px] text-slate-400 font-semibold uppercase">Schedule</Text>
                <Text className="text-xs font-bold text-slate-800 mt-0.5">{application.work_schedule || 'Flexible'}</Text>
              </View>
              <View className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <Text className="text-[10px] text-slate-400 font-semibold uppercase">Agreed Rate</Text>
                <Text className="text-xs font-bold text-emerald-700 mt-0.5">₱{application.agreed_rate || activeJob.salary || '0'} {getSalaryUnit(activeJob.salary_type)}</Text>
              </View>
            </View>

            {/* Contract Terms & Termination Policy */}
            {application.contract_terms && (
              <View className="bg-slate-50 rounded-2xl p-3 mb-3 border border-slate-100">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <MaterialIcons name="gavel" size={14} color="#475569" />
                  <Text className="text-[11px] font-bold text-slate-700">Contract & Termination Terms</Text>
                </View>
                <Text className="text-xs text-slate-600 leading-relaxed">{application.contract_terms}</Text>
              </View>
            )}

            {/* 1st Day Special Instructions */}
            {application.special_instructions && (
              <View className="bg-red-50/50 rounded-2xl p-3 border border-red-100">
                <Text className="text-[10px] text-red-800 font-semibold uppercase mb-0.5">1st Day Instructions</Text>
                <Text className="text-xs text-red-950 leading-relaxed">{application.special_instructions}</Text>
              </View>
            )}
          </View>
        )}

        {/* Working Student Certificate Card */}
        <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100">
          <View className="flex-row items-center justify-between pb-3 border-b border-gray-100 mb-3.5">
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-amber-50 items-center justify-center border border-amber-100">
                <MaterialIcons name="workspace-premium" size={22} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900">Certificate of Employment</Text>
                <Text className="text-xs text-slate-500">Working Student Verification</Text>
              </View>
            </View>
          </View>

          <Text className="text-xs text-slate-600 leading-relaxed mb-3.5">
            Official proof of your employment and working student credentials. Valid for school verification, scholarship submissions, and academic endorsements.
          </Text>

          {/* Conditional Actions */}
          {application?.certificate_status === 'approved' ? (
            <View className="gap-2.5">
              <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex-row items-center gap-2">
                <MaterialIcons name="check-circle" size={18} color="#059669" />
                <Text className="text-xs text-emerald-900 font-semibold flex-1">
                  Your certificate has been officially approved and signed by the employer!
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={handleOpenCertificate}
                  disabled={loadingCert}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 16,
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FECACA',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  {loadingCert ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <MaterialIcons name="visibility" size={18} color={colors.accent} />
                      <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: 'bold' }}>
                        View Certificate
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDownloadPdf}
                  activeOpacity={0.8}
                  style={{
                    flex: 1.2,
                    height: 46,
                    borderRadius: 16,
                    backgroundColor: '#DC2626',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                  }}
                >
                  <MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                    Download PDF
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : application?.certificate_status === 'requested' ? (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex-row items-center gap-2.5">
              <MaterialIcons name="hourglass-top" size={20} color="#D97706" />
              <View className="flex-1">
                <Text className="text-xs font-bold text-amber-900">Request Pending Employer Review</Text>
                <Text className="text-[11px] text-amber-700 mt-0.5 leading-snug">
                  Your request has been submitted. The employer will review and issue your certificate shortly.
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleRequestCertificate}
              disabled={requestingCert}
              activeOpacity={0.8}
              style={{
                height: 46,
                borderRadius: 16,
                backgroundColor: '#DC2626',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {requestingCert ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                    Sending Request...
                  </Text>
                </View>
              ) : (
                <>
                  <MaterialIcons name="send" size={16} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                    Request Certificate of Employment
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Job Title & Compensation Card */}
        <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100">
          <View className="flex-row items-start justify-between gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-slate-900 leading-tight">
                {activeJob.title || 'Job Opening'}
              </Text>
              <Text className="text-xs font-semibold text-slate-500 mt-1">
                {activeJob.category || 'General'}
              </Text>
            </View>

            <View className="bg-red-50 border border-red-100 px-3.5 py-1.5 rounded-2xl items-end">
              <Text className="text-[10px] font-bold uppercase text-red-600">Rate</Text>
              <Text className="text-base font-extrabold text-red-600">
                ₱{activeJob.salary || '0.00'}
              </Text>
              <Text className="text-[10px] text-slate-700">
                {getSalaryUnit(activeJob.salary_type)}
              </Text>
            </View>
          </View>

          {/* Quick Info Grid */}
          <View className="grid grid-cols-2 gap-2.5 pt-3 border-t border-gray-100">
            <View className="flex-row items-center gap-2 bg-slate-50 p-2.5 rounded-2xl flex-1">
              <View className="w-8 h-8 rounded-xl bg-red-100 items-center justify-center">
                <MaterialIcons name="calendar-month" size={16} color="#dc2626" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] text-slate-400 font-medium">Days</Text>
                <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                  {formattedDays}
                </Text>
              </View>
            </View>
          </View>

          {activeJob.time_slot && (
            <View className="mt-2.5 flex-row items-center gap-2 bg-slate-50 p-2.5 rounded-2xl">
              <View className="w-8 h-8 rounded-xl bg-red-100 items-center justify-center">
                <MaterialIcons name="schedule" size={16} color="#dc2626" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] text-slate-400 font-medium">Working Hours / Slot</Text>
                <Text className="text-xs font-bold text-slate-800">{activeJob.time_slot}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Employer & Workplace Details Card */}
        <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100">
          <View className="flex-row items-center justify-between mb-3.5">
            <Text className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Employer Information
            </Text>
            <Badge
              text={isHousehold ? 'Household' : 'Business'}
              variant={isHousehold ? 'warning' : 'info'}
              size="small"
            />
          </View>

          <View className="flex-row items-center gap-3.5 mb-4">
            <View className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 items-center justify-center border border-slate-200">
              {employerAvatar ? (
                <Image source={{ uri: employerAvatar }} className="w-14 h-14 rounded-2xl" />
              ) : (
                <Text className="text-lg font-extrabold text-slate-600">
                  {getInitials(companyName)}
                </Text>
              )}
            </View>

            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                  {companyName}
                </Text>
                <MaterialIcons name="verified" size={16} color="#028e35ff" />
              </View>
              <Text className="text-xs text-slate-500 mt-0.5">
                {isHousehold ? 'Household Employer' : 'Registered Business Employer'}
              </Text>
            </View>
          </View>



          {/* Quick Contact Action Buttons */}
          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              onPress={handleCall}
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 py-2.5 rounded-xl border border-slate-200"
            >
              <MaterialIcons name="phone" size={16} color="#475569" />
              <Text className="text-xs font-semibold text-slate-700">Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleEmail}
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 py-2.5 rounded-xl border border-slate-200"
            >
              <MaterialIcons name="email" size={16} color="#475569" />
              <Text className="text-xs font-semibold text-slate-700">Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenChat}
              className="flex-1 flex-row items-center justify-center gap-1.5 bg-red-50 py-2.5 rounded-xl border border-red-200"
            >
              <MaterialIcons name="chat-bubble" size={16} color="#dc2626" />
              <Text className="text-xs font-semibold text-red-600">Message</Text>
            </TouchableOpacity>
          </View>

          {/* Location & Directions */}
          <View className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <View className="flex-row items-start gap-2.5 mb-2">
              <MaterialIcons name="place" size={18} color="#dc2626" style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-800">Workplace Address</Text>
                <Text className="text-xs text-slate-500 mt-0.5 leading-4">
                  {fullAddress}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleOpenMap}
              className="mt-2 bg-white py-2 px-3 rounded-xl border border-gray-200 flex-row items-center justify-center gap-1.5"
            >
              <MaterialIcons name="directions" size={16} color="#dc2626" />
              <Text className="text-xs font-semibold text-slate-700">View Directions on Maps</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Job Description Card */}
        <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100">
          <Text className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
            Job Scope & Duties
          </Text>
          <Text className="text-xs text-slate-600 leading-5">
            {activeJob.description || 'No detailed job description provided.'}
          </Text>
        </View>

        {/* Requirements Card */}
        {requirements.length > 0 && (
          <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2 mb-3">
              <MaterialIcons name="checklist" size={18} color="#dc2626" />
              <Text className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Requirements & Qualifications
              </Text>
            </View>
            <View className="gap-2.5">
              {requirements.map((req, index) => (
                <View key={index} className="flex-row items-start gap-2.5">
                  <MaterialIcons
                    name="check-circle"
                    size={16}
                    color="#dc2626"
                    style={{ marginTop: 2 }}
                  />
                  <Text className="text-xs text-slate-600 flex-1 leading-5">{req}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Required Skills Card */}
        {skills.length > 0 && (
          <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-2 mb-3">
              <MaterialIcons name="psychology" size={18} color="#dc2626" />
              <Text className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Skills Needed
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {skills.map((skill, index) => (
                <View
                  key={index}
                  className="bg-red-50 border border-red-100 px-3 py-1.5 rounded-full"
                >
                  <Text className="text-xs font-semibold text-red-700">{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Next Steps & Guidelines Card */}
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white px-6 py-4 border-t border-gray-100 flex-row items-center gap-3">
        <TouchableOpacity
          onPress={handleCall}
          className="w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center border border-gray-200"
        >
          <MaterialIcons name="phone" size={22} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleOpenChat}
          disabled={isOpeningChat}
          className="flex-1 bg-red-600 py-3.5 px-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-sm"
        >
          {isOpeningChat ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <MaterialIcons name="chat" size={20} color="white" />
              <Text className="text-white font-bold text-sm">Message Employer</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Certificate Viewer Modal */}
      <CertificateModal
        visible={certModalVisible}
        onClose={() => setCertModalVisible(false)}
        data={certData}
      />

      {/* OpenStreetMap In-App Viewer Modal */}
      <MapViewerModal
        visible={isMapModalVisible}
        onClose={() => setIsMapModalVisible(false)}
        title={companyName || activeJob.title || 'Workplace'}
        subtitle={activeJob.title || 'Workplace Location'}
        address={fullAddress}
        latitude={job?.latitude ? Number(job.latitude) : activeProfile?.latitude ? Number(activeProfile.latitude) : undefined}
        longitude={job?.longitude ? Number(job.longitude) : activeProfile?.longitude ? Number(activeProfile.longitude) : undefined}
      />
    </View>
  );
}
