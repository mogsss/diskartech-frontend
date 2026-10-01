import { Timestamp } from 'firebase/firestore';

export type UserRole = 'student' | 'employer' | 'household';
export type LoggedInRole = UserRole | 'unknown';

export interface ParticipantSummary {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

/**
 * Standard Firestore Chat Room Document Schema (`chats/{chatId}`)
 */
export interface ChatDocumentFields {
  chat_id?: string;
  job_id: string;
  job_title: string;

  // Sender / Initiator
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  sender_role: string;

  // Receiver / Recipient
  receiver_id: string;
  receiver_name: string;
  receiver_avatar: string;
  receiver_role: string;

  // Array para sa mabilisang query: where('participant_ids', 'array-contains', myUserId)
  participant_ids: string[];

  // Huling Mensahe Preview
  last_message: string;
  last_sender_id: string;
  last_message_at: Timestamp | null;

  // Unread status
  unread_user_ids: string[];
  unread_sender: boolean;
  unread_receiver: boolean;

  // Timestamps
  created_at: Timestamp | null;
  updated_at: Timestamp | null;

  // Legacy compatibility fields
  student_user_id?: string;
  owner_user_id?: string;
  owner_role?: string;
  student_name?: string;
  owner_name?: string;
  student_avatar_url?: string;
  owner_avatar_url?: string;
  unread_student?: boolean;
  unread_owner?: boolean;
  last_message_text?: string;
}

export interface NormalizedChat extends ChatDocumentFields {
  id: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  receiver_id?: string;
  receiver_name?: string;
  created_at: Timestamp | null;
}

export type ChatRoomInitInput = {
  jobId: string | number;
  jobTitle?: string;
  sender: {
    sender_id: string;
    sender_name: string;
    sender_avatar?: string;
    sender_role?: string;
  };
  receiver: {
    receiver_id: string;
    receiver_name: string;
    receiver_avatar?: string;
    receiver_role?: string;
  };
};
