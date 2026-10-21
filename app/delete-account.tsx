import api from '@/api/axios';
import InputField from '@/components/ui/InputField';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import { clearPushToken } from '@/utils/notifications';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';
import { router, Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONSEQUENCES = [
  { icon: 'person-off', title: 'Your account cannot be restored', body: 'You will be signed out on all devices. Your identifying profile details will be cleared, and profile uploads will be queued for removal.' },
  { icon: 'work-off', title: 'Work and applications will close', body: 'Your job posts will close, open applications will be cancelled, and ongoing engagements will be marked ended in DiskarTech. Settle outstanding work and payments directly with the other party.' },
  { icon: 'workspace-premium', title: 'Pro benefits will end', body: 'You can delete an account with an active Pro plan. Unused access ends, and deletion does not automatically issue a refund. Avoid completing any pending checkout after deleting.' },
  { icon: 'history', title: 'Some shared records will remain', body: 'Anonymous account references and shared work, certificate, review, payment, and safety-report records are retained. Shared messages and attachments are not automatically erased. Contact support about retained information.' },
] as const;

export default function DeleteAccountScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [retryIn, setRetryIn] = useState(0);
  const [working, setWorking] = useState<'sending' | 'deleting' | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; deleted?: boolean; cleanupFailed?: boolean } | null>(null);
  const deletionComplete = !!notice?.deleted;
  const autoRedirect = deletionComplete && !notice?.cleanupFailed;
  const valid = codeSent && /^\d{6}$/.test(code) && confirmation === 'DELETE' && acknowledged;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const tick = () => setRetryIn(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    if (retryAt <= Date.now()) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [retryAt]);

  useEffect(() => {
    if (!working && !deletionComplete) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [working, deletionComplete]);

  useEffect(() => {
    if (!autoRedirect) return;
    const timeout = setTimeout(() => {
      setNotice(null);
      router.replace('/auth/welcome');
    }, 2500);
    return () => clearTimeout(timeout);
  }, [autoRedirect]);

  const goBack = () => {
    if (busy.current) return;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const showFailure = (error: unknown, title: string) => {
    if (!mounted.current) return;
    const data = isAxiosError(error) ? error.response?.data : null;
    const retryAfter = Number(data?.retry_after || (isAxiosError(error) ? error.response?.headers?.['retry-after'] : 0));
    if (Number.isFinite(retryAfter) && retryAfter > 0) setRetryAt(Date.now() + retryAfter * 1000);
    const message = data?.errors?.code?.[0] || data?.message;
    setNotice({ title, message: typeof message === 'string' ? message : 'Check your connection and try again. Your account has not been confirmed as deleted.' });
  };

  const sendCode = async () => {
    if (busy.current || retryAt > Date.now()) return;
    busy.current = true;
    setWorking('sending');
    Keyboard.dismiss();
    try {
      const response = await api.post('/user/deletion-code', {}, { timeout: 30000 });
      if (!mounted.current) return;
      setCodeSent(true);
      setCode('');
      setRetryAt(Date.now() + (Number(response.data?.retry_after) || 60) * 1000);
      setNotice({ title: 'Check your email', message: 'We sent a 6-digit deletion code to your registered email. It expires in 5 minutes. Request a new code on this device if you sign in again.' });
    } catch (error) {
      showFailure(error, 'Could not send code');
    } finally {
      busy.current = false;
      if (mounted.current) setWorking(null);
    }
  };

  const deleteAccount = async () => {
    if (busy.current || !valid) return;
    busy.current = true;
    setConfirmVisible(false);
    setWorking('deleting');
    Keyboard.dismiss();
    let deleted = false;
    try {
      const [[, originalToken], [, userString]] = await AsyncStorage.multiGet(['userToken', 'userData']);
      await api.delete('/user/account', { data: { code, confirmation, acknowledged }, timeout: 30000 });
      deleted = true;
      // Remove the session only after backend confirmation. Never clear a newer login.
      if (await AsyncStorage.getItem('userToken') === originalToken) {
        let userId: string | number | undefined;
        try { userId = userString ? JSON.parse(userString)?.id : undefined; } catch { /* Continue local cleanup. */ }
        // Firestore can wait indefinitely while offline. Do not delay sign-out,
        // or let a late cleanup remove a newer account's locally saved push token.
        if (userId) void clearPushToken(userId, { clearLocalToken: false });
        if (await AsyncStorage.getItem('userToken') === originalToken) {
          await AsyncStorage.multiRemove(['userToken', 'userProfile', 'userData', 'expo_push_token']);
        }
      }
      if (mounted.current) {
        setCode('');
        setConfirmation('');
        setNotice({ title: 'Account deleted', message: 'Your DiskarTech account has been permanently deleted. Shared records described on this screen remain.', deleted: true });
      }
    } catch (error) {
      if (deleted) {
        if (mounted.current) setNotice({ title: 'Account deleted', message: 'Your account was deleted, but saved sign-in data could not be fully cleared on this phone. Close the app and clear its storage if your old session still appears.', deleted: true, cleanupFailed: true });
      } else showFailure(error, 'Could not delete account');
    } finally {
      busy.current = false;
      if (mounted.current) setWorking(null);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ gestureEnabled: !working && !deletionComplete }} />
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center flex-row items-center gap-3 px-6 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={goBack} disabled={!!working} accessibilityRole="button" accessibilityLabel="Go back" className="w-12 h-12 items-center justify-center">
          <MaterialIcons name="arrow-back" size={23} color={isDark ? colors.text : '#000000'} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>Delete account</Text>
      </View>
      <KeyboardAwareScrollView className="flex-1" enableOnAndroid keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View className="w-full max-w-2xl self-center px-6">
          <View className="pt-4 pb-6">
            <MaterialIcons name="person-remove" size={34} color={colors.accent} />
            <Text className="text-2xl font-bold leading-8 mt-4" style={{ color: colors.text }}>Before you leave</Text>
            <Text className="text-sm leading-6 mt-3" style={{ color: colors.textSecondary }}>Deleting your account is permanent. Save any documents or certificates you need before continuing.</Text>
          </View>
          {CONSEQUENCES.map(item => (
            <View key={item.title} className="flex-row gap-3 py-4 border-t" style={{ borderColor: colors.border }}>
              <MaterialIcons name={item.icon} size={22} color={colors.accent} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-sm font-bold leading-6" style={{ color: colors.text }}>{item.title}</Text>
                <Text className="text-sm leading-6 mt-1" style={{ color: colors.textSecondary }}>{item.body}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={() => router.push('/help-center')} disabled={!!working} accessibilityRole="button" className="flex-row items-center gap-2 py-4">
            <MaterialIcons name="help-outline" size={20} color={colors.accent} />
            <Text className="text-sm font-semibold" style={{ color: colors.accent }}>Need help instead? Contact support</Text>
          </TouchableOpacity>

          <View className="border-t pt-6 mt-2" style={{ borderColor: colors.border }}>
            <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>Confirm it is you</Text>
            <Text className="text-sm leading-6 mb-4" style={{ color: colors.textSecondary }}>We will send a deletion code to your registered email. This also applies if you signed in with Google.</Text>
            <TouchableOpacity onPress={sendCode} disabled={!!working || retryIn > 0} accessibilityRole="button" className="min-h-12 flex-row items-center justify-center gap-2 border rounded-xl px-4 py-3 mb-5" style={{ borderColor: colors.border, opacity: working || retryIn > 0 ? 0.6 : 1 }}>
              {working === 'sending' && <ActivityIndicator size="small" color={colors.accent} />}
              <Text className="text-sm font-semibold text-center" style={{ color: colors.accent }}>{working === 'sending' ? 'Sending code...' : retryIn > 0 ? `Resend in ${retryIn}s` : codeSent ? 'Send a new code' : 'Send verification code'}</Text>
            </TouchableOpacity>
            <InputField label="Deletion code" accessibilityLabel="6-digit deletion code" placeholder="Enter the 6-digit code" icon="mail-outline" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} value={code} onChangeText={setCode} editable={codeSent && !working} />
            <InputField label="Type DELETE to confirm" accessibilityLabel="Type DELETE to confirm" placeholder="DELETE" autoCapitalize="characters" autoComplete="off" value={confirmation} onChangeText={setConfirmation} editable={!working} maxLength={6} />
            <TouchableOpacity onPress={() => setAcknowledged(value => !value)} disabled={!!working} accessibilityRole="checkbox" accessibilityState={{ checked: acknowledged, disabled: !!working }} accessibilityLabel="I understand deletion is permanent and some shared records will remain" className="flex-row items-start gap-3 py-3 mb-5">
              <MaterialIcons name={acknowledged ? 'check-box' : 'check-box-outline-blank'} size={24} color={acknowledged ? colors.accent : colors.textSecondary} />
              <Text className="flex-1 text-sm leading-6" style={{ color: colors.textSecondary }}>I understand that deletion is permanent, ongoing work and Pro access will end, and some shared records will remain.</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { if (!busy.current && valid) { Keyboard.dismiss(); setConfirmVisible(true); } }} disabled={!valid || !!working} accessibilityRole="button" accessibilityState={{ disabled: !valid || !!working, busy: working === 'deleting' }} className="min-h-12 rounded-xl flex-row items-center justify-center gap-2 px-4 py-4" style={{ backgroundColor: '#DC2626', opacity: !valid || working ? 0.45 : 1 }}>
              {working === 'deleting' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="delete-forever" size={22} color="#FFFFFF" />}
              <Text className="text-sm font-bold text-white">{working === 'deleting' ? 'Deleting account...' : 'Delete my account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goBack} disabled={!!working} accessibilityRole="button" className="items-center justify-center min-h-12 mt-2 py-3">
              <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>Keep my account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
      <NotificationModal visible={confirmVisible} title="Permanently delete account?" message="This cannot be undone. Your account access, ongoing engagements in DiskarTech, and Pro benefits will end. Shared records described on this screen will remain." iconName="delete-forever" primaryButtonText="Delete" onPrimaryPress={deleteAccount} secondaryButtonText="Cancel" onSecondaryPress={() => setConfirmVisible(false)} buttonLayout="row" />
      <NotificationModal visible={!!notice} title={notice?.title ?? ''} message={notice?.message ?? ''} iconName={notice?.cleanupFailed ? 'info-outline' : notice?.deleted ? 'check-circle' : 'info-outline'} iconColor={autoRedirect ? '#16A34A' : colors.accent} iconBgColor={autoRedirect ? 'bg-green-50' : 'bg-red-50'} hideActions={autoRedirect} primaryButtonText="OK" onPrimaryPress={() => { if (autoRedirect) return; const deleted = notice?.deleted; setNotice(null); if (deleted) router.replace('/auth/welcome'); }} />
    </View>
  );
}
