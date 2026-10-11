import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { CallConnection } from '@/utils/livekitConnection';
import { MaterialIcons } from '@expo/vector-icons';
import { AudioSession, LiveKitRoom, VideoTrack, isTrackReference, registerGlobals, setLogLevel, useConnectionState, useLocalParticipant, useParticipants, useTracks } from '@livekit/react-native';
import WebRTCLogger from '@livekit/react-native-webrtc/src/Logger';
import { ConnectionState, Room, Track } from 'livekit-client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PermissionsAndroid, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Loaded only when joining a call in a native development/installed build.
registerGlobals();
setLogLevel('warn');
// The WebRTC fork enables verbose logging by default; keep only its warnings/errors.
WebRTCLogger.enable('rn-webrtc:*:WARN,rn-webrtc:*:ERROR');

export type LiveKitCallRoomProps = { connection: CallConnection; onEnded: (message?: string) => void; title?: string; onEndInterview?: () => Promise<void> };

export default function LiveKitCallRoom({ connection, onEnded, title = 'Online interview', onEndInterview }: LiveKitCallRoomProps) {
  const { colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [room] = useState(() => new Room({
    adaptiveStream: { pixelDensity: 'screen' }, dynacast: true,
    videoCaptureDefaults: { resolution: { width: 640, height: 360, frameRate: 24 }, facingMode: 'user' },
  }));
  const [ready, setReady] = useState(false);
  const [mediaNotice, setMediaNotice] = useState(false);
  const ended = useRef(false);
  const endHandler = useRef(onEnded);
  endHandler.current = onEnded;
  const finish = useCallback((message?: string) => {
    if (ended.current) return;
    ended.current = true;
    endHandler.current(message);
  }, []);

  useEffect(() => {
    ended.current = false;
    let disposed = false;
    const start = async () => {
      try {
        if (Platform.OS === 'android') {
          const requested = [PermissionsAndroid.PERMISSIONS.CAMERA, PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          const result = await PermissionsAndroid.requestMultiple(requested);
          if (requested.some((permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED)) {
            if (!disposed) finish('Allow camera and microphone access in your phone settings, then join again.');
            return;
          }
        }
        if (disposed) return;
        await AudioSession.startAudioSession();
        if (disposed) await AudioSession.stopAudioSession();
        else setReady(true);
      } catch {
        if (!disposed) finish('Could not prepare the camera or audio session. Check phone permissions and try again.');
      }
    };
    void start();
    return () => {
      disposed = true;
      ended.current = true;
      // Covers Leave, hardware Back, navigation and failed connections. Stop local tracks too.
      void room.disconnect(true).catch(() => undefined).finally(() => AudioSession.stopAudioSession().catch(() => undefined));
    };
  }, [room, finish]);

  if (!ready) return <View className="flex-1 items-center justify-center gap-4" style={{ backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
    <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
    <ActivityIndicator size="large" color={colors.accent} />
    <Text className="text-sm" style={{ color: colors.text }}>Preparing your call…</Text>
    <TouchableOpacity onPress={() => finish()} accessibilityRole="button" className="px-5 py-3"><Text style={{ color: colors.accent }}>Cancel</Text></TouchableOpacity>
  </View>;

  return <LiveKitRoom room={room} serverUrl={connection.serverUrl} token={connection.token} connect audio video
    onDisconnected={() => finish('The call disconnected. Return to the interview details to check whether it is still available.')}
    onError={() => finish('Could not connect to the call. Check your internet connection and try joining again.')}
    onMediaDeviceFailure={() => setMediaNotice(true)}>
    <CallContent onLeave={() => finish()} title={title} onEndInterview={onEndInterview} />
    <NotificationModal visible={mediaNotice} title="Camera or microphone unavailable" message="Check camera and microphone permissions in phone settings. You can stay in the room and retry using the call controls." iconName="videocam-off" onPrimaryPress={() => setMediaNotice(false)} />
  </LiveKitRoom>;
}

function CallContent({ onLeave, title, onEndInterview }: { onLeave: () => void; title: string; onEndInterview?: () => Promise<void> }) {
  const { colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const state = useConnectionState();
  const participants = useParticipants();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const [controlBusy, setControlBusy] = useState(false);
  const controlLock = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const endLock = useRef(false);
  const remoteParticipant = participants.find((participant) => !participant.isLocal);
  const remoteCamera = tracks.find((track) => !track.participant.isLocal);
  const localCamera = tracks.find((track) => track.participant.isLocal);
  const connected = state === ConnectionState.Connected;
  const toggle = async (kind: 'mic' | 'camera') => {
    if (controlLock.current || !connected) return;
    controlLock.current = true;
    setControlBusy(true);
    try {
      if (kind === 'mic') await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      else await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch { setNotice('Could not update this device. Check camera and microphone access in phone settings and try again.'); }
    finally { controlLock.current = false; setControlBusy(false); }
  };
  const status = connected ? 'Connected' : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting ? 'Reconnecting…' : 'Connecting…';
  const endInterview = async () => {
    if (endLock.current || !onEndInterview) return;
    endLock.current = true;
    setConfirmEnd(false);
    setEnding(true);
    try { await onEndInterview(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not end this interview. Try again.'); }
    finally { endLock.current = false; setEnding(false); }
  };

  return <View className="flex-1" style={{ backgroundColor: colors.background }}>
    <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
    <View className="px-5 pb-4 flex-row items-center gap-3" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-1"><Text numberOfLines={2} className="text-lg font-bold" style={{ color: colors.text }}>{title}</Text><Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>{status} · {participants.length} participant{participants.length === 1 ? '' : 's'}</Text></View>
      <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.accent + '18' }}><Text className="text-[11px] font-semibold" style={{ color: colors.accent }}>Interview</Text></View>
    </View>
    <View className="flex-1 mx-5 mb-4 rounded-3xl border overflow-hidden" style={{ minHeight: 180, backgroundColor: '#0F172A', borderColor: colors.border }}>
      {remoteCamera && isTrackReference(remoteCamera) && !remoteCamera.publication.isMuted && remoteCamera.publication.track
        ? <VideoTrack trackRef={remoteCamera} zOrder={0} mirror={false} objectFit="contain" style={{ width: '100%', height: '100%' }} />
        : <View className="flex-1 items-center justify-center px-8 gap-3">
          <MaterialIcons name={remoteParticipant ? 'videocam-off' : 'person-outline'} size={52} color="#CBD5E1" />
          <Text className="text-sm font-semibold text-center text-white">{remoteParticipant?.name || 'Waiting for the other participant…'}</Text>
          <Text className="text-xs text-center leading-5" style={{ color: '#CBD5E1' }}>{remoteParticipant ? 'Camera off · Audio is still available' : 'Their video will appear here when they join.'}</Text>
        </View>}
      <View pointerEvents="none" className="absolute top-3 right-3 w-28 h-40 rounded-2xl border overflow-hidden" style={{ backgroundColor: '#1E293B', borderColor: '#64748B', zIndex: 1 }}>
        {localCamera && isTrackReference(localCamera) && !localCamera.publication.isMuted && localCamera.publication.track
          ? <VideoTrack trackRef={localCamera} zOrder={1} mirror objectFit="cover" style={{ width: '100%', height: '100%' }} />
          : <View className="flex-1 items-center justify-center"><MaterialIcons name="videocam-off" size={27} color="#CBD5E1" /></View>}
        <View className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex-row items-center justify-between" style={{ backgroundColor: 'rgba(15,23,42,0.8)' }}>
          <Text className="text-[10px] font-semibold text-white">You</Text><MaterialIcons name={isMicrophoneEnabled ? 'mic' : 'mic-off'} size={13} color="#FFFFFF" />
        </View>
      </View>
      {remoteParticipant && <View pointerEvents="none" className="absolute bottom-4 left-4 right-4 flex-row items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(15,23,42,0.8)' }}>
        <MaterialIcons name={remoteParticipant.isMicrophoneEnabled ? 'mic' : 'mic-off'} size={16} color="#FFFFFF" />
        <Text numberOfLines={1} className="flex-1 text-xs font-semibold text-white">{remoteParticipant.name || 'Interview participant'}</Text>
      </View>}
    </View>
    <View className="border-t px-5 pt-4" style={{ backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View className="flex-row items-center justify-center gap-6">
      <Control icon={isMicrophoneEnabled ? 'mic' : 'mic-off'} label={isMicrophoneEnabled ? 'Mute' : 'Unmute'} disabled={!connected || controlBusy} onPress={() => void toggle('mic')} />
      <Control icon={isCameraEnabled ? 'videocam' : 'videocam-off'} label={isCameraEnabled ? 'Camera off' : 'Camera on'} disabled={!connected || controlBusy} onPress={() => void toggle('camera')} />
      <Control icon="call-end" label="Leave" onPress={onLeave} disabled={ending} destructive />
      </View>
      {onEndInterview && <TouchableOpacity onPress={() => setConfirmEnd(true)} disabled={ending} accessibilityRole="button" accessibilityState={{ disabled: ending, busy: ending }} className="flex-row items-center justify-center gap-2 border rounded-xl mt-4 px-3 py-3" style={{ borderColor: colors.accent, opacity: ending ? 0.5 : 1 }}>
        {ending ? <ActivityIndicator size="small" color={colors.accent} /> : <MaterialIcons name="stop-circle" size={19} color={colors.accent} />}
        <Text className="text-xs font-semibold" style={{ color: colors.accent }}>{ending ? 'Ending interview…' : 'End Interview'}</Text>
      </TouchableOpacity>}
    </View>
    <NotificationModal visible={confirmEnd} title="End interview?" message="This closes the call for both participants and disables Join. You can schedule another interview later." iconName="call-end" primaryButtonText="End Interview" onPrimaryPress={() => void endInterview()} secondaryButtonText="Cancel" onSecondaryPress={() => setConfirmEnd(false)} buttonLayout="row" />
    <NotificationModal visible={!!notice} title="Device unavailable" message={notice || ''} iconName="info-outline" onPrimaryPress={() => setNotice(null)} />
  </View>;
}

function Control({ icon, label, onPress, disabled, destructive }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; onPress: () => void; disabled?: boolean; destructive?: boolean }) {
  const { colors } = useDarkMode();
  return <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} className="items-center gap-2" style={{ opacity: disabled ? 0.45 : 1 }}>
    <View className="w-14 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: destructive ? colors.primary : colors.background }}><MaterialIcons name={icon} size={25} color={destructive ? '#FFFFFF' : colors.text} /></View>
    <Text className="text-[11px] font-medium" style={{ color: colors.textSecondary }}>{label}</Text>
  </TouchableOpacity>;
}
