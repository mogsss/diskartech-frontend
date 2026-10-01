import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { Timestamp } from 'firebase/firestore';
import { LoggedInRole } from '@/types/chat';

export function getStorageBaseUrl(): string {
  return api.defaults.baseURL
    ? api.defaults.baseURL.replace('/api', '/storage/')
    : 'http://192.168.1.2:8000/storage/';
}

export function toAbsoluteStorageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${getStorageBaseUrl()}${path}`;
}

export function isGenericName(val?: string | null): boolean {
  if (!val) return true;
  const lower = val.trim().toLowerCase();
  return (
    lower === 'employer / household' ||
    lower === 'employer/household' ||
    lower === 'employer' ||
    lower === 'household' ||
    lower === 'household hirer' ||
    lower === 'student applicant' ||
    lower === 'student' ||
    lower === 'user' ||
    lower === 'chat user' ||
    lower === 'employer_default'
  );
}

export function pickFirstNonGeneric(candidates: (string | undefined | null)[], fallback: string): string {
  for (const c of candidates) {
    if (c && typeof c === 'string' && !isGenericName(c)) {
      return c.trim();
    }
  }
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) {
      return c.trim();
    }
  }
  return fallback;
}

export function pickFirstNonEmpty(candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) {
      return c.trim();
    }
  }
  return '';
}

export function isStudentAvatar(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.trim().toLowerCase();
  return (
    lower.includes('/student/') ||
    lower.includes('/students/') ||
    lower.includes('profile_pictures') ||
    lower.includes('student_avatar')
  );
}

export function isOwnerAvatar(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.trim().toLowerCase();
  return (
    lower.includes('/employers/') ||
    lower.includes('/employer/') ||
    lower.includes('/households/') ||
    lower.includes('/household/')
  );
}

export function sanitizeOwnerAvatar(
  url?: string | null,
  studentAvatarUrl?: string | null
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isStudentAvatar(trimmed)) return '';
  if (studentAvatarUrl && trimmed === studentAvatarUrl.trim()) return '';
  return trimmed;
}

export function sanitizeStudentAvatar(
  url?: string | null,
  ownerAvatarUrl?: string | null
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isOwnerAvatar(trimmed)) return '';
  if (ownerAvatarUrl && trimmed === ownerAvatarUrl.trim()) return '';
  return trimmed;
}

export function resolveOwnerFromJob(job: Record<string, any>): {
  owner_user_id: string;
  owner_role: 'employer' | 'household';
  owner_name: string;
  owner_avatar: string;
} {
  const isHousehold = Boolean(
    job.household_id ||
    job.household ||
    job.household_name ||
    job.hirer_type === 'household'
  );
  const ownerRole: 'employer' | 'household' = isHousehold ? 'household' : 'employer';

  const employerObj = job.employer || job.employer_profile || job.employerProfile || {};
  const householdObj = job.household || job.household_profile || job.householdProfile || {};

  const ownerUserId = String(
    householdObj.user_id ??
    employerObj.user_id ??
    job.user_id ??
    job.employer_id ??
    job.household_id ??
    'unknown'
  );

  const rawName = pickFirstNonGeneric(
    [
      householdObj.household_name,
      employerObj.employer_name,
      employerObj.business_name,
      employerObj.company_name,
      employerObj.name,
      householdObj.name,
      job.household_name,
      job.employer_name,
      job.business_name,
      job.company_name,
      job.companyName,
      job.name,
    ],
    isHousehold ? 'Household Hirer' : 'Employer'
  );

  const rawAvatar = pickFirstNonEmpty([
    householdObj.avatar,
    employerObj.avatar,
    employerObj.profile_picture,
    job.household_avatar,
    job.employer_avatar,
    job.avatar,
  ]);

  return {
    owner_user_id: ownerUserId,
    owner_role: ownerRole,
    owner_name: rawName,
    owner_avatar: sanitizeOwnerAvatar(toAbsoluteStorageUrl(rawAvatar)),
  };
}

export function resolveStudentFromRecord(student: Record<string, any>): {
  student_user_id: string;
  student_name: string;
  student_avatar: string;
} {
  const studentUserId = String(student.user_id ?? student.id ?? 'unknown');
  const studentName = pickFirstNonGeneric(
    [student.student_name, student.name, student.full_name],
    'Student Applicant'
  );
  const avatarPath = student.avatar || student.profile_picture || '';
  return {
    student_user_id: studentUserId,
    student_name: studentName,
    student_avatar: sanitizeStudentAvatar(toAbsoluteStorageUrl(avatarPath)),
  };
}

export async function getLoggedInUserId(): Promise<string> {
  try {
    const storedUser = await AsyncStorage.getItem('userData');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.id != null) return String(user.id);
    }
    const storedProfile = await AsyncStorage.getItem('userProfile');
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      if (profile.user_id != null) return String(profile.user_id);
      if (profile.id != null) return String(profile.id);
      if (profile.email) return String(profile.email);
    }
  } catch {
    /* ignore */
  }
  return 'unknown';
}

export async function getLoggedInRole(): Promise<LoggedInRole> {
  try {
    const storedProfile = await AsyncStorage.getItem('userProfile');
    const storedUser = await AsyncStorage.getItem('userData');
    const profile = storedProfile ? JSON.parse(storedProfile) : null;
    const user = storedUser ? JSON.parse(storedUser) : null;

    const role = profile?.role ?? user?.role;
    if (role === 'student' || role === 'employer' || role === 'household') {
      return role;
    }
    if (profile?.household_name) return 'household';
    if (profile?.employer_name) return 'employer';
    if (profile?.student_name) return 'student';
  } catch {
    /* ignore */
  }
  return 'unknown';
}

export function isOwnerSideRole(role: LoggedInRole): boolean {
  return role === 'employer' || role === 'household';
}

export async function getStudentParticipantFromStorage(): Promise<{
  student_user_id: string;
  student_name: string;
  student_avatar: string;
}> {
  let student_user_id = 'unknown';
  let student_name = 'Student Applicant';
  let student_avatar = '';

  try {
    const storedUser = await AsyncStorage.getItem('userData');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      student_user_id = String(user.id ?? 'unknown');
    }
    const storedProfile = await AsyncStorage.getItem('userProfile');
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      if (profile.student_name) student_name = profile.student_name;
      if (profile.avatar) student_avatar = sanitizeStudentAvatar(toAbsoluteStorageUrl(profile.avatar));
    }
  } catch {
    /* ignore */
  }

  return { student_user_id, student_name, student_avatar };
}

export async function getOwnerParticipantFromStorage(): Promise<{
  owner_user_id: string;
  owner_role: 'employer' | 'household';
  owner_name: string;
  owner_avatar: string;
}> {
  let owner_user_id = 'unknown';
  let owner_role: 'employer' | 'household' = 'employer';
  let owner_name = 'Employer';
  let owner_avatar = '';

  try {
    const storedUser = await AsyncStorage.getItem('userData');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.id != null) owner_user_id = String(user.id);
      if (user.role === 'household' || user.role === 'employer') {
        owner_role = user.role;
      }
    }
    const storedProfile = await AsyncStorage.getItem('userProfile');
    if (storedProfile) {
      const profile = JSON.parse(storedProfile);
      if (profile.user_id != null) owner_user_id = String(profile.user_id);
      const isHousehold = profile.role === 'household' || Boolean(profile.household_name);
      owner_role = isHousehold ? 'household' : 'employer';

      const resolvedName = isHousehold
        ? (profile.household_name || profile.name || 'Household Hirer')
        : (profile.employer_name || profile.business_name || profile.company_name || profile.name || 'Employer');

      if (!isGenericName(resolvedName)) {
        owner_name = resolvedName;
      }

      const pic = profile.profile_picture || profile.avatar;
      if (pic) {
        owner_avatar = sanitizeOwnerAvatar(toAbsoluteStorageUrl(pic));
      }
    }
  } catch {
    /* ignore */
  }

  return { owner_user_id, owner_role, owner_name, owner_avatar };
}

export function formatChatListTime(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (typeof value === 'string' && value.trim()) return value;
  return '';
}

export function getMessageSenderId(raw: Record<string, unknown>): string {
  return String(raw.sender_id ?? raw.sender_user_id ?? raw.senderId ?? '');
}

export function getMessageCreatedAt(raw: Record<string, unknown>): Timestamp | null {
  const ts = raw.created_at ?? raw.createdAt;
  if (ts && typeof ts === 'object' && 'toDate' in ts) {
    return ts as Timestamp;
  }
  return null;
}
