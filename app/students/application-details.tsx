import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import MapViewerModal from '@/components/ui/modals/MapViewerModal';
import api from '@/api/axios';
import { resolveMediaUrl } from '@/utils/media';
import { db } from '@/utils/firebase';
import {
  CHATS_COLLECTION,
  ensureChatRoom,
  getStudentParticipantFromStorage,
  resolveOwnerFromJob,
} from '@/utils/chat';
import CertificateModal from '@/components/common/CertificateModal';
import EmployerContactCard from '@/components/student/EmployerContactCard';
import ContractRatingCard from '@/components/student/ContractRatingCard';
import EmploymentContractCard from '@/components/student/EmploymentContractCard';
import CertificateOfEmploymentCard from '@/components/student/CertificateOfEmploymentCard';
import InterviewInformationCard from '@/components/student/InterviewInformationCard';
import JobOverviewCard from '@/components/student/JobOverviewCard';
import * as WebBrowser from 'expo-web-browser';
import { sendAppNotification } from '@/utils/notifications';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import ApplicationStatusCard from '@/components/student/application-details/ApplicationStatusCard';

export default function StudentApplicationDetailsScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const accentColor = isDark ? colors.accent : '#B91C1C';
  const { applicationId } = useLocalSearchParams<{ applicationId?: string }>();

  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('Employer');
  const [ownerId, setOwnerId] = useState('employer_default');
  const [employerAvatar, setEmployerAvatar] = useState('');
  const [isHousehold, setIsHousehold] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // States para sa Reviews at Certificate
  const [contractReview, setContractReview] = useState<any>(null);
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certData, setCertData] = useState<any>(null);
  const [loadingCert, setLoadingCert] = useState(false);
  const [requestingCert, setRequestingCert] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  // States para sa interview date, time, at address
  const [interviewDetails, setInterviewDetails] = useState<{
    date: string;
    time: string;
    location: string;
    type: string;
  } | null>(null);

  // State para sa Map Viewer Modal
  const [mapModalConfig, setMapModalConfig] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
    address: string;
    latitude?: number;
    longitude?: number;
  }>({
    visible: false,
    title: '',
    subtitle: '',
    address: '',
  });

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
    buttonLayout?: 'stacked' | 'row';
  }>({
    visible: false,
    title: '',
    message: '',
    onPrimaryPress: () => { },
  });

  const closeNotification = () => setNotification((prev) => ({ ...prev, visible: false }));

  // Helper para buksan ang Map Viewer Modal
  const handleOpenMapViewer = (
    title: string,
    subtitle: string,
    address: string,
    latitude?: number,
    longitude?: number
  ) => {
    setMapModalConfig({
      visible: true,
      title,
      subtitle,
      address,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    });
  };

  // Helper para linisin at i-format ang available days
  const getCleanDays = (jobData: any) => {
    try {
      if (jobData?.available_days) {
        const parsed = typeof jobData.available_days === 'string'
          ? JSON.parse(jobData.available_days)
          : jobData.available_days;
        if (Array.isArray(parsed)) {
          return parsed.join(', ');
        }
        return String(parsed);
      }
    } catch {
      return jobData?.available_days || 'Flexible Days';
    }
    return jobData?.available_days || 'Flexible Days';
  };

  // Helper para alamin ang buong detailed address ng trabaho
  const resolveWorkAddress = (jobData: any) => {
    if (!jobData) return 'Location provided upon hiring';
    const loc = jobData.location;
    const empAddr = [jobData.employer?.detailed_address, jobData.employer?.barangay, jobData.employer?.city].filter(Boolean).join(', ');
    const hhAddr = [jobData.household?.detailed_address, jobData.household?.barangay, jobData.household?.city].filter(Boolean).join(', ');
    return loc || empAddr || hhAddr || 'Location provided upon hiring';
  };

  const fetchApplicationDetails = async (isBackground = false) => {
    if (!applicationId) return;
    try {
      if (!isBackground) setLoading(true);
      // Subukang kunin ang details mula sa single endpoint o list endpoint
      let appData: any = null;
      try {
        const response = await api.get(`/student/applications/${applicationId}`);
        if (response.data && response.data.status === 'success' && response.data.application) {
          appData = response.data.application;
        }
      } catch {
        // Fallback sa myApplications list
        const listRes = await api.get('/student/applications');
        if (listRes.data && listRes.data.applications) {
          appData = listRes.data.applications.find(
            (a: any) => a.id.toString() === applicationId.toString()
          );
        }
      }

      if (appData) {
        setApplication(appData);
        if (appData.has_reported !== undefined) {
          setHasReported(Boolean(appData.has_reported));
        }

        const jobData = appData.job || {};
        const isHouse = Boolean(jobData.household_id || jobData.household);
        setIsHousehold(isHouse);

        let resolvedName = 'Employer';
        let rawAvatar = '';

        if (jobData.household_id && jobData.household) {
          resolvedName = jobData.household.household_name || 'Household';
          rawAvatar = jobData.household.avatar || '';
        } else if (jobData.employer_id && jobData.employer) {
          resolvedName = jobData.employer.employer_name || 'Employer';
          rawAvatar = jobData.employer.avatar || '';
        } else {
          resolvedName = jobData.household?.household_name || jobData.employer?.employer_name || 'Employer';
          rawAvatar = jobData.household?.avatar || jobData.employer?.avatar || '';
        }

        setCompanyName(resolvedName);
        const resolvedOwner = jobData.employer_id || jobData.household_id || jobData.user_id || 'employer_default';
        setOwnerId(resolvedOwner.toString());

        setEmployerAvatar(resolveMediaUrl(rawAvatar) ?? '');

        // Hanapin ang Interview Details (Date, Time, Address/Link)
        let iDate = appData.interview_date || '';
        let iTime = appData.interview_time || '';
        let iLoc = appData.interview_location || '';
        let iType = appData.interview_type || 'walk-in';

        // Kung status ay interview ngunit wala pa sa database columns,
        // hanapin ang invitation message mula sa chat history sa Firestore
        if (appData.status === 'interview' && (!iDate || !iTime || (iType !== 'online' && !iLoc))) {
          try {
            const studentInfo = await getStudentParticipantFromStorage();
            const sId = String(studentInfo.student_user_id || '').trim();
            const oId = String(resolvedOwner).trim();

            if (sId && sId !== 'unknown') {
              const qChats = query(
                collection(db, CHATS_COLLECTION),
                where('participant_ids', 'array-contains', sId)
              );
              const chatSnap = await getDocs(qChats);
              const matchedDocs = chatSnap.docs.filter((d) => {
                const data = d.data();
                const pIds = Array.isArray(data.participant_ids) ? data.participant_ids.map(String) : [];
                return pIds.includes(oId) || String(data.owner_user_id ?? data.receiver_id ?? data.sender_id) === oId;
              });

              for (const docSnap of matchedDocs) {
                const msgRef = collection(db, CHATS_COLLECTION, docSnap.id, 'messages');
                const msgSnap = await getDocs(query(msgRef, orderBy('created_at', 'desc'), limit(15)));
                for (const mDoc of msgSnap.docs) {
                  const text = String(mDoc.data().text || '');
                  if (text.includes('Date:') && text.includes('Time:')) {
                    const dM = text.match(/Date:\s*([^\n\r]+)/i);
                    const tM = text.match(/Time:\s*([^\n\r]+)/i);
                    const lM = text.match(/(?:Address|Link):\s*([^\n\r]+)/i);
                    if (dM && !iDate) iDate = dM[1].trim();
                    if (tM && !iTime) iTime = tM[1].trim();
                    if (lM && !iLoc) iLoc = lM[1].trim();
                    if (text.toLowerCase().includes('online')) iType = 'online';
                    break;
                  }
                }
                if (iDate && iTime) break;
              }
            }
          } catch (chatParseErr) {
            console.warn('Error fetching interview message from chat:', chatParseErr);
          }
        }

        if (iDate || iTime || iLoc || appData.status === 'interview') {
          setInterviewDetails({
            date: iDate,
            time: iTime,
            location: iLoc,
            type: iType,
          });
        }

        // Kunin din ang contract review details kung mayroon
        const targetAppId = appData?.id || applicationId;
        if (targetAppId) {
          try {
            const revRes = await api.get(`/applications/${targetAppId}/reviews`);
            if (revRes.data && revRes.data.status === 'success') {
              setContractReview(revRes.data.data);
            }
          } catch { }
        }
      }
    } catch (error) {
      if (!isBackground) console.error('Error fetching application details screen:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      fetchApplicationDetails(false);

      const pollInterval = setInterval(() => {
        if (isMounted) {
          fetchApplicationDetails(true);
        }
      }, 3000);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
        setMenuVisible(false);
      };
    }, [applicationId])
  );

  const getBaseWebUrl = () => {
    return api.defaults.baseURL
      ? api.defaults.baseURL.replace('/api', '')
      : 'https://diskartech-backend.onrender.com';
  };

  const handleRequestCertificate = () => {
    if (requestingCert) return;
    setNotification({
      visible: true,
      title: 'Request Certificate of Employment',
      message: 'Would you like to send an official request to your employer to issue your Working Student Certificate of Employment?',
      iconName: 'description',
      iconColor: '#DC2626',
      iconBgColor: 'bg-red-50',
      primaryButtonText: 'Send Request',
      secondaryButtonText: 'Cancel',
      buttonLayout: 'row',
      onSecondaryPress: closeNotification,
      onPrimaryPress: async () => {
        closeNotification();
        try {
          setRequestingCert(true);
          const appId = application?.id || applicationId;
          const response = await api.post(`/student/applications/${appId}/request-certificate`);
          if (response.data && response.data.status === 'success') {
            setNotification({
              visible: true,
              title: 'Request Submitted',
              message: 'Your request has been sent to the employer. You will be notified once it is approved and ready.',
              iconName: 'check-circle',
              iconColor: '#16A34A',
              iconBgColor: 'bg-emerald-50',
              primaryButtonText: 'Done',
              onPrimaryPress: closeNotification,
            });
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
          } else {
            throw new Error(response.data?.message || 'Unable to request certificate at this time.');
          }
        } catch (err: any) {
          console.error('Error requesting certificate:', err);
          setNotification({
            visible: true,
            title: 'Notice',
            message: err.response?.data?.message || err.message || 'Unable to request certificate at this time.',
            iconName: 'error-outline',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'OK',
            onPrimaryPress: closeNotification,
          });
        } finally {
          setRequestingCert(false);
        }
      },
    });
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

  const handleSendMessage = async () => {
    try {
      if (!application) return;
      const job = application.job || {};
      const jobId = application.job_id || job.id || 'job';
      const student = await getStudentParticipantFromStorage();
      const jobData = {
        ...job,
        id: jobId,
        employer_id: ownerId,
        employer: { employer_name: companyName, avatar: employerAvatar },
      };
      const owner = resolveOwnerFromJob(jobData);
      const chatId = await ensureChatRoom({
        jobId,
        jobTitle: job.title || 'Job Application',
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

  const handleAddToCalendar = async () => {
    try {
      if (!interviewDetails?.date) {
        setNotification({
          visible: true,
          title: 'Interview Date Pending',
          message: 'The employer has not set a specific interview date yet. Please message the employer via chat to finalize your interview schedule.',
          iconName: 'event-busy',
          iconColor: '#DC2626',
          iconBgColor: 'bg-red-50',
          primaryButtonText: 'Message Employer',
          onPrimaryPress: () => {
            closeNotification();
            handleSendMessage();
          },
          secondaryButtonText: 'Close',
          onSecondaryPress: closeNotification,
        });
        return;
      }

      const jobTitle = job?.title || 'Job Opening';
      const title = `Interview: ${jobTitle} - ${companyName}`;
      const isOnline = interviewDetails?.type === 'online';
      const location = isOnline
        ? 'DiskarTech video call'
        : interviewDetails?.location || job?.location || resolveWorkAddress(job) || '';
      const reminder = isOnline
        ? 'Open your application details in DiskarTech and tap Join video call.'
        : 'Please bring your valid school ID and wear appropriate attire.';
      const details = `Job Interview for "${jobTitle}" at ${companyName}.\nInterview Type: ${(interviewDetails?.type || 'walk-in').toUpperCase()}.\nLocation: ${location}\n\n${reminder}`;

      // Helper para i-parse ang date at time papuntang standard calendar format
      let datesParam = '';
      try {
        let dateStrToParse = interviewDetails.date;
        if (interviewDetails.time) {
          dateStrToParse += ` ${interviewDetails.time}`;
        }
        const parsedDate = new Date(dateStrToParse);
        if (!isNaN(parsedDate.getTime())) {
          const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
          const start =
            parsedDate.getUTCFullYear() +
            pad(parsedDate.getUTCMonth() + 1) +
            pad(parsedDate.getUTCDate()) +
            'T' +
            pad(parsedDate.getUTCHours()) +
            pad(parsedDate.getUTCMinutes()) +
            '00Z';
          const endD = new Date(parsedDate.getTime() + 60 * 60 * 1000); // 1 hour duration
          const end =
            endD.getUTCFullYear() +
            pad(endD.getUTCMonth() + 1) +
            pad(endD.getUTCDate()) +
            'T' +
            pad(endD.getUTCHours()) +
            pad(endD.getUTCMinutes()) +
            '00Z';
          datesParam = `&dates=${start}/${end}`;
        }
      } catch (dateErr) {
        console.error('Error parsing date for calendar:', dateErr);
      }

      const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        title
      )}${datesParam}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;

      await Linking.openURL(googleCalendarUrl);
    } catch (err) {
      console.error('Error opening calendar:', err);
      Alert.alert('Notice', 'Unable to open calendar application.');
    }
  };

  const handleCancelApplication = () => {
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
          setCancelling(true);
          const response = await api.post(`/student/applications/${application.id}/cancel`);
          if (response.data && response.data.status === 'success') {
            setNotification({
              visible: true,
              title: 'Application Cancelled',
              message: 'Your application has been successfully cancelled.',
              iconName: 'check-circle',
              iconColor: '#16A34A',
              iconBgColor: 'bg-emerald-50',
              primaryButtonText: 'Done',
              onPrimaryPress: () => {
                closeNotification();
                fetchApplicationDetails();
              },
            });
          }
        } catch (error: any) {
          console.error('Error cancelling application:', error);
          const msg = error.response?.data?.message || 'Unable to cancel application at this time.';
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
          setCancelling(false);
        }
      },
    });
  };

  const handleDeleteApplication = () => {
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
          setDeleting(true);
          const response = await api.delete(`/student/applications/${application.id}`);
          if (response.data && response.data.status === 'success') {
            setNotification({
              visible: true,
              title: 'Application Deleted',
              message: 'The application record has been removed.',
              iconName: 'check-circle',
              iconColor: '#16A34A',
              iconBgColor: 'bg-emerald-50',
              primaryButtonText: 'Done',
              onPrimaryPress: () => {
                closeNotification();
                router.back();
              },
            });
          }
        } catch (error: any) {
          console.error('Error deleting application:', error);
          const msg = error.response?.data?.message || 'Unable to delete application at this time.';
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
          setDeleting(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 12 }}>Loading application details...</Text>
      </View>
    );
  }

  if (!application) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <MaterialIcons name="error-outline" size={48} color={colors.accent} />
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginTop: 12 }}>Application Not Found</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
          This application may have been removed or is no longer available.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: '#DC2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = (application.status || '').toLowerCase();
  const canCancel = ['pending', 'viewed'].includes(status);
  const canDelete = ['cancelled', 'rejected', 'completed'].includes(status);
  const managingApplication = cancelling || deleting;
  const isAccepted = status === 'accepted';
  const isInterview = status === 'interview';
  const job = application.job || {};
  const hasEmploymentDetails = (isAccepted || status === 'terminated' || status === 'completed') && Boolean(
    application.start_date || application.work_schedule || application.agreed_rate || job.salary
  );
  const certificateCard = (isAccepted || status === 'completed') ? (
    <CertificateOfEmploymentCard
      embedded={hasEmploymentDetails}
      certificateStatus={application.certificate_status}
      loadingCert={loadingCert}
      requestingCert={requestingCert}
      onOpenCertificate={handleOpenCertificate}
      onDownloadPdf={handleDownloadPdf}
      onRequestCertificate={handleRequestCertificate}
    />
  ) : null;

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
    job?.contact_phone ||
    job?.employer?.user?.phone ||
    job?.household?.user?.phone ||
    application?.job?.employer?.phone ||
    application?.job?.household?.phone ||
    application?.job?.employer?.contact_number ||
    application?.job?.household?.contact_number ||
    application?.employer?.phone ||
    application?.household?.phone ||
    '';
  const hasContactNumber = Boolean(String(contactNumber).trim());

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
      resolveWorkAddress(job) ||
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
          { text: 'Open Chat', onPress: handleSendMessage },
        ]
      );
    }
  };

  const handleReportApplication = () => {
    setMenuVisible(false);
    if (hasReported) {
      setNotification({
        visible: true,
        title: 'Report Already Submitted',
        message: 'You have already reported this. Our safety and moderation team is currently reviewing your report.',
        iconName: 'check-circle',
        iconColor: '#16A34A',
        iconBgColor: isDark ? 'rgba(22, 163, 74, 0.15)' : 'bg-emerald-50',
        primaryButtonText: 'Understood',
        onPrimaryPress: closeNotification,
      });
      return;
    }
    router.push({
      pathname: '/students/report',
      params: {
        targetName: job.title || companyName,
        targetType: job.title ? 'job' : 'employer',
        jobId: String(application.job_id || job.id || ''),
        reportedUserId: String(job.employer?.user_id || job.household?.user_id || job.user_id || ''),
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.surface} style={isDark ? 'light' : 'dark'} withSpacer={false} />
      <View className="px-5 pb-3 border-b" style={{ paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              activeOpacity={0.7}
              className="w-11 h-11 rounded-xl items-center justify-center"
              style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
            >
              <MaterialIcons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>Application details</Text>
          </View>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            disabled={managingApplication}
            accessibilityRole="button"
            accessibilityLabel="Application options"
            accessibilityState={{ expanded: menuVisible, disabled: managingApplication, busy: managingApplication }}
            activeOpacity={0.7}
            className="w-11 h-11 rounded-xl items-center justify-center"
            style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
          >
            {managingApplication ? <ActivityIndicator size="small" color={colors.text} /> : (
              <MaterialIcons name="more-vert" size={21} color={colors.text} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom + 20, 24) }}
      >
        <ApplicationStatusCard
          status={status}
          jobTitle={job.title}
          category={job.category}
          companyName={companyName}
          applicationId={application.id || applicationId || ''}
          appliedAt={application.created_at}
          updatedAt={application.terminated_at || application.updated_at}
          terminationReason={application.termination_reason}
        >
          {(status === 'terminated' || status === 'completed') && (
            <ContractRatingCard
              embedded
              companyName={companyName}
              contractReview={contractReview}
              onRatePress={() => {
                const query = new URLSearchParams({
                  applicationId: (application?.id || applicationId).toString(),
                  companyName: companyName || '',
                  employerAvatar: employerAvatar || '',
                  jobTitle: job?.title || '',
                }).toString();
                router.push(`/reviews/rate-contract?${query}` as any);
              }}
            />
          )}
        </ApplicationStatusCard>

        {/* Interview schedule and actions */}
        {isInterview && (
          <InterviewInformationCard
            applicationId={applicationId || application.id}
            interviewDetails={interviewDetails}
            companyName={companyName}
            fallbackLocation={job.location || resolveWorkAddress(job)}
            latitude={job.latitude}
            longitude={job.longitude}
            onAddToCalendar={handleAddToCalendar}
            onJoinInterview={() => router.push({ pathname: '/online-interview-call', params: { applicationId: String(applicationId) } })}
            onOpenMap={(address) =>
              handleOpenMapViewer(
                companyName,
                'Interview Venue',
                address,
                job.latitude,
                job.longitude
              )
            }
          />
        )}

        {/* Employment contract and certificate */}
        {hasEmploymentDetails && (
          <EmploymentContractCard
            startDate={application?.start_date}
            endDate={application?.end_date}
            workSchedule={application?.work_schedule || getCleanDays(job)}
            agreedRate={application?.agreed_rate || job?.salary}
            salaryType={job?.salary_type}
            contractTerms={application?.contract_terms}
            specialInstructions={application?.special_instructions}
            status={status}
          >
            {certificateCard}
          </EmploymentContractCard>
        )}
        {!hasEmploymentDetails && certificateCard}

        {/* Employer and workplace */}
        <EmployerContactCard
          companyName={companyName}
          employerAvatar={employerAvatar}
          isHousehold={isHousehold}
          fullAddress={fullAddress}
          onMessage={handleSendMessage}
          onOpenMap={() =>
            handleOpenMapViewer(
              companyName,
              'Workplace Location & Directions',
              fullAddress,
              job.latitude,
              job.longitude
            )
          }
        />

        <JobOverviewCard
          job={job}
          cleanDays={getCleanDays(job)}
        />
      </ScrollView>

      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View className="flex-1">
          <Pressable
            onPress={() => setMenuVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close application options"
            className="absolute inset-0 bg-black/30"
          />
          <View
            accessibilityViewIsModal
            className="absolute right-5 rounded-2xl border p-3"
            style={{ top: insets.top + 64, width: 280, maxWidth: '90%', maxHeight: Math.max(144, screenHeight - insets.top - insets.bottom - 84), backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="flex-row items-center justify-between gap-2 pl-2 mb-1">
              <Text className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>Application options</Text>
              <TouchableOpacity
                onPress={() => setMenuVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close application options"
                activeOpacity={0.7}
                className="w-11 h-11 items-center justify-center rounded-xl"
              >
                <MaterialIcons name="close" size={19} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
              <TouchableOpacity
                onPress={() => { setMenuVisible(false); void handleSendMessage(); }}
                accessibilityRole="button"
                accessibilityLabel={isHousehold ? 'Message household' : 'Message employer'}
                activeOpacity={0.7}
                className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                style={{ minHeight: 48 }}
              >
                <MaterialIcons name="chat-bubble-outline" size={20} color={colors.textSecondary} accessible={false} />
                <Text className="flex-1 text-sm font-medium" style={{ color: colors.text }}>{isHousehold ? 'Message household' : 'Message employer'}</Text>
              </TouchableOpacity>
              {hasContactNumber && (
                <TouchableOpacity
                  onPress={() => { setMenuVisible(false); handleCall(); }}
                  accessibilityRole="button"
                  accessibilityLabel={isHousehold ? 'Call household' : 'Call employer'}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                  style={{ minHeight: 48 }}
                >
                  <MaterialIcons name="phone" size={20} color={colors.textSecondary} accessible={false} />
                  <Text className="flex-1 text-sm font-medium" style={{ color: colors.text }}>{isHousehold ? 'Call household' : 'Call employer'}</Text>
                </TouchableOpacity>
              )}
              <View className="border-t my-2" style={{ borderTopColor: colors.border }} />
              <TouchableOpacity
                onPress={handleReportApplication}
                accessibilityRole="button"
                accessibilityLabel={hasReported ? 'View report status' : 'Report listing or hirer'}
                activeOpacity={0.7}
                className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                style={{ minHeight: 48 }}
              >
                <MaterialIcons name={hasReported ? 'check-circle-outline' : 'outlined-flag'} size={20} color={hasReported ? colors.textSecondary : accentColor} accessible={false} />
                <Text className="flex-1 text-sm font-medium" style={{ color: hasReported ? colors.textSecondary : accentColor }}>{hasReported ? 'Report submitted' : 'Report listing or hirer'}</Text>
              </TouchableOpacity>
              {canCancel && (
                <TouchableOpacity
                  onPress={() => { setMenuVisible(false); handleCancelApplication(); }}
                  disabled={cancelling}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel application"
                  accessibilityState={{ disabled: cancelling, busy: cancelling }}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                  style={{ minHeight: 48, opacity: cancelling ? 0.5 : 1 }}
                >
                  {cancelling ? <ActivityIndicator size="small" color={accentColor} /> : (
                    <MaterialIcons name="cancel" size={20} color={accentColor} accessible={false} />
                  )}
                  <Text className="flex-1 text-sm font-medium" style={{ color: accentColor }}>Cancel application</Text>
                </TouchableOpacity>
              )}
              {(canDelete || status === 'terminated') && (
                <TouchableOpacity
                  onPress={() => { setMenuVisible(false); handleDeleteApplication(); }}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel="Delete application"
                  accessibilityState={{ disabled: deleting, busy: deleting }}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                  style={{ minHeight: 48, opacity: deleting ? 0.5 : 1 }}
                >
                  {deleting ? <ActivityIndicator size="small" color={accentColor} /> : (
                    <MaterialIcons name="delete-outline" size={20} color={accentColor} accessible={false} />
                  )}
                  <Text className="flex-1 text-sm font-medium" style={{ color: accentColor }}>Delete application</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Certificate Modal */}
      <CertificateModal
        visible={certModalVisible}
        onClose={() => setCertModalVisible(false)}
        data={certData}
      />

      {/* Map Viewer Modal matching DiskarTech Red Theme */}
      <MapViewerModal
        visible={mapModalConfig.visible}
        onClose={() => setMapModalConfig((prev) => ({ ...prev, visible: false }))}
        title={mapModalConfig.title}
        subtitle={mapModalConfig.subtitle}
        address={mapModalConfig.address}
        latitude={mapModalConfig.latitude}
        longitude={mapModalConfig.longitude}
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
        buttonLayout={notification.buttonLayout}
      />
    </View>
  );
}
