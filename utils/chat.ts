import { db } from '@/utils/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  ChatDocumentFields,
  NormalizedChat,
  ParticipantSummary,
  LoggedInRole,
} from '@/types/chat';
import {
  isGenericName,
  pickFirstNonGeneric,
  pickFirstNonEmpty,
  isStudentAvatar,
  isOwnerAvatar,
  sanitizeOwnerAvatar,
  sanitizeStudentAvatar,
  isOwnerSideRole,
  resolveOwnerFromJob,
} from './chatHelpers';
import { getRecipientPushToken, sendRemotePushNotification } from './notifications';

// Re-export all types and helper functions para hindi masira ang umiiral na imports sa buong app
export * from '@/types/chat';
export * from './chatHelpers';

export const CHATS_COLLECTION = 'chats';

/**
 * Lumilikha ng deterministikong 1-on-1 Chat ID para sa dalawang users.
 * Kahit sino ang unang mag-chat o mag-open, iisang Room ID lagi ang mabubuo.
 */
export function getDirectChatId(userId1: string | number, userId2: string | number): string {
  const id1 = String(userId1).trim();
  const id2 = String(userId2).trim();
  const isNum1 = !isNaN(Number(id1));
  const isNum2 = !isNaN(Number(id2));
  if (isNum1 && isNum2) {
    const [min, max] = Number(id1) < Number(id2) ? [id1, id2] : [id2, id1];
    return `chat_u${min}_u${max}`;
  }
  const sorted = [id1, id2].sort();
  return `chat_u${sorted[0]}_u${sorted[1]}`;
}

export function buildChatId(params: {
  jobId?: string | number;
  ownerRole?: string;
  ownerUserId: string;
  studentUserId: string;
}): string {
  return getDirectChatId(params.ownerUserId, params.studentUserId);
}

/**
 * Kunin ang kabilang party (kausap) base sa kasalukuyang naka-login.
 * Protektado laban sa avatar leakage (hindi magiging selfie ng student ang avatar ng employer).
 */
export function getOtherParticipant(
  chat: NormalizedChat,
  currentUserId: string
): ParticipantSummary {
  const myId = String(currentUserId);

  const isCurrentStudent =
    (chat.student_user_id && myId === String(chat.student_user_id)) ||
    (chat.sender_role === 'student' && myId === String(chat.sender_id)) ||
    (chat.receiver_role === 'student' && myId === String(chat.receiver_id));

  const isCurrentOwner =
    (chat.owner_user_id && myId === String(chat.owner_user_id)) ||
    (isOwnerSideRole(chat.sender_role as any) && myId === String(chat.sender_id)) ||
    (isOwnerSideRole(chat.receiver_role as any) && myId === String(chat.receiver_id));

  // Kaso 1: Ang kasalukuyang user ay Estudyante -> Kausap ay ang Owner (Employer o Household)
  if (isCurrentStudent) {
    const ownerName = !isGenericName(chat.owner_name)
      ? chat.owner_name
      : String(chat.sender_id) === myId
      ? chat.receiver_name
      : chat.sender_name;

    const ownerId =
      chat.owner_user_id ||
      (String(chat.sender_id) === myId ? chat.receiver_id : chat.sender_id);
    const ownerRole =
      chat.owner_role ||
      (String(chat.sender_id) === myId ? chat.receiver_role : chat.sender_role) ||
      'employer';

    const ownerAvatarCandidate =
      chat.owner_avatar_url ||
      (String(chat.sender_id) === myId ? chat.receiver_avatar : chat.sender_avatar);

    const safeOwnerAvatar = sanitizeOwnerAvatar(ownerAvatarCandidate, chat.student_avatar_url);

    return {
      id: ownerId || '',
      name: (ownerName && !isGenericName(ownerName)) ? ownerName : 'Employer',
      avatar: safeOwnerAvatar,
      role: ownerRole,
    };
  }

  // Kaso 2: Ang kasalukuyang user ay Owner -> Kausap ay ang Estudyante
  if (isCurrentOwner) {
    const studentName = !isGenericName(chat.student_name)
      ? chat.student_name
      : String(chat.sender_id) === myId
      ? chat.receiver_name
      : chat.sender_name;

    const studentId =
      chat.student_user_id ||
      (String(chat.sender_id) === myId ? chat.receiver_id : chat.sender_id);

    const studentAvatarCandidate =
      chat.student_avatar_url ||
      (String(chat.sender_id) === myId ? chat.receiver_avatar : chat.sender_avatar);

    const safeStudentAvatar = sanitizeStudentAvatar(studentAvatarCandidate, chat.owner_avatar_url);

    return {
      id: studentId || '',
      name: (studentName && !isGenericName(studentName)) ? studentName : 'Student Applicant',
      avatar: safeStudentAvatar,
      role: 'student',
    };
  }

  // Kaso 3: Generic fallback base sa sender vs receiver
  const isSender = myId === String(chat.sender_id);
  if (isSender) {
    const isReceiverOwner = chat.receiver_role !== 'student';
    const rawAvatar = chat.receiver_avatar;
    const avatar = isReceiverOwner
      ? sanitizeOwnerAvatar(rawAvatar || chat.owner_avatar_url, chat.student_avatar_url)
      : sanitizeStudentAvatar(rawAvatar || chat.student_avatar_url, chat.owner_avatar_url);

    return {
      id: chat.receiver_id || '',
      name: chat.receiver_name || 'User',
      avatar,
      role: chat.receiver_role || 'employer',
    };
  }

  const isSenderOwner = chat.sender_role !== 'student';
  const rawAvatar = chat.sender_avatar;
  const avatar = isSenderOwner
    ? sanitizeOwnerAvatar(rawAvatar || chat.owner_avatar_url, chat.student_avatar_url)
    : sanitizeStudentAvatar(rawAvatar || chat.student_avatar_url, chat.owner_avatar_url);

  return {
    id: chat.sender_id || '',
    name: chat.sender_name || 'User',
    avatar,
    role: chat.sender_role || 'student',
  };
}

