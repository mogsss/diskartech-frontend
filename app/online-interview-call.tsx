import api from '@/api/axios';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import type { LiveKitCallRoomProps } from '@/components/video/LiveKitCallRoom';
import { useDarkMode } from '@/hooks/useDarkMode';
import { validateCallConnection, type CallConnection } from '@/utils/livekitConnection';
import { interviewAvailabilityFailure, type InterviewCallAvailability } from '@/utils/interviewCall';
import { MaterialIcons } from '@expo/vector-icons';
import { isAxiosError } from 'axios';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnlineInterviewCallScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();
  const { colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [connection, setConnection] = useState<CallConnection | null>(null);
  const [title, setTitle] = useState('Online interview');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [availability, setAvailability] = useState<InterviewCallAvailability | null>(null);
  const roomComponent = useRef<React.ComponentType<LiveKitCallRoomProps> | null>(null);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  useEffect(() => {
    const controller = new AbortController();
    const join = async () => {
      setError(null);
      setConnection(null);
      setAvailability(null);
      if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') {
        setError('Video interviews need the installed DiskarTech app with video-call support. Please use the updated development APK instead of Expo Go.');
        return;
      }
      if (typeof applicationId !== 'string' || !/^[1-9]\d*$/.test(applicationId)) {
        setError('This interview could not be found. Open it again from your application details.');
        return;
      }
      try {
        // Load native modules only after the platform guard; tokens never enter route parameters/storage.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        roomComponent.current = require('@/components/video/LiveKitCallRoom').default;
        const response = await api.post(`/applications/${applicationId}/interview-call/token`, {}, { signal: controller.signal, timeout: 15000 });
        if (controller.signal.aborted) return;
        if (response.data?.status !== 'success') throw new Error('Could not prepare this interview.');
        if (!response.data.interview_call) {
          setError('Deploy the latest backend update before joining this interview.');
          return;
        }
        const input = validateCallConnection(response.data.server_url || '', response.data.token || '');
        setTitle(response.data.title || 'Online interview');
        setAvailability(response.data.interview_call);
        setConnection(input);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (isAxiosError(cause)) setAvailability(cause.response?.data?.interview_call || null);
        setError(isAxiosError(cause)
          ? cause.response?.data?.message || 'Could not prepare the interview. Check your connection and try again.'
          : 'This app build could not start video calls. Install the updated APK and try again.');
      }
    };
    void join();
    return () => controller.abort();
  }, [applicationId, attempt]);

  const roomName = availability?.room_name;
  useEffect(() => {
    if (!connection || !roomName) return;
    const controller = new AbortController();
    let busy = false;
    let stopped = false;
    const check = async () => {
      if (busy || stopped || AppState.currentState !== 'active') return;
      busy = true;
      try {
        const response = await api.get(`/applications/${applicationId}/interview-call`, { signal: controller.signal, timeout: 10000 });
        if (controller.signal.aborted) return;
        const current: InterviewCallAvailability = response.data.interview_call;
        setAvailability(current);
        if (!current.can_join || current.room_name !== roomName) {
          setConnection(null);
          setError(current.room_name !== roomName ? 'The interview was rescheduled. Open its details again.' : current.message);
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        const failure = interviewAvailabilityFailure(isAxiosError(cause) ? cause.response?.status : undefined);
        if (failure.stopPolling) {
          stopped = true;
          clearInterval(polling);
          setConnection(null);
          setAvailability(null);
          setError(failure.message);
        }
        // Keep a working call through temporary API/network failures.
      }
      finally { busy = false; }
    };
    const polling = setInterval(() => void check(), 5000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void check(); });
    return () => { controller.abort(); clearInterval(polling); subscription.remove(); };
  }, [applicationId, connection, roomName]);

  // Room deletion can trigger the SDK disconnect before the next status poll.
  // Refresh once to show the ended state instead of offering a futile retry.
  useEffect(() => {
    if (!error || !availability?.can_join) return;
    const controller = new AbortController();
    void api.get(`/applications/${applicationId}/interview-call`, { signal: controller.signal, timeout: 10000 }).then((response) => {
      if (controller.signal.aborted) return;
      const current: InterviewCallAvailability = response.data.interview_call;
      setAvailability(current);
      if (!current.can_join) setError(current.message);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [applicationId, availability?.can_join, error]);

  const endInterview = async () => {
    try {
      const response = await api.post(`/applications/${applicationId}/interview-call/end`, { room_name: roomName }, { timeout: 15000 });
      setAvailability(response.data.interview_call);
      setConnection(null);
      setError('This interview has ended.');
    } catch (cause) {
      throw new Error(isAxiosError(cause) ? cause.response?.data?.message || 'Could not end the interview. Check your connection and try again.' : 'Could not end the interview. Try again.');
    }
  };

  const CallRoom = roomComponent.current;
  if (connection && CallRoom) return <CallRoom connection={connection} title={title} onEndInterview={availability?.can_end ? endInterview : undefined} onEnded={(message) => {
    setConnection(null);
    if (message) setError(message); else back();
  }} />;

  return <View className="flex-1" style={{ backgroundColor: colors.background }}>
    <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
    <View className="px-5 pb-3 flex-row items-center gap-3" style={{ paddingTop: insets.top + 8 }}>
      <TouchableOpacity onPress={back} accessibilityRole="button" accessibilityLabel="Go back" className="w-11 h-11 items-center justify-center"><MaterialIcons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
      <Text className="text-lg font-bold" style={{ color: colors.text }}>Online interview</Text>
    </View>
    <View className="flex-1 items-center justify-center px-8 gap-4" style={{ paddingBottom: insets.bottom }}>
      {!error && <ActivityIndicator size="large" color={colors.accent} />}
      <Text className="text-sm text-center leading-6" style={{ color: colors.textSecondary }}>{error || 'Preparing your interview call…'}</Text>
    </View>
    <NotificationModal visible={!!error} title="Online interview" message={error || ''} iconName="videocam" primaryButtonText="Back to details" onPrimaryPress={back} secondaryButtonText={availability && !availability.can_join ? undefined : 'Try again'} onSecondaryPress={availability && !availability.can_join ? undefined : () => setAttempt((value) => value + 1)} />
  </View>;
}
