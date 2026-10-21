import api from '@/api/axios';
import InputField from '@/components/ui/InputField';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import { passwordChecks, validateNewPassword } from '@/utils/passwordChange';
import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'email' | 'code' | 'password';
type Errors = Partial<Record<'email' | 'code' | 'password' | 'password_confirmation', string>>;

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  // Recovery tokens stay in memory and are never cached or logged.
  const [resetToken, setResetToken] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<{ message: string; success: boolean } | null>(null);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const remainingLabel = remaining >= 60 ? `${Math.floor(remaining / 60)}m ${String(remaining % 60).padStart(2, '0')}s` : `${remaining}s`;
  const checks = passwordChecks(password);
  const passwordErrors = validateNewPassword(password, confirmation);

  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const request = async (action: 'send' | 'verify' | 'reset') => {
    if (pending.current || (action === 'send' && resendAt > Date.now())) return;
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) nextErrors.email = 'Enter a valid email address.';
    if (action === 'verify' && !/^[0-9]{6}$/.test(code)) nextErrors.code = 'Enter the 6-digit code from your email.';
    if (action === 'reset') Object.assign(nextErrors, passwordErrors);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    pending.current = true; setBusy(true); Keyboard.dismiss();
    try {
      if (action === 'send') {
        const response = await api.post('/password/forgot', { email: normalizedEmail }, { timeout: 30000 });
        const delay = Number(response.data?.retry_after);
        setEmail(normalizedEmail); setCode(''); setResetToken(''); setPassword(''); setConfirmation('');
        setResendAt(Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 90) * 1000); setNow(Date.now()); setStep('code');
      } else if (action === 'verify') {
        const response = await api.post('/password/verify-code', { email: normalizedEmail, code }, { timeout: 30000 });
        if (typeof response.data?.reset_token !== 'string' || !/^[a-f0-9]{64}$/.test(response.data.reset_token)) throw new Error('Invalid reset response');
        setResetToken(response.data.reset_token); setCode(''); setStep('password');
      } else {
        await api.post('/password/reset', { email: normalizedEmail, reset_token: resetToken, password, password_confirmation: confirmation }, { timeout: 30000 });
        setPassword(''); setConfirmation(''); setResetToken('');
        setNotice({ message: 'Your password has been reset. Log in with your new password. Other devices will need to log in again.', success: true });
      }
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 422) {
        const fields = error.response?.data?.errors;
        const validation: Errors = {};
        for (const field of ['email', 'code', 'password', 'password_confirmation'] as const) {
          if (typeof fields?.[field]?.[0] === 'string') validation[field] = fields[field][0];
        }
        if (fields?.reset_token) {
          setResetToken(''); setPassword(''); setConfirmation(''); setStep('email');
          setNotice({ message: 'Your reset session has expired. Request a new code to continue.', success: false });
        } else if (Object.keys(validation).length) setErrors(validation);
        else setNotice({ message: 'Please check your details and try again.', success: false });
      } else {
        const delay = Number(error.response?.data?.retry_after || error.response?.headers?.['retry-after']);
        if (status === 429 && Number.isFinite(delay) && delay > 0) { setResendAt(Date.now() + delay * 1000); setNow(Date.now()); }
        setNotice({ message: status === 429 ? 'Too many attempts. Please wait before trying again.'
          : status === 404 ? 'Password recovery is currently unavailable. Please try again later.'
          : status && status >= 500 ? 'The reset service is unavailable right now. Please try again later.'
          : 'Could not connect. Please check your connection and try again.', success: false });
      }
    } finally { pending.current = false; setBusy(false); }
  };

  const action = step === 'email' ? 'send' : step === 'code' ? 'verify' : 'reset';
  const stepIndex = step === 'email' ? 0 : step === 'code' ? 1 : 2;
  const disabled = busy || (step === 'email' && (remaining > 0 || !email.trim())) || (step === 'code' && code.length !== 6)
    || (step === 'password' && Object.keys(passwordErrors).length > 0);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center flex-row items-center gap-3 px-6 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={() => router.back()} disabled={busy} accessibilityRole="button" accessibilityLabel="Back to login" accessibilityState={{ disabled: busy }} activeOpacity={0.75} className="w-11 h-11 items-center justify-center" style={{ opacity: busy ? 0.5 : 1 }}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text className="flex-1 text-base font-semibold" style={{ color: colors.text }}>Account recovery</Text>
      </View>
      <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={24} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View className="w-full max-w-2xl self-center">
          <View className="flex-row gap-3 mb-8" accessible accessibilityLabel={`Recovery step ${stepIndex + 1} of 3`}>
            {['Email', 'Verification', 'New password'].map((label, index) => (
              <View key={label} className="flex-1 gap-2">
                <View className="h-1 rounded-full" style={{ backgroundColor: index <= stepIndex ? colors.primary : colors.border }} />
                <Text className="text-xs font-medium" style={{ color: index === stepIndex ? colors.text : colors.textSecondary }}>{label}</Text>
              </View>
            ))}
          </View>

          <View className="w-14 h-14 rounded-2xl items-center justify-center mb-5" style={{ backgroundColor: isDark ? '#DC262622' : '#FEF2F2' }}>
            <MaterialIcons name={step === 'email' ? 'lock-outline' : step === 'code' ? 'mark-email-read' : 'lock-reset'} size={28} color={colors.accent} accessible={false} />
          </View>
          <Text accessibilityRole="header" className="text-2xl font-bold tracking-tight mb-2" style={{ color: colors.text }}>{step === 'email' ? 'Forgot your password?' : step === 'code' ? 'Verify your email' : 'Create a new password'}</Text>
          <Text className="text-sm leading-6 mb-6" style={{ color: colors.textSecondary }}>{step === 'email' ? 'Enter the email you used to register with DiskarTech to request a reset code.' : step === 'code' ? 'Enter the 6-digit code from your email to continue.' : 'Enter your new password below, then confirm it.'}</Text>
          <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>{step === 'email' ? 'Account email' : step === 'code' ? 'Verification code' : 'Password details'}</Text>
          <View className="rounded-2xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {step !== 'email' && (
              <View className="flex-row items-center gap-3 border-b pb-4 mb-5" style={{ borderColor: colors.border }}>
                <View className="flex-1 gap-1">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>{step === 'code' ? 'Reset code recipient' : 'Verified email'}</Text>
                  <Text className="text-sm font-semibold" numberOfLines={2} style={{ color: colors.text }}>{email}</Text>
                </View>
                {step === 'code' ? (
                  <TouchableOpacity disabled={busy} onPress={() => { setStep('email'); setErrors({}); setCode(''); }} accessibilityRole="button" accessibilityLabel="Use a different email" activeOpacity={0.7} className="min-h-11 justify-center px-2">
                    <Text className="text-sm font-semibold" style={{ color: colors.accent }}>Change</Text>
                  </TouchableOpacity>
                ) : <MaterialIcons name="check-circle" size={20} color={isDark ? '#6EE7B7' : '#15803D'} accessibilityLabel="Email verified" />}
              </View>
            )}
            {step === 'email' ? (
              <InputField label="Email" value={email} onChangeText={value => { setEmail(value.replace(/[\u0000-\u001f\u007f]/g, '')); setErrors({}); }} placeholder="you@example.com" icon="email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} editable={!busy} error={errors.email} containerStyle={{ marginBottom: 0 }} />
            ) : step === 'code' ? (
              <InputField label="6-digit code" value={code} onChangeText={value => { setCode(value.replace(/[^0-9]/g, '').slice(0, 6)); setErrors({}); }} placeholder="000000" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" editable={!busy} error={errors.code} style={{ textAlign: 'center', fontSize: 22, letterSpacing: 7 }} containerStyle={{ marginBottom: 0 }} />
            )
              : <>
                <InputField label="New password" value={password} onChangeText={value => { setPassword(value); setErrors({}); }} placeholder="Enter new password" icon="lock-outline" isPassword autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" maxLength={72} editable={!busy} error={errors.password || (checks.every(check => check.valid) ? passwordErrors.password : undefined)} />
                <View className="rounded-xl p-3 gap-2 mb-5" style={{ backgroundColor: colors.background }}>
                  {checks.map(check => (
                    <View key={check.label} className="flex-row items-start gap-2">
                      <MaterialIcons name={check.valid ? 'check-circle-outline' : 'radio-button-unchecked'} size={16} color={check.valid ? (isDark ? '#6EE7B7' : '#15803D') : colors.textSecondary} accessible={false} style={{ marginTop: 2 }} />
                      <Text className="flex-1 text-xs leading-5" style={{ color: check.valid ? colors.text : colors.textSecondary }}>{check.label.startsWith('One special character') ? 'One special character' : check.label}</Text>
                    </View>
                  ))}
                </View>
                <InputField label="Confirm password" value={confirmation} onChangeText={value => { setConfirmation(value); setErrors({}); }} placeholder="Re-enter new password" icon="lock-outline" isPassword autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" maxLength={72} editable={!busy} error={errors.password_confirmation || (confirmation ? passwordErrors.password_confirmation : undefined)} containerStyle={{ marginBottom: 0 }} />
              </>}
          </View>

          {step === 'code' && <Text className="text-xs leading-5 mt-3 px-1" style={{ color: colors.textSecondary }}>The code expires in 5 minutes. Check your spam folder if you don’t see it.</Text>}
          <TouchableOpacity onPress={() => void request(action)} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled, busy }} activeOpacity={0.8} className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5 mt-5" style={{ backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }}>
            {busy && <ActivityIndicator size="small" color="#FFFFFF" />}
            <Text className="text-base font-semibold text-white">{busy ? 'Please wait...' : step === 'email' ? (remaining ? `Send code in ${remainingLabel}` : 'Send reset code') : step === 'code' ? 'Verify code' : 'Reset password'}</Text>
          </TouchableOpacity>

          {step === 'code' && <View className="items-center mt-4">
            <Text className="text-xs" style={{ color: colors.textSecondary }}>Didn’t receive a code?</Text>
            <TouchableOpacity onPress={() => void request('send')} disabled={busy || remaining > 0} accessibilityRole="button" activeOpacity={0.7} className="min-h-11 justify-center px-4">
              <Text className="text-sm font-semibold" style={{ color: remaining ? colors.textSecondary : colors.accent }}>{remaining ? `Resend code in ${remainingLabel}` : 'Resend code'}</Text>
            </TouchableOpacity>
          </View>}
          {step === 'email' && <>
            <View className="flex-row items-center gap-4 my-6">
              <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
              <Text className="text-xs" style={{ color: colors.textSecondary }}>Signed up with Google?</Text>
              <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
            </View>
            <TouchableOpacity disabled={busy} onPress={() => router.replace({ pathname: '/auth/login', params: { google: '1' } })} accessibilityRole="button" accessibilityLabel="Continue with Google" activeOpacity={0.8} className="min-h-[52px] flex-row items-center justify-center gap-2.5 rounded-xl border px-4 py-3.5" style={{ backgroundColor: colors.surface, borderColor: colors.border, opacity: busy ? 0.5 : 1 }}>
              <Image source={require('../../assets/images/google-g.png')} style={{ width: 20, height: 20 }} resizeMode="contain" accessible={false} />
              <Text className="text-sm font-semibold" style={{ color: colors.text }}>Continue with Google</Text>
            </TouchableOpacity>
          </>}
          {step === 'password' && <Text className="text-xs leading-5 text-center mt-4 px-2" style={{ color: colors.textSecondary }}>After resetting, sign in with your new password.</Text>}
        </View>
      </KeyboardAwareScrollView>
      <NotificationModal visible={!!notice} title={notice?.success ? 'Password reset' : 'Could not continue'} message={notice?.message || ''} iconName={notice?.success ? 'check-circle' : 'error-outline'} primaryButtonText={notice?.success ? 'Back to login' : 'OK'} onPrimaryPress={() => { const success = notice?.success; setNotice(null); if (success) router.replace('/auth/login'); }} />
    </View>
  );
}