/**
 * Tingnan kung may unread message para sa kasalukuyang user.
 */
export function isChatUnreadForUser(
  chat: NormalizedChat,
  currentUserId: string,
  userRole?: LoggedInRole
): boolean {
  const myId = String(currentUserId);

  if (chat.last_sender_id && String(chat.last_sender_id) === myId) {
    return false;
  }

  if (chat.unread_user_ids && Array.isArray(chat.unread_user_ids)) {
    return chat.unread_user_ids.map(String).includes(myId);
  }

  if (myId === String(chat.receiver_id)) {
    return Boolean(chat.unread_receiver);
  }
  if (myId === String(chat.sender_id)) {
    return Boolean(chat.unread_sender);
  }

  if (userRole === 'student') {
    return Boolean(chat.unread_student);
  }
  return Boolean(chat.unread_owner);
}

/**
 * I-normalize ang Firestore document para suportahan ang parehong bagong core columns at legacy data.
 */
export function normalizeChatFields(raw: Record<string, any>, docId?: string): NormalizedChat {
  let studentId = String(raw.student_user_id ?? raw.studentId ?? '');
  let ownerId = String(raw.owner_user_id ?? raw.ownerId ?? '');

  if (docId && (!studentId || !ownerId)) {
    const match = docId.match(/job_.*_(?:employer|household)_([^_]+)_student_([^_]+)/);
    if (match) {
      if (!ownerId) ownerId = match[1];
      if (!studentId) studentId = match[2];
    }
  }

  const rawSenderId = String(raw.sender_id ?? '');
  const rawReceiverId = String(raw.receiver_id ?? '');

  const senderId = rawSenderId || studentId;
  const receiverId = rawReceiverId || ownerId;

  const isSenderOwner =
    (senderId && ownerId && senderId === ownerId) ||
    raw.sender_role === 'employer' ||
    raw.sender_role === 'household';

  const isReceiverOwner =
    (receiverId && ownerId && receiverId === ownerId) ||
    raw.receiver_role === 'employer' ||
    raw.receiver_role === 'household' ||
    (!isSenderOwner && Boolean(ownerId));

  const ownerNameCandidates = [
    raw.owner_name,
    raw.employerName,
    raw.householdName,
    raw.employer_name,
    raw.household_name,
    raw.business_name,
    raw.company_name,
  ];

  const studentNameCandidates = [
    raw.student_name,
    raw.studentName,
    raw.senderName,
  ];

  const ownerAvatarCandidates = [
    raw.owner_avatar_url,
    raw.employerAvatar,
    raw.householdAvatar,
    raw.owner_avatar,
    raw.employer_avatar,
  ]
    .map((u) => String(u || '').trim())
    .filter((u) => u && !isStudentAvatar(u));

  const studentAvatarCandidates = [
    raw.student_avatar_url,
    raw.studentAvatar,
    raw.senderAvatar,
  ]
    .map((u) => String(u || '').trim())
    .filter((u) => u && !isOwnerAvatar(u));

  let senderName: string;
  let senderAvatar: string;
  if (isSenderOwner) {
    senderName = pickFirstNonGeneric(
      [raw.sender_name, ...ownerNameCandidates],
      'Employer'
    );
    const candidate = pickFirstNonEmpty([raw.sender_avatar, ...ownerAvatarCandidates]);
    senderAvatar = sanitizeOwnerAvatar(candidate);
  } else {
    senderName = pickFirstNonGeneric(
      [raw.sender_name, ...studentNameCandidates],
      'Student Applicant'
    );
    const candidate = pickFirstNonEmpty([raw.sender_avatar, ...studentAvatarCandidates]);
    senderAvatar = sanitizeStudentAvatar(candidate);
  }

  let receiverName: string;
  let receiverAvatar: string;
  if (isReceiverOwner) {
    receiverName = pickFirstNonGeneric(
      [raw.receiver_name, ...ownerNameCandidates],
      'Employer'
    );
    const candidate = pickFirstNonEmpty([raw.receiver_avatar, ...ownerAvatarCandidates]);
    receiverAvatar = sanitizeOwnerAvatar(candidate);
  } else {
    receiverName = pickFirstNonGeneric(
      [raw.receiver_name, ...studentNameCandidates],
      'Student Applicant'
    );
    const candidate = pickFirstNonEmpty([raw.receiver_avatar, ...studentAvatarCandidates]);
    receiverAvatar = sanitizeStudentAvatar(candidate);
  }

  const participantIds: string[] = Array.isArray(raw.participant_ids)
    ? raw.participant_ids.map(String)
    : [senderId, receiverId].filter(Boolean);

  const unreadUserIds: string[] = Array.isArray(raw.unread_user_ids)
    ? raw.unread_user_ids.map(String)
    : [];

  const resolvedOwnerName = pickFirstNonGeneric(ownerNameCandidates, isSenderOwner ? senderName : receiverName);
  const resolvedOwnerAvatar = sanitizeOwnerAvatar(
    pickFirstNonEmpty(ownerAvatarCandidates) || (isSenderOwner ? senderAvatar : receiverAvatar)
  );
  const resolvedStudentName = pickFirstNonGeneric(studentNameCandidates, !isSenderOwner ? senderName : receiverName);
  const resolvedStudentAvatar = sanitizeStudentAvatar(
    pickFirstNonEmpty(studentAvatarCandidates) || (!isSenderOwner ? senderAvatar : receiverAvatar)
  );

  return {
    id: docId ?? raw.id ?? '',
    chat_id: String(raw.chat_id ?? docId ?? ''),
    job_id: String(raw.job_id ?? raw.jobId ?? ''),
    job_title: String(raw.job_title ?? raw.jobTitle ?? ''),

    sender_id: senderId,
    sender_name: senderName,
    sender_avatar: senderAvatar,
    sender_role: String(raw.sender_role ?? (isSenderOwner ? 'employer' : 'student')),

    receiver_id: receiverId,
    receiver_name: receiverName,
    receiver_avatar: receiverAvatar,
    receiver_role: String(raw.receiver_role ?? (isReceiverOwner ? 'employer' : 'student')),

    participant_ids: participantIds,

    last_message: String(raw.last_message ?? raw.last_message_text ?? raw.lastMessage ?? ''),
    last_sender_id: String(raw.last_sender_id ?? raw.last_message_sender_id ?? ''),
    last_message_at: raw.last_message_at ?? raw.lastMessageAt ?? null,

    unread_user_ids: unreadUserIds,
    unread_sender: Boolean(raw.unread_sender ?? false),
    unread_receiver: Boolean(raw.unread_receiver ?? false),

    created_at: raw.created_at ?? raw.createdAt ?? null,
    updated_at: raw.updated_at ?? raw.updatedAt ?? null,

    // Legacy fields populated for compatibility
    student_user_id: studentId,
    owner_user_id: ownerId,
    owner_role: String(raw.owner_role ?? (isReceiverOwner ? raw.receiver_role : raw.sender_role) ?? 'employer'),
    student_name: resolvedStudentName,
    owner_name: resolvedOwnerName,
    student_avatar_url: resolvedStudentAvatar,
    owner_avatar_url: resolvedOwnerAvatar,
    last_message_text: String(raw.last_message ?? raw.last_message_text ?? raw.lastMessage ?? ''),
    unread_student: Boolean(raw.unread_student ?? raw.unreadByStudent ?? false),
    unread_owner: Boolean(raw.unread_owner ?? raw.unreadByEmployer ?? false),
  };
}

