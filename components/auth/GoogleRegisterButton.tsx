import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { promptNativeGoogleSignIn, GoogleAuthProfile } from '@/utils/googleAuth';
import api from '@/api/axios';
import { router } from 'expo-router';

interface GoogleRegisterButtonProps {
  onGoogleProfileLoaded: (profile: GoogleAuthProfile) => void;
  linkedEmail?: string;
  linkedName?: string;
  linkedPhoto?: string;
  onUnlink?: () => void;
  disabled?: boolean;
}

export default function GoogleRegisterButton({ onGoogleProfileLoaded, linkedEmail, linkedName, linkedPhoto, onUnlink, disabled = false }: GoogleRegisterButtonProps) {
  const { isDark, colors } = useDarkMode();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const pending = useRef(false);
  const busy = disabled || loading;

  const handlePress = async () => {
    if (pending.current || disabled) return;
    pending.current = true;
    setLoading(true);
    setNotice(null);
    setExistingEmail(null);
    let checkingEmail = false;
    try {
      const profile = await promptNativeGoogleSignIn({ selectAccount: true });
      // Cancelling preserves the current selection and never opens a mock account picker.
      if (!profile) return;
      checkingEmail = true;
      setChecking(true);
      const email = profile.email.trim().toLowerCase();
      const response = await api.post('/register/check-email', { email }, { timeout: 15000 });
      if (typeof response.data?.exists !== 'boolean') throw new Error('Invalid availability response.');
      if (response.data.exists) {
        setExistingEmail(email);
        return;
      }
      onGoogleProfileLoaded({ ...profile, email });
    } catch (error: any) {
      setNotice(checkingEmail ? {
        title: 'Could not check email',
        message: error.response?.status === 429 ? 'Please wait before checking another account.' : 'Please check your connection and try again.',
      } : { title: 'Google sign-in unavailable', message: 'Please try again or use email registration instead.' });
    } finally {
      pending.current = false;
      setLoading(false);
      setChecking(false);
    }
  };

  const googleIcon = (size: number) => <Image source={require('../../assets/images/google-g.png')} style={{ width: size, height: size }} resizeMode="contain" accessible={false} />;

  return (
    <View className="mb-5">
      {linkedEmail ? (
        <View className="p-4 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center justify-between gap-2 mb-3">
            <View className="flex-row items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <MaterialIcons name="check-circle" size={13} color="#10B981" accessible={false} />
              <Text className="text-[11px] font-semibold text-emerald-500">Connected with Google</Text>
            </View>
            <TouchableOpacity onPress={() => void handlePress()} disabled={busy} accessibilityRole="button" accessibilityLabel="Change Google account" accessibilityState={{ disabled: busy, busy: loading }} hitSlop={8} activeOpacity={0.7} className="min-h-11 flex-row items-center gap-1 px-3 rounded-full border" style={{ backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border, opacity: disabled ? 0.5 : 1 }}>
              {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialIcons name="swap-horiz" size={16} color={colors.textSecondary} accessible={false} />}
              <Text className="text-xs font-semibold" style={{ color: colors.text }}>{checking ? 'Checking...' : 'Change'}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="relative">
              <View className="w-12 h-12 rounded-full overflow-hidden border items-center justify-center" style={{ borderColor: colors.border, backgroundColor: isDark ? colors.background : '#FFFFFF' }}>
                {linkedPhoto ? <Image source={{ uri: linkedPhoto }} className="w-full h-full" resizeMode="cover" accessible={false} /> : googleIcon(24)}
              </View>
              {linkedPhoto && <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white items-center justify-center border border-slate-200">{googleIcon(12)}</View>}
            </View>
            <View className="flex-1 justify-center">
              {!!linkedName && <Text className="text-base font-bold mb-0.5" style={{ color: colors.text }} numberOfLines={1}>{linkedName}</Text>}
              <Text className="text-xs font-medium" style={{ color: colors.textSecondary }} numberOfLines={1}>{linkedEmail}</Text>
            </View>
          </View>
          {onUnlink && <TouchableOpacity onPress={onUnlink} disabled={busy} accessibilityRole="button" className="min-h-11 justify-center self-start mt-2"><Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Use email instead</Text></TouchableOpacity>}
        </View>
      ) : (
        <>
          <TouchableOpacity onPress={() => void handlePress()} disabled={busy} accessibilityRole="button" accessibilityLabel="Continue with Google" accessibilityState={{ disabled: busy, busy: loading }} activeOpacity={0.85} className="flex-row items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border" style={{ backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: colors.border, opacity: disabled ? 0.5 : 1 }}>
            {loading ? <><ActivityIndicator size="small" color={colors.primary} /><Text className="text-sm font-semibold" style={{ color: colors.text }}>{checking ? 'Checking account...' : 'Connecting...'}</Text></> : <>{googleIcon(20)}<Text className="text-sm font-bold" style={{ color: colors.text }}>Continue with Google</Text></>}
          </TouchableOpacity>
          <View className="flex-row items-center gap-3 mt-4">
            <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
            <Text className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.textSecondary }}>or fill in manually</Text>
            <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
          </View>
        </>
      )}
      <NotificationModal visible={!!notice} title={notice?.title || ''} message={notice?.message || ''} iconName="error-outline" primaryButtonText="OK" onPrimaryPress={() => setNotice(null)} />
      <NotificationModal visible={!!existingEmail} title="Account already exists" message="This email is already registered with DiskarTech. Log in to continue, or choose another Google account." iconName="person" primaryButtonText="Go to Login" onPrimaryPress={() => {
        const email = existingEmail;
        setExistingEmail(null);
        if (email) router.push({ pathname: '/auth/login', params: { google: '1', email } });
      }} secondaryButtonText="Cancel" onSecondaryPress={() => setExistingEmail(null)} />
    </View>
  );
}
