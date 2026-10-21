import { isAxiosError } from 'axios';
import type { Dispatch, SetStateAction } from 'react';
import {
  ensureChatRoom, getOwnerParticipantFromStorage, isGenericName,
  resolveOwnerFromJob, resolveStudentFromRecord, sendChatMessage,
} from '@/utils/chat';
import { sendAppNotification } from '@/utils/notifications';

export interface ApplicantContext {
  applicationId?: string;
  application: any;
  setApplication: Dispatch<SetStateAction<any>>;
}

export interface HireContractData {
  start_date: string;
  end_date: string;
  work_schedule: string;
  agreed_rate: string;
  special_instructions: string;
  contract_terms: string;
}

export function applicantErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) return typeof error.response?.data?.message === 'string' ? error.response.data.message : fallback;
  return error instanceof Error ? error.message : fallback;
}

export async function openApplicantChat(application: any) {
  const job = application.job || {};
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
  const chatId = await ensureChatRoom({
    jobId: job.id || application.job_id || 'job', jobTitle: job.title || 'Job Position',
    owner, student, initiatorRole: 'owner',
  });
  return { chatId, owner, student };
}

// Delivery failures must not undo a successfully saved hiring decision.
export async function messageApplicant(application: any, text: string): Promise<boolean> {
  try {
    const { chatId, owner, student } = await openApplicantChat(application);
    await sendChatMessage({
      chatId, senderId: owner.owner_user_id, senderName: owner.owner_name, senderAvatar: owner.owner_avatar,
      receiverId: student.student_user_id, receiverName: student.student_name, text,
    });
    return true;
  } catch (error) {
    console.error('Error delivering applicant chat message:', error);
    return false;
  }
}

export async function notifyApplicant(application: any, applicationId: string | undefined, title: string, body: string) {
  try {
    const student = resolveStudentFromRecord(application.student || {});
    if (!student.student_user_id || student.student_user_id === 'unknown') return;
    await sendAppNotification({ recipientId: student.student_user_id, title, body, type: 'application_status', targetId: applicationId });
  } catch (error) {
    console.error('Error sending applicant notification:', error);
  }
}
