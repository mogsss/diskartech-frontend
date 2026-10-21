import api from '@/api/axios';
import { canEditInterview, canHireAfterInterview, canJoinInterview, interviewAvailabilityFailure, interviewCallMessage, interviewHiringMessage, type InterviewCallAvailability } from '@/utils/interviewCall';
import { isAxiosError } from 'axios';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

export function useInterviewCallAvailability(applicationId: string | number | undefined, enabled: boolean, scheduleKey?: string) {
  const [call, setCall] = useState<InterviewCallAvailability | null>(null);
  const [now, setNow] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [checkedScheduleKey, setCheckedScheduleKey] = useState<string | undefined>(undefined);
  useFocusEffect(useCallback(() => {
    setCall(null);
    setFailure(null);
    if (!enabled || !applicationId) return;
    const controller = new AbortController();
    let busy = false;
    let stopped = false;
    let serverOffset = 0;
    const refresh = async () => {
      if (busy || stopped || AppState.currentState !== 'active') return;
      busy = true;
      try {
        const response = await api.get(`/applications/${applicationId}/interview-call`, { signal: controller.signal, timeout: 10000 });
        if (controller.signal.aborted) return;
        const availability: InterviewCallAvailability = response.data.interview_call;
        serverOffset = Date.parse(availability.server_now) - Date.now();
        setNow(Date.now() + serverOffset);
        setCall(availability);
        setCheckedScheduleKey(scheduleKey);
        setFailure(null);
      } catch (error) {
        if (!controller.signal.aborted) {
          const result = interviewAvailabilityFailure(isAxiosError(error) ? error.response?.status : undefined);
          setCall(null);
          setFailure(result.message);
          if (result.stopPolling) {
            stopped = true;
            clearInterval(polling);
            clearInterval(clock);
          }
        }
      } finally { busy = false; }
    };
    const polling = setInterval(() => void refresh(), 5000);
    const clock = setInterval(() => setNow(Date.now() + serverOffset), 1000);
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { controller.abort(); clearInterval(polling); clearInterval(clock); subscription.remove(); };
  }, [applicationId, enabled, scheduleKey]));
  // Rescheduling immediately invalidates an old unlocked result, even before the next poll.
  const currentCall = checkedScheduleKey === scheduleKey ? call : null;
  return {
    canEdit: !failure && canEditInterview(currentCall, now),
    canAddToCalendar: !failure && !!currentCall?.starts_at && canEditInterview(currentCall, now),
    canJoin: !failure && canJoinInterview(currentCall, now),
    message: failure || interviewCallMessage(currentCall, now),
    canHire: !failure && canHireAfterInterview(currentCall, now),
    hireMessage: failure || interviewHiringMessage(currentCall, now),
  };
}
