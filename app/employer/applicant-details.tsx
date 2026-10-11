import ApplicantDetailsContent, { ApplicantActionButton } from '@/components/employer/applicant-details/ApplicantDetailsContent';
import InterviewModal from '@/components/employer/modals/InterviewModal';
import HireModal from '@/components/employer/modals/HireModal';
import TerminateContractModal from '@/components/employer/modals/TerminateContractModal';
import DigitalSignatureModal from '@/components/employer/modals/DigitalSignatureModal';
import CertificateModal from '@/components/common/CertificateModal';
import DocumentViewerModal from '@/components/ui/modals/DocumentViewerModal';
import { resolveMediaUrl, mediaFilename } from '@/utils/media';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import * as WebBrowser from 'expo-web-browser';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAxiosError } from 'axios';
import api from '@/api/axios';
import {
  ensureChatRoom,
  getOwnerParticipantFromStorage,
  isGenericName,
  resolveOwnerFromJob,
  resolveStudentFromRecord,
  sendChatMessage,
} from '@/utils/chat';
import { sendAppNotification } from '@/utils/notifications';
import { normalizeInterviewTime } from '@/utils/interviewTime';
import { getSalaryUnit } from '@/utils/jobRate';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function ApplicantDetailsScreen() {
  const { isDark, colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const { applicationId } = useLocalSearchParams<{ applicationId?: string }>();

  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [notification, setNotification] = useState<React.ComponentProps<typeof NotificationModal>>({
    visible: false, title: '', message: '', onPrimaryPress: () => {},
  });
  const closeNotification = () => setNotification((previous) => ({ ...previous, visible: false }));
  const showNotice = (title: string, message: string, success = false, onDone?: () => void) => {
    Keyboard.dismiss();
    setNotification({
      visible: true, title, message,
      iconName: success ? 'check-circle' : 'error-outline',
      iconColor: success ? '#16A34A' : '#DC2626',
      iconBgColor: success ? 'bg-emerald-50' : 'bg-red-50',
      primaryButtonText: success ? 'Done' : 'OK',
      onPrimaryPress: () => { closeNotification(); onDone?.(); },
    });
  };
  const withBusyAction = async (action: string, operation: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusyAction(action);
    try { await operation(); } finally {
      actionLock.current = false;
      setBusyAction(null);
    }
  };
  const confirmAction = (title: string, message: string, buttonText: string, onConfirm: () => Promise<void>) => {
    if (actionLock.current) return;
    setNotification({
      visible: true, title, message, iconName: 'help-outline',
      primaryButtonText: buttonText, secondaryButtonText: 'Cancel', buttonLayout: 'row',
      onSecondaryPress: closeNotification,
      onPrimaryPress: async () => { closeNotification(); await withBusyAction(buttonText, onConfirm); },
    });
  };
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (isAxiosError(error)) return typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback;
    return error instanceof Error ? error.message : fallback;
  };

  // States para sa Interview Modal
  const [isInterviewModalVisible, setIsInterviewModalVisible] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [defaultInterviewAddress, setDefaultInterviewAddress] = useState('');

  // States para sa Hire & Terminate Contract
  const [isHireModalVisible, setIsHireModalVisible] = useState(false);
  const [hireSuccessVisible, setHireSuccessVisible] = useState(false);
  const [isTerminateModalVisible, setIsTerminateModalVisible] = useState(false);

  // States para sa Certificate of Employment & Signature
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certData, setCertData] = useState<any>(null);
  const [isSignModalVisible, setIsSignModalVisible] = useState(false);
  const [approvingCert, setApprovingCert] = useState(false);
  const [loadingCert, setLoadingCert] = useState(false);
  const [contractReview, setContractReview] = useState<any>(null);


  // States para sa DocumentViewerModal ng Resume
  const [resumeModalVisible, setResumeModalVisible] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchApplicationDetails = async (isBackground = false) => {
        if (!applicationId) return;
        try {
          if (!isBackground) setLoading(true);
          const response = await api.get(`/employer/applications/${applicationId}`);
          if (isMounted && response.data && response.data.status === 'success') {
            setApplication(response.data.application);
          }

          // Fetch review status
          try {
            const revRes = await api.get(`/applications/${applicationId}/reviews`);
            if (isMounted && revRes.data && revRes.data.status === 'success') {
              setContractReview(revRes.data.data);
            }
          } catch {}
        } catch (error) {
          if (!isBackground) console.error('Error fetching application details:', error);
        } finally {
          if (!isBackground && isMounted) {
            setLoading(false);
          }
        }
      };

      fetchApplicationDetails(false);

      // Live auto-polling every 2.5 seconds para hindi na kailangang mag-back
      const pollInterval = setInterval(() => {
        fetchApplicationDetails(true);
      }, 2500);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
      };
    }, [applicationId])
  );

  // Kunin ang employer address para sa default walk-in location
  const job = application?.job || {};
  const employerAddress =
    job.employer?.address ||
    job.household?.address ||
    job.employer?.location ||
    job.household?.location ||
    '';

  const getBaseWebUrl = () => {
    return api.defaults.baseURL
      ? api.defaults.baseURL.replace('/api', '')
      : 'https://diskartech-backend.onrender.com';
  };

  const handleApproveCertificate = () => {
    setIsSignModalVisible(true);
  };

  const handleConfirmSignature = async (signatureBase64: string) => {
    try {
      setApprovingCert(true);
      const response = await api.post(`/employer/applications/${applicationId}/approve-certificate`, {
        signature: signatureBase64,
      });
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');
      if (response.data && response.data.status === 'success') {
        setIsSignModalVisible(false);
        showNotice('Certificate Issued', 'The official Certificate of Employment has been digitally signed and issued to the student.', true);
        setApplication((prev: any) => ({
          ...prev,
          certificate_status: 'approved',
          certificate_issued_at: new Date().toISOString(),
          employer_signature: signatureBase64,
        }));

        // Live notification para kay student
        try {
          const studentRec = resolveStudentFromRecord(application?.student || {});
          if (studentRec.student_user_id && studentRec.student_user_id !== 'unknown') {
            await sendAppNotification({
              recipientId: studentRec.student_user_id,
              title: 'Certificate of Employment Ready! 📜',
              body: `Your Working Student Certificate of Employment for "${job?.title || 'your job'}" has been digitally signed and approved! You can view or download the PDF now!`,
              type: 'application_status',
              targetId: applicationId,
            });
          }
        } catch (notifErr) {
          console.error('Error sending certificate approval notification:', notifErr);
        }
      }
    } catch (err: any) {
      console.error('Error approving certificate:', err);
      showNotice('Notice', getErrorMessage(err, 'Unable to approve certificate at this time.'));
    } finally {
      setApprovingCert(false);
    }
  };

  const handleOpenCertificate = async () => {
    try {
      setLoadingCert(true);
      const response = await api.get(`/applications/${applicationId}/certificate-data`);
      if (response.data && response.data.certificate) {
        setCertData(response.data.certificate);
        setCertModalVisible(true);
      } else {
        showNotice('Notice', 'Certificate details could not be loaded.');
      }
    } catch (err) {
      console.error('Error loading certificate:', err);
      showNotice('Notice', 'Unable to load certificate details at this time.');
    } finally {
      setLoadingCert(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const url = `${getBaseWebUrl()}/certificate/${applicationId}/view`;
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.error('Error opening certificate browser:', err);
      try {
        await Linking.openURL(`${getBaseWebUrl()}/certificate/${applicationId}/view`);
      } catch {
        showNotice('Notice', 'Unable to open the certificate PDF at this time.');
      }
    }
  };

  // Function para buksan ang modal at i-load ang default address
  const handleOpenInterviewModal = async () => {
    setInterviewDate(application?.interview_date || '');
    setInterviewTime(application?.interview_time || '');
    const savedLocation = application?.interview_location || '';
    const isOnline = application?.interview_type === 'online';
    setDefaultInterviewAddress(employerAddress);
    setInterviewLocation(savedLocation || (isOnline ? '' : employerAddress));
    try {
      const response = await api.get('/user/profile');

      if (response.data && response.data.status === 'success') {
        const profile = response.data.profile;
        // Pagsamahin ang location at detailed_address para mas kumpleto, o gamitin ang location
        const profileAddress = [profile?.detailed_address, profile?.location].filter(Boolean).join(', ') || employerAddress;
        setDefaultInterviewAddress(profileAddress);
        setInterviewLocation(savedLocation || (isOnline ? '' : profileAddress));
      }
    } catch (error) {
      console.error('Error fetching user profile address:', error);
    } finally {
      setIsInterviewModalVisible(true);
    }
  };

  // Standard status update (para sa accept, reject, etc.)
  const handleUpdateStatus = async (newStatus: 'accepted' | 'rejected') => {
    try {
      const response = await api.put(`/employer/applications/${applicationId}/status`, {
        status: newStatus,
      });

      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');

      if (response.data && response.data.status === 'success') {
        showNotice('Success', `Application has been ${newStatus}.`, true);
        setApplication((prev: any) => ({ ...prev, status: newStatus }));

        // Live notification para kay student
        try {
          const student = resolveStudentFromRecord(application.student || {});
          const jobTitle = job?.title || application.job?.title || 'Job';
          if (student.student_user_id && student.student_user_id !== 'unknown') {
            const isApproved = newStatus === 'accepted';
            await sendAppNotification({
              recipientId: student.student_user_id,
              title: isApproved ? 'Application Approved' : 'Application Update',
              body: isApproved 
                ? `Congratulations! Your application for "${jobTitle}" has been APPROVED.`
                : `Your application for "${jobTitle}" was not accepted.`,
              type: 'application_status',
              targetId: applicationId,
            });
          }
        } catch (notifErr) {
          console.error('Error sending application status notification:', notifErr);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showNotice('Error', getErrorMessage(error, 'Failed to update application status.'));
    }
  };

  // I-handle ang pag-accept / hire at pagpirma ng kontrata mula sa HireModal
  const handleConfirmHire = async (data: {
    start_date: string;
    end_date: string;
    work_schedule: string;
    agreed_rate: string;
    special_instructions: string;
    contract_terms: string;
  }) => {
    // Request errors are handled by the open HireModal.
    const response = await api.put(`/employer/applications/${applicationId}/status`, {
      status: 'accepted',
      ...data,
    });

    if (response.data && response.data.status === 'success') {
      setIsHireModalVisible(false);
      setApplication((prev: any) => ({
        ...prev,
        status: 'accepted',
        ...data,
        hired_at: new Date().toISOString(),
      }));

      // Live notification para sa student
      try {
        const student = resolveStudentFromRecord(application.student || {});
        const jobTitle = job?.title || application.job?.title || 'Job';
        if (student.student_user_id && student.student_user_id !== 'unknown') {
          await sendAppNotification({
            recipientId: student.student_user_id,
            title: 'Application Accepted & Contract Signed',
            body: `Congratulations! Your employment contract for "${jobTitle}" has been issued. Start Date: ${data.start_date}`,
            type: 'application_status',
            targetId: applicationId,
          });
        }
      } catch (notifErr) {
        console.error('Error sending hire notification:', notifErr);
      }

      // Live automated chat contract message
      try {
        const student = resolveStudentFromRecord(application.student || {});
        let owner = resolveOwnerFromJob(job);
        if (isGenericName(owner.owner_name) || owner.owner_user_id === 'unknown' || !owner.owner_avatar) {
          const storedOwner = await getOwnerParticipantFromStorage();
          owner = {
            owner_user_id: owner.owner_user_id !== 'unknown' ? owner.owner_user_id : storedOwner.owner_user_id,
            owner_role: storedOwner.owner_role || owner.owner_role,
            owner_name: !isGenericName(owner.owner_name) ? owner.owner_name : storedOwner.owner_name,
            owner_avatar: owner.owner_avatar || storedOwner.owner_avatar,
          };
        }
        const jobId = job.id || application.job_id || 'job';
        const jobTitle = job.title || 'Job Position';

        const contractMsg = `🎉 Congratulations ${student.student_name}! Your employment contract has been approved and activated for "${jobTitle}".\n\n📋 Contract Details:\n• Start Date: ${data.start_date}\n• Contract End / Duration: ${data.end_date || 'Project-based / Ongoing'}\n• Work Schedule: ${data.work_schedule}\n• Agreed Compensation: ₱${data.agreed_rate} ${getSalaryUnit(job.salary_type)}\n\n📜 Contract & Termination Terms:\n${data.contract_terms}${data.special_instructions ? `\n\n📌 1st Day Instructions:\n${data.special_instructions}` : ''}`;

        const chatId = await ensureChatRoom({
          jobId,
          jobTitle,
          owner,
          student,
          initiatorRole: 'owner',
        });

        await sendChatMessage({
          chatId,
          senderId: owner.owner_user_id,
          senderName: owner.owner_name,
          senderAvatar: owner.owner_avatar,
          receiverId: student.student_user_id,
          receiverName: student.student_name,
          text: contractMsg,
        });
      } catch (chatErr) {
        console.error('Error sending contract chat message:', chatErr);
      }

      setHireSuccessVisible(true);
    } else {
      throw new Error(response.data?.message || 'Failed to approve application and issue contract.');
    }
  };

  // I-handle ang pag-terminate ng kontrata mula sa TerminateContractModal
  const handleTerminateContract = async (reason: string) => {
    try {
      const response = await api.put(`/employer/applications/${applicationId}/status`, {
        status: 'terminated',
        termination_reason: reason,
      });

      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');

      if (response.data && response.data.status === 'success') {
        setIsTerminateModalVisible(false);
        setApplication((prev: any) => ({
          ...prev,
          status: 'terminated',
          termination_reason: reason,
          terminated_at: new Date().toISOString(),
        }));

        // Live notification para sa student
        try {
          const student = resolveStudentFromRecord(application.student || {});
          const jobTitle = job?.title || application.job?.title || 'Job';
          if (student.student_user_id && student.student_user_id !== 'unknown') {
            await sendAppNotification({
              recipientId: student.student_user_id,
              title: 'Employment Contract Terminated',
              body: `Your contract for "${jobTitle}" has been terminated. Reason: ${reason}`,
              type: 'application_status',
              targetId: applicationId,
            });
          }
        } catch (notifErr) {
          console.error('Error sending termination notification:', notifErr);
        }

        // Automated chat notice
        try {
          const student = resolveStudentFromRecord(application.student || {});
          let owner = resolveOwnerFromJob(job);
          if (isGenericName(owner.owner_name) || owner.owner_user_id === 'unknown' || !owner.owner_avatar) {
            const storedOwner = await getOwnerParticipantFromStorage();
            owner = {
              owner_user_id: owner.owner_user_id !== 'unknown' ? owner.owner_user_id : storedOwner.owner_user_id,
              owner_role: storedOwner.owner_role || owner.owner_role,
              owner_name: !isGenericName(owner.owner_name) ? owner.owner_name : storedOwner.owner_name,
              owner_avatar: owner.owner_avatar || storedOwner.owner_avatar,
            };
          }
          const jobId = job.id || application.job_id || 'job';
          const jobTitle = job.title || 'Job Position';

          const terminationMsg = `⚠️ Notice: The employment contract for "${jobTitle}" has been officially terminated.\n\nReason: ${reason}\nEffective Date: ${new Date().toLocaleDateString('en-US')}\n\nPlease contact each other directly if any final questions or details remain.`;

          const chatId = await ensureChatRoom({
            jobId,
            jobTitle,
            owner,
            student,
            initiatorRole: 'owner',
          });

          await sendChatMessage({
            chatId,
            senderId: owner.owner_user_id,
            senderName: owner.owner_name,
            senderAvatar: owner.owner_avatar,
            receiverId: student.student_user_id,
            receiverName: student.student_name,
            text: terminationMsg,
          });
        } catch (chatErr) {
          console.error('Error sending termination chat message:', chatErr);
        }

        showNotice('Contract Terminated', 'The employment contract has been concluded.', true);
      }
    } catch (err) {
      console.error('Error terminating contract:', err);
      showNotice('Error', getErrorMessage(err, 'Failed to terminate contract.'));
    }
  };

  // I-handle ang pag-mark ng contract bilang Completed
  const handleCompleteContract = () => {
    confirmAction('Complete Employment Contract', `Are you sure you want to mark this contract for "${student.student_name || 'the student'}" as completed? Both of you will be able to rate each other and the student can request an official Certificate of Employment.`, 'Complete', async () => {
      try {
        const response = await api.put(`/employer/applications/${applicationId}/status`, {
          status: 'completed',
        });

        if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');

        if (response.data && response.data.status === 'success') {
          setApplication((prev: any) => ({
            ...prev,
            status: 'completed',
            updated_at: new Date().toISOString(),
          }));

          // Live notification para sa student
          try {
            const studentInfo = resolveStudentFromRecord(application.student || {});
            const jobTitle = job?.title || application.job?.title || 'Job';
            if (studentInfo.student_user_id && studentInfo.student_user_id !== 'unknown') {
              await sendAppNotification({
                recipientId: studentInfo.student_user_id,
                title: 'Employment Contract Completed 🎉',
                body: `Congratulations! Your contract for "${jobTitle}" has been officially completed. You may now rate your employer and request your Certificate of Employment.`,
                type: 'application_status',
                targetId: applicationId,
              });
            }
          } catch (notifErr) {
            console.error('Error sending completion notification:', notifErr);
          }

          // Automated chat notice
          try {
            const studentInfo = resolveStudentFromRecord(application.student || {});
            let owner = resolveOwnerFromJob(job);
            if (isGenericName(owner.owner_name) || owner.owner_user_id === 'unknown' || !owner.owner_avatar) {
              const storedOwner = await getOwnerParticipantFromStorage();
              owner = {
                owner_user_id: owner.owner_user_id !== 'unknown' ? owner.owner_user_id : storedOwner.owner_user_id,
                owner_role: storedOwner.owner_role || owner.owner_role,
                owner_name: !isGenericName(owner.owner_name) ? owner.owner_name : storedOwner.owner_name,
                owner_avatar: owner.owner_avatar || storedOwner.owner_avatar,
              };
            }
            const jobId = job.id || application.job_id || 'job';
            const jobTitle = job.title || 'Job Position';

            const completionMsg = `🎉 Notice: The employment contract for "${jobTitle}" has been successfully completed! Thank you for your hard work and dedication.`;

            const chatId = await ensureChatRoom({
              jobId,
              jobTitle,
              owner,
              student: studentInfo,
              initiatorRole: 'owner',
            });

            await sendChatMessage({
              chatId,
              senderId: owner.owner_user_id,
              senderName: owner.owner_name,
              senderAvatar: owner.owner_avatar,
              receiverId: studentInfo.student_user_id,
              receiverName: studentInfo.student_name,
              text: completionMsg,
            });
          } catch (chatErr) {
            console.error('Error sending completion chat message:', chatErr);
          }

          showNotice('Contract Completed', 'The employment contract has been marked as completed successfully!', true);
        }
      } catch (err) {
        console.error('Error completing contract:', err);
        showNotice('Error', getErrorMessage(err, 'Failed to mark contract as completed.'));
      }
    });
  };

  // I-handle ang Interview Invite mula sa Modal (may kasamang interviewType)
  const handleSendInterviewInvite = async (interviewType: string, date: string, time: string, location: string) => {
    if (!date || !time || (interviewType === 'walk-in' && !location.trim())) {
      showNotice('Incomplete Details', 'Please fill in all the required fields.');
      return;
    }
    location = interviewType === 'online' ? 'DiskarTech video call' : location.trim();
    const normalizedTime = normalizeInterviewTime(time);
    if (!normalizedTime) {
      showNotice('Invalid Interview Time', 'Please select the interview time again.');
      return;
    }
    time = normalizedTime;

    try {
      const response = await api.put(`/employer/applications/${applicationId}/status`, {
        status: 'interview',
        interview_date: date,
        interview_time: time,
        interview_location: location,
        interview_type: interviewType,
      });
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');
      if (response.data && response.data.status === 'success') {
        setApplication((prev: any) => ({ ...prev, status: 'interview', interview_date: date, interview_time: time, interview_location: location, interview_type: interviewType }));
        setIsInterviewModalVisible(false);

        const student = resolveStudentFromRecord(application.student || {});
        const jobTitle = job.title || 'Job Position';
        let chatDelivered = false;
        try {
          let owner = resolveOwnerFromJob(job);
          if (isGenericName(owner.owner_name) || owner.owner_user_id === 'unknown' || !owner.owner_avatar) {
            const storedOwner = await getOwnerParticipantFromStorage();
            owner = {
              owner_user_id: owner.owner_user_id !== 'unknown' ? owner.owner_user_id : storedOwner.owner_user_id,
              owner_role: storedOwner.owner_role || owner.owner_role,
              owner_name: !isGenericName(owner.owner_name) ? owner.owner_name : storedOwner.owner_name,
              owner_avatar: owner.owner_avatar || storedOwner.owner_avatar,
            };
          }
          const jobId = job.id || application.job_id || 'job';

          const inviteMessage = `Hello ${student.student_name}! You are invited for a ${interviewType.toUpperCase()} interview for "${jobTitle}".\n\nDate: ${date}\nTime: ${time}\n${interviewType === 'walk-in' ? 'Address: ' + location : 'Open application details and tap Join video call to attend your interview in DiskarTech. And be prepared. Join 5minutes before the set interview time. Dont be late'}`;

          const chatId = await ensureChatRoom({
            jobId,
            jobTitle,
            owner,
            student,
            initiatorRole: 'owner',
          });

          await sendChatMessage({
            chatId,
            senderId: owner.owner_user_id,
            senderName: owner.owner_name,
            senderAvatar: owner.owner_avatar,
            receiverId: student.student_user_id,
            receiverName: student.student_name,
            text: inviteMessage,
          });
          chatDelivered = true;
        } catch (chatError) {
          console.error('Error delivering interview chat message:', chatError);
        }

        // Live notification para kay student
        try {
          if (student.student_user_id && student.student_user_id !== 'unknown') {
            await sendAppNotification({
              recipientId: student.student_user_id,
              title: 'Interview Invitation',
              body: `You are invited for an interview for "${jobTitle}".`,
              type: 'application_status',
              targetId: applicationId,
            });
          }
        } catch (notifErr) {
          console.error('Error sending interview notification:', notifErr);
        }

        showNotice('Interview Scheduled', chatDelivered ? 'Interview invitation sent successfully and message was delivered to chat!' : 'The interview schedule was saved, but the chat message could not be delivered. Please message the student with the interview details.', true);
      }
    } catch (error) {
      console.error('Error sending interview invite:', error);
      showNotice('Error', getErrorMessage(error, 'Failed to send interview invitation.'));
    }
  };

  const handleDeleteApplication = () => {
    confirmAction('Delete Application', 'Are you sure you want to delete this application? This action cannot be undone.', 'Delete', async () => {
      try {
        const response = await api.delete(`/employer/applications/${applicationId}`);
        if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');
        if (response.data && response.data.status === 'success') {
          showNotice('Application Deleted', 'Application has been deleted.', true, () => router.back());
        }
      } catch (error) {
        console.error('Error deleting application:', error);
        showNotice('Error', getErrorMessage(error, 'Failed to delete application.'));
      }
    });
  };

  const fetchResumeUri = async () => {
    const response = await api.get(`/employer/applications/${applicationId}`);
    return resolveMediaUrl(response.data?.application?.student?.student_resume);
  };

  const handleOpenResume = async (resumePath: string) => {
    if (!resumePath) {
      showNotice('Notice', 'No resume uploaded by this student.');
      return;
    }
    try {
      const uri = await fetchResumeUri();
      if (!uri) throw new Error('Resume unavailable');
      setResumeUrl(uri);
      setResumeFilename(mediaFilename(uri) || 'Student Resume');
      setResumeModalVisible(true);
    } catch {
      showNotice('Document Unavailable', 'Unable to load this resume. Please try again.');
    }
  };

  const handleStartChat = async () => {
    try {
      if (!application) return;
      const student = resolveStudentFromRecord(application.student || {});
      let owner = resolveOwnerFromJob(job);
      if (isGenericName(owner.owner_name) || owner.owner_user_id === 'unknown' || !owner.owner_avatar) {
        const storedOwner = await getOwnerParticipantFromStorage();
        owner = {
          owner_user_id: owner.owner_user_id !== 'unknown' ? owner.owner_user_id : storedOwner.owner_user_id,
          owner_role: storedOwner.owner_role || owner.owner_role,
          owner_name: !isGenericName(owner.owner_name) ? owner.owner_name : storedOwner.owner_name,
          owner_avatar: owner.owner_avatar || storedOwner.owner_avatar,
        };
      }
      const jobId = job.id || application.job_id || 'job';
      const jobTitle = job.title || 'Job Position';

      const chatId = await ensureChatRoom({
        jobId,
        jobTitle,
        owner,
        student,
        initiatorRole: 'owner',
      });

      router.push(`/chat?id=${chatId}` as any);
    } catch (error) {
      console.error('Error starting chat:', error);
      showNotice('Notice', 'Unable to open chat at this time.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <SafeStatusBar backgroundColor={colors.background} style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (!application) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <SafeStatusBar backgroundColor={colors.background} style={isDark ? 'light' : 'dark'} />
        <Text className="font-semibold" style={{ color: colors.textSecondary }}>Application details not found.</Text>
      </View>
    );
  }

  const student = application.student || {};
  const studentAddress = [student.detailed_address, student.location].filter(Boolean).join(', ');

  let availableDaysText = 'N/A';
  try {
    if (student.available_days) {
      const days = typeof student.available_days === 'string' ? JSON.parse(student.available_days) : student.available_days;
      availableDaysText = Array.isArray(days) ? days.join(', ') : student.available_days;
    }
  } catch {
    availableDaysText = student.available_days || 'N/A';
  }

  const isReviewable = ['pending', 'viewed', 'shortlisted', 'interview'].includes(String(application.status || '').toLowerCase());
  const disabled = busyAction !== null;
  const notificationModal = <NotificationModal {...notification} />;
  const handleReview = () => {
    const query = new URLSearchParams({
      applicationId: String(applicationId || application.id || ''),
      studentName: student.student_name || '', studentAvatar: student.avatar || '', jobTitle: job.title || '',
    }).toString();
    router.push(`/reviews/rate-contract?${query}` as any);
  };
  const handleReject = () => confirmAction(
    'Reject Application', 'Are you sure you want to reject this application?', 'Reject',
    () => handleUpdateStatus('rejected')
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.surface} style={isDark ? 'light' : 'dark'} withSpacer={false} />
      <View className="px-5 pb-3 border-b" style={{ paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} disabled={disabled} accessibilityRole="button" accessibilityLabel="Back" className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
            <MaterialIcons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>Applicant details</Text>
          <TouchableOpacity onPress={handleDeleteApplication} disabled={disabled} accessibilityRole="button" accessibilityLabel="Delete application" accessibilityState={{ disabled, busy: busyAction === 'Delete' }} className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2', opacity: disabled ? 0.5 : 1 }}>
            {busyAction === 'Delete' ? <ActivityIndicator size="small" color="#DC2626" /> : <MaterialIcons name="delete-outline" size={20} color={isDark ? colors.accent : '#B91C1C'} />}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 8 }}>
        <ApplicantDetailsContent
          application={application}
          contractReview={contractReview}
          avatarUri={resolveMediaUrl(student.avatar) ?? undefined}
          studentAddress={studentAddress}
          availableDaysText={availableDaysText}
          loadingCert={loadingCert}
          approvingCert={approvingCert}
          disabled={disabled}
          completing={busyAction === 'Complete'}
          messaging={busyAction === 'chat'}
          onMessage={() => withBusyAction('chat', handleStartChat)}
          onComplete={handleCompleteContract}
          onTerminate={() => setIsTerminateModalVisible(true)}
          onReview={handleReview}
          onPreviewCertificate={handleOpenCertificate}
          onApproveCertificate={handleApproveCertificate}
          onDownloadCertificate={handleDownloadPdf}
          onEditInterview={() => withBusyAction('prepareInterview', handleOpenInterviewModal)}
          onJoinInterview={() => router.push({ pathname: '/online-interview-call', params: { applicationId: String(applicationId) } })}
          onOpenResume={() => handleOpenResume(student.student_resume || student.resume || student.resume_path)}
        />
      </ScrollView>
      {isReviewable && <View className="border-t px-5 pt-4" style={{ backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View className="flex-row gap-3">
          <ApplicantActionButton label="Reject" variant="danger" size="large" onPress={handleReject} disabled={disabled} loading={busyAction === 'Reject'} />
          <ApplicantActionButton
            label={application.status === 'interview' ? 'Hire applicant' : 'Invite for interview'}
            variant="primary"
            size="large"
            disabled={disabled}
            loading={busyAction === 'prepareInterview'}
            onPress={() => application.status === 'interview' ? setIsHireModalVisible(true) : withBusyAction('prepareInterview', handleOpenInterviewModal)}
          />
        </View>
      </View>}

      {/* Hire & Employment Contract Modal */}
      <HireModal
        visible={isHireModalVisible}
        onClose={() => setIsHireModalVisible(false)}
        onSubmit={handleConfirmHire}
        studentName={student.student_name}
        jobTitle={job.title}
        defaultRate={job.salary?.toString()}
        defaultSalaryType={job.salary_type}
        defaultWorkDays={job.available_days}
        defaultWorkHours={job.time_slot}
      />

      {/* Terminate Contract Modal */}
      <TerminateContractModal
        visible={isTerminateModalVisible}
        onClose={() => { if (!actionLock.current) setIsTerminateModalVisible(false); }}
        onSubmit={(reason) => withBusyAction('terminate', () => handleTerminateContract(reason))}
        notification={isTerminateModalVisible ? notificationModal : null}
        studentName={student.student_name}
        jobTitle={job.title}
      />

      {/* Hiwalay na Interview Modal Component na may Default Address */}
      <InterviewModal
        visible={isInterviewModalVisible}
        onClose={() => { if (!actionLock.current) setIsInterviewModalVisible(false); }}
        onSubmit={(type, date, time, location) => withBusyAction('interview', () => handleSendInterviewInvite(type, date, time, location))}
        loading={busyAction === 'interview'}
        initialType={application.interview_type === 'online' ? 'online' : 'walk-in'}
        notification={isInterviewModalVisible ? notificationModal : null}
        date={interviewDate}
        setDate={setInterviewDate}
        time={interviewTime}
        setTime={setInterviewTime}
        location={interviewLocation}
        setLocation={setInterviewLocation}
        defaultAddress={defaultInterviewAddress || employerAddress}
      />

      {/* Digital Signature Modal */}
      <DigitalSignatureModal
        visible={isSignModalVisible}
        onClose={() => { if (!actionLock.current) setIsSignModalVisible(false); }}
        onSubmit={(signature) => withBusyAction('certificate', () => handleConfirmSignature(signature))}
        notification={isSignModalVisible ? notificationModal : null}
        studentName={student?.student_name}
        jobTitle={job?.title}
        signerName={resolveOwnerFromJob(job)?.owner_name || ''}
        loading={approvingCert}
      />

      {/* Certificate Viewer Modal */}
      <CertificateModal
        visible={certModalVisible}
        onClose={() => setCertModalVisible(false)}
        data={certData}
      />

      {/* Hiring result */}
      <NotificationModal
        visible={hireSuccessVisible && !isHireModalVisible}
        title="Applicant Hired!"
        message="The employment contract has been established. You can now coordinate with the student."
        iconName="check-circle"
        iconColor="#16A34A"
        iconBgColor="bg-emerald-50"
        primaryButtonText="Done"
        onPrimaryPress={() => setHireSuccessVisible(false)}
      />

      {!isInterviewModalVisible && !isTerminateModalVisible && !isSignModalVisible && !isHireModalVisible && notificationModal}

      {/* Resume Viewer Modal */}
      <DocumentViewerModal
        visible={resumeModalVisible}
        onClose={() => setResumeModalVisible(false)}
        title="Student Resume"
        uri={resumeUrl}
        filename={resumeFilename}
        refreshUri={fetchResumeUri}
      />
    </View>
  );
}