/**
 * Lumikha o mag-reuse ng Chat Room.
 * Kung may dati nang usapan (kahit saang job post nanggaling), iyon ang ibabalik.
 */
export async function ensureChatRoom(
  input: {
    jobId?: string | number;
    jobTitle?: string;
    owner: ReturnType<typeof resolveOwnerFromJob>;
    student: {
      student_user_id: string;
      student_name: string;
      student_avatar?: string;
    };
    initiatorRole?: 'student' | 'owner';
  }
): Promise<string> {
  const { jobId, jobTitle, owner, student, initiatorRole = 'student' } = input;
  const isStudentInitiator = initiatorRole === 'student';

  const studentId = String(student.student_user_id).trim();
  const ownerId = String(owner.owner_user_id).trim();

  // 1. Suriin muna kung may umiiral nang kahit anong conversation room sa dalawang users
  try {
    const q = query(
      collection(db, CHATS_COLLECTION),
      where('participant_ids', 'array-contains', studentId)
    );
    const querySnap = await getDocs(q);
    const matchedDocs = querySnap.docs.filter((d) => {
      const data = d.data();
      const pIds: string[] = Array.isArray(data.participant_ids) ? data.participant_ids.map(String) : [];
      const oId = String(data.owner_user_id ?? data.ownerId ?? data.receiver_id ?? data.sender_id ?? '');
      return pIds.includes(ownerId) || oId === ownerId;
    });

    if (matchedDocs.length > 0) {
      matchedDocs.sort((a, b) => {
        const tA = a.data().last_message_at?.toMillis ? a.data().last_message_at.toMillis() : 0;
        const tB = b.data().last_message_at?.toMillis ? b.data().last_message_at.toMillis() : 0;
        return tB - tA;
      });
      return matchedDocs[0].id;
    }
  } catch (err) {
    console.warn('Error querying existing chat room:', err);
  }

  // 2. Kung wala pa, gamitin ang deterministikong 1-on-1 chatId para sa dalawang users
  const chatId = getDirectChatId(ownerId, studentId);
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const snap = await getDoc(chatRef);

  if (snap.exists()) {
    return chatId;
  }

  const sanitizedOwnerAvatar = sanitizeOwnerAvatar(owner.owner_avatar);
  const sanitizedStudentAvatar = sanitizeStudentAvatar(student.student_avatar);

  const senderId = isStudentInitiator ? studentId : ownerId;
  const senderName = isStudentInitiator ? student.student_name : owner.owner_name;
  const senderAvatar = isStudentInitiator ? sanitizedStudentAvatar : sanitizedOwnerAvatar;
  const senderRole = isStudentInitiator ? 'student' : owner.owner_role;

  const receiverId = isStudentInitiator ? ownerId : studentId;
  const receiverName = isStudentInitiator ? owner.owner_name : student.student_name;
  const receiverAvatar = isStudentInitiator ? sanitizedOwnerAvatar : sanitizedStudentAvatar;
  const receiverRole = isStudentInitiator ? owner.owner_role : 'student';

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    job_id: String(jobId ?? ''),
    job_title: jobTitle || '',

    sender_id: senderId,
    sender_name: senderName,
    sender_avatar: senderAvatar,
    sender_role: senderRole,

    receiver_id: receiverId,
    receiver_name: receiverName,
    receiver_avatar: receiverAvatar,
    receiver_role: receiverRole,

    participant_ids: [senderId, receiverId],

    last_message: '',
    last_sender_id: '',
    last_message_at: null,
    unread_user_ids: [],

    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),

    // Legacy fields para sa backwards compatibility
    owner_user_id: ownerId,
    owner_role: owner.owner_role,
    owner_name: owner.owner_name,
    owner_avatar_url: sanitizedOwnerAvatar,

    student_user_id: studentId,
    student_name: student.student_name,
    student_avatar_url: sanitizedStudentAvatar,
  };

  await setDoc(chatRef, payload, { merge: true });
  return chatId;
}

