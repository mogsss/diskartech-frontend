import api from '@/api/axios';
import InputField from '@/components/ui/InputField';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import { canChangePasswordForAccount, passwordChecks, PasswordChangeErrors, PasswordChangeValues, validatePasswordChange } from '@/utils/passwordChange';
import { MaterialIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EMPTY_VALUES: PasswordChangeValues = { current_password: '', password: '', password_confirmation: '' };

export default function ChangePasswordScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<PasswordChangeValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [saving, setSaving] = useState(false);
  const [accountAccess, setAccountAccess] = useState<'checking' | 'allowed' | 'error'>('checking');
  const [accessAttempt, setAccessAttempt] = useState(0);
  const busy = useRef(false);
  const [notice, setNotice] = useState<{ title: string; message: string; success: boolean } | null>(null);
  const checks = passwordChecks(values.password);
  const validation = validatePasswordChange(values);
  const valid = Object.keys(validation).length === 0;
  const passwordError = errors.password || (checks.every(check => check.valid) ? validation.password : undefined);
  const confirmationError = values.password_confirmation && values.password_confirmation !== values.password
    ? 'The password confirmation does not match.' : undefined;

  const updateField = (field: keyof PasswordChangeValues, value: string) => {
    // Credentials stay exactly as entered, including spaces and punctuation.
    setValues(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined, ...(field === 'password' ? { password_confirmation: undefined } : {}) }));
  };

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }, []);

  useEffect(() => {
    let active = true;
    setAccountAccess('checking');
    const checkAccess = async () => {
      try {
        const [response, userString] = await Promise.all([api.get('/user/account', { timeout: 10000 }), AsyncStorage.getItem('userData')]);
        if (!active) return;
        const user = userString ? JSON.parse(userString) : null;
        if (!canChangePasswordForAccount(response.data?.account, user)) { goBack(); return; }
        setAccountAccess('allowed');
      } catch {
        if (active) setAccountAccess('error');
      }
    };
    void checkAccess();
    return () => { active = false; };
  }, [accessAttempt, goBack]);

  const handleSubmit = async () => {
    if (busy.current || accountAccess !== 'allowed') return;
    const validation = validatePasswordChange(values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    busy.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      const response = await api.put('/user/password', values, { timeout: 30000 });
      if (response.data?.status !== 'success') throw new Error('Unable to update password.');
      setValues(EMPTY_VALUES);
      setNotice({ title: 'Password updated', message: 'Your DiskarTech password has been updated. Other devices will need to log in again.', success: true });
    } catch (error: any) {
      if (error.response?.status === 403 && error.response?.data?.code === 'google_authentication') { setValues(EMPTY_VALUES); goBack(); return; }
      if (error.response?.status === 422) {
        const serverErrors = error.response.data?.errors;
        const nextErrors: PasswordChangeErrors = {};
        for (const field of ['current_password', 'password', 'password_confirmation'] as const) {
          const messages = serverErrors?.[field];
          const message = Array.isArray(messages) ? messages[0] : undefined;
          if (typeof message === 'string') nextErrors[field] = message;
        }
        if (Object.keys(nextErrors).length) setErrors(nextErrors);
        else setNotice({ title: 'Check your passwords', message: 'Please review the password fields and try again.', success: false });
      } else {
        setNotice({ title: 'Could not change password', message: error.response?.status === 429
          ? 'Too many attempts. Please wait a moment before trying again.'
          : 'Please check your connection and try again.', success: false });
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center flex-row items-center gap-3 px-6 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={goBack} disabled={saving} accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled: saving }} activeOpacity={0.75} className="w-12 h-12 items-center justify-center" style={{ opacity: saving ? 0.5 : 1 }}>
          <MaterialIcons name="arrow-back" size={23} color={colors.text} />
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold tracking-tight" style={{ color: colors.text }}>Change password</Text>
      </View>
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
      >
        <View className="w-full max-w-2xl self-center">
          {accountAccess === 'checking' ? (
            <View className="items-center py-12 gap-3"><ActivityIndicator size="large" color={colors.primary} /><Text className="text-sm" style={{ color: colors.textSecondary }}>Checking your account...</Text></View>
          ) : accountAccess === 'error' ? (
            <View className="items-center py-8 gap-4">
              <Text className="text-sm text-center leading-6" style={{ color: colors.textSecondary }}>Unable to check your account. Please check your connection and try again.</Text>
              <TouchableOpacity onPress={() => setAccessAttempt(attempt => attempt + 1)} accessibilityRole="button" activeOpacity={0.75} className="min-h-12 justify-center rounded-xl px-5" style={{ backgroundColor: colors.primary }}><Text className="text-sm font-semibold text-white">Try again</Text></TouchableOpacity>
            </View>
          ) : <>
          <Text className="text-sm leading-6 mb-5" style={{ color: colors.textSecondary }}>Enter your current DiskarTech password, then choose a new password. Your Google password is separate.</Text>
          <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>Password details</Text>
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <InputField label="Current DiskarTech password" placeholder="Enter current password" isPassword icon="lock-outline" value={values.current_password} onChangeText={value => updateField('current_password', value)} error={errors.current_password} autoCapitalize="none" textContentType="password" autoComplete="current-password" maxLength={4096} editable={!saving} />
            <InputField label="New password" placeholder="Enter new password" isPassword icon="lock-outline" value={values.password} onChangeText={value => updateField('password', value)} error={passwordError} autoCapitalize="none" textContentType="newPassword" autoComplete="new-password" maxLength={72} editable={!saving} />
            <View className="gap-2 mb-5">
              {checks.map(check => (
                <View key={check.label} className="flex-row items-start gap-2">
                  <MaterialIcons name={check.valid ? 'check-circle-outline' : 'radio-button-unchecked'} size={16} color={check.valid ? (isDark ? '#6EE7B7' : '#15803D') : colors.textSecondary} accessible={false} style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-xs leading-5" style={{ color: check.valid ? colors.text : colors.textSecondary }}>{check.label}</Text>
                </View>
              ))}
            </View>
            <InputField label="Confirm new password" placeholder="Re-enter new password" isPassword icon="lock-outline" value={values.password_confirmation} onChangeText={value => updateField('password_confirmation', value)} error={errors.password_confirmation || confirmationError} autoCapitalize="none" textContentType="newPassword" autoComplete="new-password" maxLength={72} editable={!saving} containerStyle={{ marginBottom: 0 }} />
          </View>
          <TouchableOpacity onPress={handleSubmit} disabled={saving || !valid} accessibilityRole="button" accessibilityLabel="Update password" accessibilityState={{ disabled: saving || !valid, busy: saving }} activeOpacity={0.8} className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3.5 mt-5" style={{ backgroundColor: colors.primary, opacity: saving || !valid ? 0.5 : 1 }}>
            {saving && <ActivityIndicator size="small" color="#FFFFFF" />}
            <Text className="text-base font-semibold text-white">{saving ? 'Updating password...' : 'Update password'}</Text>
          </TouchableOpacity>
          <Text className="text-xs leading-5 mt-3 text-center" style={{ color: colors.textSecondary }}>Other devices will need to log in again after you change your password.</Text>
          </>}
        </View>
      </KeyboardAwareScrollView>
      <NotificationModal visible={!!notice} title={notice?.title ?? ''} message={notice?.message ?? ''} iconName={notice?.success ? 'check-circle' : 'error-outline'} iconColor={notice?.success ? '#16A34A' : colors.accent} primaryButtonText={notice?.success ? 'Done' : 'OK'} onPrimaryPress={() => { const success = notice?.success; setNotice(null); if (success) goBack(); }} />
    </View>
  );
}
