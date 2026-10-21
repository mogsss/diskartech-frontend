export type InterviewCallAvailability = {
  server_now: string;
  starts_at: string | null;
  ended_at: string | null;
  active: boolean;
  can_join: boolean;
  can_end: boolean;
  room_name: string;
  message: string;
};

/** Use backend time and an explicit ISO timezone, independent of the phone's clock/locale. */
export function canJoinInterview(call: InterviewCallAvailability | null, now: number): boolean {
  return !!call?.active && !call.ended_at && !!call.starts_at && now >= Date.parse(call.starts_at);
}

/** Applies to both online and walk-in schedules; ending a call must not reopen editing. */
export function canEditInterview(call: InterviewCallAvailability | null, now: number): boolean {
  if (!call || call.ended_at || !Number.isFinite(now)) return false;
  // An incomplete legacy schedule can still be corrected.
  if (!call.starts_at) return true;
  return now < Date.parse(call.starts_at);
}

/** Both online and walk-in interviews unlock hiring at their scheduled start. */
export function canHireAfterInterview(call: InterviewCallAvailability | null, now: number): boolean {
  return !!call?.starts_at && Number.isFinite(now) && now >= Date.parse(call.starts_at);
}

export function interviewHiringMessage(call: InterviewCallAvailability | null, now: number): string {
  if (!call) return 'Checking interview schedule…';
  if (!call.starts_at || !Number.isFinite(Date.parse(call.starts_at))) return 'Set a valid interview date and time before hiring.';
  return canHireAfterInterview(call, now) ? 'Ready to review the hire.' : 'Hiring becomes available at the scheduled interview date and time (Philippine time).';
}

export function interviewCallMessage(call: InterviewCallAvailability | null, now: number): string {
  if (!call) return 'Checking interview availability…';
  if (call.ended_at) return 'This interview has ended.';
  if (!call.active) return call.message;
  return canJoinInterview(call, now) ? 'Ready to join.' : 'Available at the scheduled date and time (Philippine time).';
}

export function interviewAvailabilityFailure(status?: number): { stopPolling: boolean; message: string } {
  if (status === 401) return { stopPolling: true, message: 'Your session has expired. Please sign in again.' };
  if (status === 403) return { stopPolling: true, message: 'You do not have access to this interview.' };
  if (status === 404 || status === 410) return { stopPolling: true, message: 'This interview is currently unavailable. Please try again later.' };
  return { stopPolling: false, message: 'Could not check availability. Check your connection.' };
}