/**
 * Magpadala ng mensahe gamit ang sender_* at receiver_* columns.
 */
export async function sendChatMessage(params: {
  chatId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  receiverId?: string;
  receiverName?: string;
  receiverAvatar?: string;
  text: string;
}): Promise<void> {
  const { chatId, senderId, text } = params;
  const trimmed = text.trim();
  if (!trimmed || !chatId) return;

  let senderName = params.senderName || '';
  let senderAvatar = params.senderAvatar || '';
  let receiverId = params.receiverId || '';
  let receiverName = params.receiverName || '';

  const chatDocRef = doc(db, CHATS_COLLECTION, chatId);

  if (!senderName || !receiverId) {
    try {
      const snap = await getDoc(chatDocRef);
      if (snap.exists()) {
        const chat = normalizeChatFields(snap.data(), snap.id);
        const other = getOtherParticipant(chat, senderId);
        if (!receiverId) receiverId = other.id;
        if (!receiverName) receiverName = other.name;

        const isSender = String(chat.sender_id) === String(senderId);
        if (!senderName) senderName = isSender ? chat.sender_name : chat.receiver_name;
        if (!senderAvatar) senderAvatar = isSender ? chat.sender_avatar : chat.receiver_avatar;
      }
    } catch {
      /* ignore */
    }
  }

  await addDoc(collection(db, CHATS_COLLECTION, chatId, 'messages'), {
    text: trimmed,
    sender_id: senderId,
    sender_name: senderName || 'User',
    sender_avatar: senderAvatar,
    receiver_id: receiverId,
    receiver_name: receiverName || 'User',
    created_at: serverTimestamp(),
  });

  const updateData: Record<string, unknown> = {
    last_message: trimmed,
    last_sender_id: senderId,
    last_message_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  if (receiverId) {
    updateData.unread_user_ids = [receiverId];
  }

  await setDoc(chatDocRef, updateData, { merge: true });

  // Remote Push Notification para matanggap kahit patay/sarado ang app!
  if (receiverId) {
    try {
      const recipientToken = await getRecipientPushToken(receiverId);
      if (recipientToken) {
        await sendRemotePushNotification({
          toToken: recipientToken,
          title: senderName || 'New Message',
          body: trimmed,
          data: {
            chatId,
            url: `/chat?id=${chatId}`,
          },
        });
      }
    } catch (pushErr) {
      console.warn('Error sending remote push notification for chat message:', pushErr);
    }
  }
}

/**
 * I-mark ang chat bilang nabasa na ng user.
 */
export async function markChatAsRead(chatId: string, currentUserId: string): Promise<void> {
  if (!chatId || !currentUserId) return;
  try {
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const existingUnread: string[] = Array.isArray(data.unread_user_ids)
      ? data.unread_user_ids.map(String)
      : [];
    const updatedUnread = existingUnread.filter((id) => id !== String(currentUserId));

    await setDoc(chatRef, { unread_user_ids: updatedUnread }, { merge: true });
  } catch (e) {
    console.error('Error marking chat as read:', e);
  }
}
