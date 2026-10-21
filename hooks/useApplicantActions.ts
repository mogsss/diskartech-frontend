import api from '@/api/axios';
import type NotificationModal from '@/components/ui/modals/NotificationModal';
import { applicantErrorMessage, messageApplicant, notifyApplicant, openApplicantChat, type ApplicantContext, type HireContractData } from '@/utils/applicantDetails';
import { resolveStudentFromRecord } from '@/utils/chat';
import { normalizeInterviewTime } from '@/utils/interviewTime';
import { getSalaryUnit } from '@/utils/jobRate';
import { router } from 'expo-router';
import { useRef, useState, type ComponentProps } from 'react';
import { Keyboard } from 'react-native';

export function useApplicantActions({ applicationId, application, setApplication }: ApplicantContext) {
  const job = application?.job || {};
  const student = application?.student || {};
  const jobTitle = job.title || 'Job';
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const actionLock = useRef(false);
  const [notification, setNotification] = useState<ComponentProps<typeof NotificationModal>>({ visible: false, title: '', message: '', onPrimaryPress: () => {} });
  const [hireVisible, setHireVisible] = useState(false);
  const [hireSuccessVisible, setHireSuccessVisible] = useState(false);
  const [terminateVisible, setTerminateVisible] = useState(false);
  const [interviewVisible, setInterviewVisible] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [defaultInterviewAddress, setDefaultInterviewAddress] = useState('');
  const employerAddress = job.employer?.address || job.household?.address || job.employer?.location || job.household?.location || '';

  const closeNotice = () => setNotification(previous => ({ ...previous, visible: false }));
  const showNotice = (title: string, message: string, success = false, onDone?: () => void) => {
    Keyboard.dismiss();
    setNotification({ visible: true, title, message, iconName: success ? 'check-circle' : 'error-outline',
      iconColor: success ? '#16A34A' : '#DC2626', iconBgColor: success ? 'bg-emerald-50' : 'bg-red-50',
      primaryButtonText: success ? 'Done' : 'OK', onPrimaryPress: () => { closeNotice(); onDone?.(); } });
  };
  const withBusyAction = async (action: string, operation: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusyAction(action);
    try { await operation(); } finally { actionLock.current = false; setBusyAction(null); }
  };
  const closeWhenIdle = (close: () => void) => { if (!actionLock.current) close(); };
  const confirmAction = (title: string, message: string, button: string, operation: () => Promise<void>) => {
    if (actionLock.current) return;
    setNotification({ visible: true, title, message, iconName: 'help-outline', primaryButtonText: button,
      secondaryButtonText: 'Cancel', buttonLayout: 'row', onSecondaryPress: closeNotice,
      onPrimaryPress: async () => { closeNotice(); await withBusyAction(button, operation); } });
  };
  const updateStatus = async (status: string, fields: Record<string, string> = {}) => {
    const response = await api.put(`/employer/applications/${applicationId}/status`, { status, ...fields });
    if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');
    setApplication((previous: any) => ({ ...previous, status, ...fields, ...response.data.application }));
    return response.data.application;
  };

  const reject = () => confirmAction('Reject Application', 'Are you sure you want to reject this application?', 'Reject', async () => {
    try {
      await updateStatus('rejected');
      showNotice('Success', 'Application has been rejected.', true);
      await notifyApplicant(application, applicationId, 'Application Update', `Your application for "${jobTitle}" was not accepted.`);
    } catch (error) { showNotice('Error', applicantErrorMessage(error, 'Failed to update application status.')); }
  });

  // HireModal owns submission errors so failed requests leave its form open.
  const hire = async (data: HireContractData) => {
    const saved = await updateStatus('accepted', { ...data });
    data = { ...data, work_schedule: saved?.work_schedule || data.work_schedule };
    setApplication((previous: any) => ({ ...previous, hired_at: new Date().toISOString() }));
    setHireVisible(false);
    await notifyApplicant(application, applicationId, 'Application Accepted & Contract Signed', `Congratulations! Your employment contract for "${jobTitle}" has been issued. Start Date: ${data.start_date}`);
    const recipient = resolveStudentFromRecord(student);
    const text = `Congratulations ${recipient.student_name}! Your employment contract has been approved and activated for "${job.title || 'Job Position'}".\n\n📋 Contract Details:\n• Start Date: ${data.start_date}\n• Contract End / Duration: ${data.end_date || 'Project-based / Ongoing'}\n• Work Schedule: ${data.work_schedule}\n• Agreed Compensation: ₱${data.agreed_rate} ${getSalaryUnit(job.salary_type)}\n\n📜 Contract & Termination Terms:\n${data.contract_terms}${data.special_instructions ? `\n\n📌 1st Day Instructions:\n${data.special_instructions}` : ''}`;
    await messageApplicant(application, text);
    setHireSuccessVisible(true);
  };

  const terminate = (reason: string) => withBusyAction('terminate', async () => {
    try {
      await updateStatus('terminated', { termination_reason: reason });
      setApplication((previous: any) => ({ ...previous, terminated_at: new Date().toISOString() }));
      setTerminateVisible(false);
      await notifyApplicant(application, applicationId, 'Employment Contract Terminated', `Your contract for "${jobTitle}" has been terminated. Reason: ${reason}`);
      await messageApplicant(application, `⚠️ Notice: The employment contract for "${job.title || 'Job Position'}" has been officially terminated.\n\nReason: ${reason}\nEffective Date: ${new Date().toLocaleDateString('en-US')}\n\nPlease contact each other directly if any final questions or details remain.`);
      showNotice('Contract Terminated', 'The employment contract has been concluded.', true);
    } catch (error) { showNotice('Error', applicantErrorMessage(error, 'Failed to terminate contract.')); }
  });

  const complete = () => confirmAction('Complete Employment Contract', `Are you sure you want to mark this contract for "${student.student_name || 'the student'}" as completed? Both of you will be able to rate each other and the student can request an official Certificate of Employment.`, 'Complete', async () => {
    try {
      await updateStatus('completed');
      setApplication((previous: any) => ({ ...previous, updated_at: new Date().toISOString() }));
      await notifyApplicant(application, applicationId, 'Employment Contract Completed ', `Congratulations! Your contract for "${jobTitle}" has been officially completed. You may now rate your employer and request your Certificate of Employment.`);
      await messageApplicant(application, `🎉 Notice: The employment contract for "${job.title || 'Job Position'}" has been successfully completed! Thank you for your hard work and dedication.`);
      showNotice('Contract Completed', 'The employment contract has been marked as completed successfully!', true);
    } catch (error) { showNotice('Error', applicantErrorMessage(error, 'Failed to mark contract as completed.')); }
  });

  const prepareInterview = () => withBusyAction('prepareInterview', async () => {
    setInterviewDate(application?.interview_date || '');
    setInterviewTime(application?.interview_time || '');
    const savedLocation = application?.interview_location || '';
    const online = application?.interview_type === 'online';
    setDefaultInterviewAddress(employerAddress);
    setInterviewLocation(savedLocation || (online ? '' : employerAddress));
    try {
      const response = await api.get('/user/profile');
      if (response.data?.status === 'success') {
        const profile = response.data.profile;
        const address = [profile?.detailed_address, profile?.location].filter(Boolean).join(', ') || employerAddress;
        setDefaultInterviewAddress(address);
        setInterviewLocation(savedLocation || (online ? '' : address));
      }
    } catch (error) { console.error('Error fetching user profile address:', error); }
    finally { setInterviewVisible(true); }
  });

  const sendInterview = (type: string, date: string, time: string, location: string) => withBusyAction('interview', async () => {
    if (!date || !time || (type === 'walk-in' && !location.trim())) {
      showNotice('Incomplete Details', 'Please fill in all the required fields.'); return;
    }
    const normalizedTime = normalizeInterviewTime(time);
    if (!normalizedTime) { showNotice('Invalid Interview Time', 'Please select the interview time again.'); return; }
    const venue = type === 'online' ? 'DiskarTech video call' : location.trim();
    try {
      await updateStatus('interview', { interview_date: date, interview_time: normalizedTime, interview_location: venue, interview_type: type });
      setInterviewVisible(false);
      const recipient = resolveStudentFromRecord(student);
      const text = `Hello ${recipient.student_name}! You are invited for a ${type.toUpperCase()} interview for "${job.title || 'Job Position'}".\n\nDate: ${date}\nTime: ${normalizedTime}\n${type === 'walk-in' ? 'Address: ' + venue : 'Open application details and tap Join video call to attend your interview in DiskarTech. And be prepared. Join 5minutes before the set interview time. Dont be late'}`;
      const delivered = await messageApplicant(application, text);
      await notifyApplicant(application, applicationId, 'Interview Invitation', `You are invited for an interview for "${job.title || 'Job Position'}".`);
      showNotice('Interview Scheduled', delivered ? 'Interview invitation sent successfully and message was delivered to chat!' : 'The interview schedule was saved, but the chat message could not be delivered. Please message the student with the interview details.', true);
    } catch (error) { showNotice('Error', applicantErrorMessage(error, 'Failed to send interview invitation.')); }
  });

  const deleteApplication = () => confirmAction('Delete Application', 'Are you sure you want to delete this application? This action cannot be undone.', 'Delete', async () => {
    try {
      const response = await api.delete(`/employer/applications/${applicationId}`);
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to complete this action.');
      showNotice('Application Deleted', 'Application has been deleted.', true, () => router.back());
    } catch (error) { showNotice('Error', applicantErrorMessage(error, 'Failed to delete application.')); }
  });
  const message = () => withBusyAction('chat', async () => {
    try {
      if (!application) return;
      const { chatId } = await openApplicantChat(application);
      router.push(`/chat?id=${chatId}` as any);
    } catch { showNotice('Notice', 'Unable to open chat at this time.'); }
  });
  const review = () => {
    const query = new URLSearchParams({ applicationId: String(applicationId || application?.id || ''),
      studentName: student.student_name || '', studentAvatar: student.avatar || '', jobTitle: job.title || '' }).toString();
    router.push(`/reviews/rate-contract?${query}` as any);
  };

  return {
    busyAction, disabled: busyAction !== null, notification, showNotice, withBusyAction, closeWhenIdle,
    reject, hire, terminate, complete, prepareInterview, sendInterview, deleteApplication, message, review,
    hireVisible, openHire: () => setHireVisible(true), closeHire: () => setHireVisible(false),
    hireSuccessVisible, closeHireSuccess: () => setHireSuccessVisible(false),
    terminateVisible, openTerminate: () => setTerminateVisible(true), closeTerminate: () => closeWhenIdle(() => setTerminateVisible(false)),
    interviewVisible, closeInterview: () => closeWhenIdle(() => setInterviewVisible(false)),
    interviewDate, setInterviewDate, interviewTime, setInterviewTime, interviewLocation, setInterviewLocation,
    defaultInterviewAddress: defaultInterviewAddress || employerAddress,
  };
}
