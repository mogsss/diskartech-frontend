import api from '@/api/axios';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { useDarkMode } from '@/hooks/useDarkMode';
import { canChangePasswordForAccount } from '@/utils/passwordChange';
import { clearPushToken, getPushNotificationSettings, setPushNotificationsEnabled } from '@/utils/notifications';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Role = 'student' | 'employer' | 'household';
type Notice = { title: string; message: string; openPhoneSettings?: boolean };
type VerificationProfile = {
  isVerified?: boolean | number | string;
  rejection_reason?: string | null;
  school_id?: string | null;
  coe?: string | null;
  valid_id_path?: string | null;
  employer_certificate_path?: string | null;
};

export default function SettingsScreen() {
  const { isDark, setDarkMode, colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role | null>(null);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [profile, setProfile] = useState<VerificationProfile | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [pushSettings, setPushSettings] = useState<Awaited<ReturnType<typeof getPushNotificationSettings>> | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const pushChanging = useRef(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const version = Constants.expoConfig?.version || '1.0.0';
  const accentSurface = isDark ? colors.primary + '1F' : '#FFF1F2';

  const refreshPushSettings = useCallback(async () => {
    if (pushChanging.current) return;
    try { setPushSettings(await getPushNotificationSettings()); }
    catch { setPushSettings(null); }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setCanChangePassword(false);
    const loadSettings = async () => {
      try {
        const [userString, profileString] = await Promise.all([
          AsyncStorage.getItem('userData'), AsyncStorage.getItem('userProfile'),
        ]);
        if (!active) return;
        const user = userString ? JSON.parse(userString) : null;
        setCanChangePassword(canChangePasswordForAccount(user));
        const userRole = user?.role === 'business' ? 'employer' : user?.role;
        if (['student', 'employer', 'household'].includes(userRole)) setRole(userRole);
        if (profileString) setProfile(JSON.parse(profileString));
        await refreshPushSettings();
        if (active) setSettingsLoading(false);
        if (user?.id) {
          const [profileResult, accountResult] = await Promise.allSettled([api.get('/user/profile'), api.get('/user/account')]);
          if (!active) return;
          if (profileResult.status === 'fulfilled' && profileResult.value.data?.profile) setProfile(profileResult.value.data.profile);
          if (accountResult.status === 'fulfilled') setCanChangePassword(canChangePasswordForAccount(accountResult.value.data?.account, user));
        }
      } catch {
        // Keep cached account information when the network is unavailable.
      } finally { if (active) setSettingsLoading(false); }
    };
    loadSettings();
    return () => { active = false; };
  }, [refreshPushSettings]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPushSettings();
    });
    return () => subscription.remove();
  }, [refreshPushSettings]);

  const handlePushChange = async (enabled: boolean) => {
    if (pushChanging.current || loggingOut) return;
    pushChanging.current = true;
    setPushBusy(true);
    try {
      const userString = await AsyncStorage.getItem('userData');
      const user = userString ? JSON.parse(userString) : null;
      if (!user?.id) throw new Error('Please log in again to update notification preferences.');
      const result = await setPushNotificationsEnabled(user.id, enabled);
      setPushSettings(await getPushNotificationSettings());
      if (result === 'permission-denied') {
        setNotice({ title: 'Allow notifications', message: 'Notifications are blocked on this phone. Allow DiskarTech notifications in your phone settings, then turn this on again.', openPhoneSettings: true });
      } else if (result === 'unavailable') {
        setNotice({ title: 'Push notifications unavailable', message: 'Remote push notifications need the installed DiskarTech app. They are unavailable in Expo Go on Android. If you are using the installed app, check your connection and try again.' });
      } else if (result === 'sync-failed') {
        throw new Error('Could not save your notification preference. Check your connection and try again.');
      }
    } catch (error) {
      setNotice({ title: 'Could not update notifications', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      pushChanging.current = false;
      setPushBusy(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut || pushBusy) return;
    setLogoutVisible(false);
    setLoggingOut(true);
    try {
      const userString = await AsyncStorage.getItem('userData');
      const user = userString ? JSON.parse(userString) : null;
      if (user?.id) await clearPushToken(user.id);
      await AsyncStorage.multiRemove(['userToken', 'userProfile', 'userData']);
      router.replace('/auth/welcome');
    } catch {
      setNotice({ title: 'Could not log out', message: 'Please try again to finish logging out.' });
    } finally { setLoggingOut(false); }
  };

  const openVerification = () => {
    if (role === 'student') router.push('/students/verification-status');
    else if (role) router.push({ pathname: '/employer/verification-status', params: { type: role === 'household' ? 'household' : 'business' } });
  };
  const verified = profile?.isVerified === true || profile?.isVerified === 1 || profile?.isVerified === '1';
  const rejected = !verified && !!profile?.rejection_reason;
  const submitted = role === 'student' ? !!(profile?.school_id && profile?.coe) : role === 'household' ? !!profile?.valid_id_path : !!(profile?.valid_id_path && profile?.employer_certificate_path);
  const verificationLabel = !profile ? 'Check status' : verified ? 'Verified' : rejected ? 'Needs update' : submitted ? 'Pending review' : 'Not verified';
  const statusColor = verified ? (isDark ? '#6EE7B7' : '#15803D') : rejected ? colors.accent : colors.textSecondary;
  const pushDescription = !pushSettings ? (settingsLoading ? 'Checking notification access…' : 'Notification settings are unavailable.') : !pushSettings.supported ? 'Available in the installed DiskarTech app.' : !pushSettings.permissionGranted ? 'Allow notifications in your phone settings.' : 'Receive job updates and message alerts.';
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (role === 'student') router.replace('/students/(tabs)/home');
    else if (role) router.replace({ pathname: '/employer/(tabs)/dashboard', params: { type: role === 'household' ? 'household' : 'business' } });
    else router.replace('/auth/welcome');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.background} withSpacer={false} />
      <View className="w-full max-w-2xl self-center flex-row items-center gap-3 px-3 pb-2" style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" activeOpacity={0.75} className="w-12 h-12 items-center justify-center">
          <MaterialIcons name="arrow-back" size={23} color={isDark ? colors.text : '#000000'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>Settings</Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center px-6 pt-2" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Account">
          <SettingsRow icon="person-outline" title="Edit profile" description="Update your personal and account details." onPress={() => router.push('/edit-profile')} />
          {canChangePassword && <SettingsRow icon="lock-outline" title="Change password" description="Update your DiskarTech account password." onPress={() => router.push('/change-password')} />}
          <SettingsRow icon="verified-user" title="Account verification" description="Review your documents and verification status." onPress={role ? openVerification : undefined} trailing={settingsLoading && !profile ? <ActivityIndicator size="small" color={colors.accent} /> : <Text className="text-[11px] font-semibold text-right max-w-24" style={{ color: statusColor }}>{verificationLabel}</Text>} />
          <SettingsRow icon="person-remove" title="Delete account" description="Permanently close your DiskarTech account." onPress={() => router.push('/delete-account')} destructive last />
        </SettingsSection>
        <SettingsSection title="Preferences">
          <SettingsRow icon="dark-mode" title="Dark mode" description="Use a darker appearance." trailing={<Switch accessibilityLabel="Dark mode" value={isDark} disabled={themeBusy} onValueChange={async (value) => { setThemeBusy(true); try { await setDarkMode(value); } finally { setThemeBusy(false); } }} trackColor={{ false: colors.border, true: colors.accent + '60' }} thumbColor={isDark ? colors.accent : '#FFFFFF'} ios_backgroundColor={colors.border} />} />
          <SettingsRow icon="notifications-none" title="Push notifications" description={pushDescription} trailing={pushBusy ? <ActivityIndicator size="small" color={colors.accent} /> : <Switch accessibilityLabel="Push notifications" value={pushSettings?.enabled ?? false} disabled={settingsLoading || !pushSettings || loggingOut} onValueChange={handlePushChange} trackColor={{ false: colors.border, true: colors.accent + '60' }} thumbColor={pushSettings?.enabled ? colors.accent : '#FFFFFF'} ios_backgroundColor={colors.border} />} />
          <SettingsRow icon="language" title="Language" description="App display language" last trailing={<Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>English</Text>} />
        </SettingsSection>
        <SettingsSection title="Support">
          <SettingsRow icon="help-outline" title="Help Center" description="Find answers to common questions." onPress={() => router.push('/help-center')} />
          <SettingsRow icon="chat-bubble-outline" title="Contact support" description="Get help with your account and activities." onPress={() => router.push('/help-center')} />
          <SettingsRow icon="outlined-flag" title="Report a problem" description="Raise a concern or check your reports." onPress={() => router.push('/help-center')} last />
        </SettingsSection>
        <SettingsSection title="About and policies">
          <SettingsRow icon="info-outline" title="About DiskarTech" description="Our purpose and the features we offer." onPress={() => router.push('/about-diskartech')} />
          <SettingsRow icon="description" title="Terms and Conditions" onPress={() => router.push('/terms-and-conditions')} />
          <SettingsRow icon="security" title="Privacy Policy" onPress={() => router.push('/privacy-policy')} />
          <SettingsRow icon="cookie" title="Cookie Policy" onPress={() => router.push('/cookie-policy')} last />
        </SettingsSection>
        <TouchableOpacity onPress={() => setLogoutVisible(true)} disabled={loggingOut || pushBusy} accessibilityRole="button" accessibilityLabel="Log out" activeOpacity={0.75} className="min-h-12 rounded-2xl flex-row items-center justify-center gap-2 px-4 py-3.5 mt-1" style={{ backgroundColor: accentSurface, opacity: loggingOut || pushBusy ? 0.6 : 1 }}>
          {loggingOut ? <ActivityIndicator size="small" color={colors.accent} /> : <MaterialIcons name="logout" size={21} color={colors.accent} />}
          <Text className="text-sm font-semibold" style={{ color: colors.accent }}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
        </TouchableOpacity>
        <Text className="text-xs text-center mt-6" style={{ color: colors.textSecondary }}>DiskarTech v{version}</Text>
      </ScrollView>
      <NotificationModal visible={logoutVisible} title="Log out?" message="Are you sure you want to log out of DiskarTech?" iconName="logout" primaryButtonText="Log out" onPrimaryPress={handleLogout} secondaryButtonText="Cancel" onSecondaryPress={() => setLogoutVisible(false)} buttonLayout="row" />
      <NotificationModal visible={!!notice} title={notice?.title ?? ''} message={notice?.message ?? ''} iconName="info-outline" primaryButtonText={notice?.openPhoneSettings ? 'Open phone settings' : 'OK'} onPrimaryPress={() => { const openSettings = notice?.openPhoneSettings; setNotice(null); if (openSettings) Linking.openSettings().catch(() => setNotice({ title: 'Could not open settings', message: 'Open your phone settings and allow notifications for DiskarTech.' })); }} secondaryButtonText={notice?.openPhoneSettings ? 'Cancel' : undefined} onSecondaryPress={notice?.openPhoneSettings ? () => setNotice(null) : undefined} />
    </View>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useDarkMode();
  return <View className="mb-5"><Text accessibilityRole="header" className="text-sm font-bold mb-3 ml-1" style={{ color: colors.text }}>{title}</Text><View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>{children}</View></View>;
}

function SettingsRow({ icon, title, description, onPress, trailing, last = false, destructive = false }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  last?: boolean;
  destructive?: boolean;
}) {
  const { colors, isDark } = useDarkMode();
  const content = <><View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? colors.primary + '1F' : '#FFF1F2' }}><MaterialIcons name={icon} size={21} color={colors.accent} /></View><View className="flex-1"><Text className="text-sm font-semibold leading-5" style={{ color: destructive ? colors.accent : colors.text }}>{title}</Text>{description && <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{description}</Text>}</View>{trailing}{onPress && <MaterialIcons name="chevron-right" size={21} color={isDark ? colors.text : '#000000'} />}</>;
  const className = 'flex-row items-center gap-3 px-4 py-4' + (last ? '' : ' border-b');
  return onPress ? <TouchableOpacity onPress={onPress} accessibilityRole="button" activeOpacity={0.75} className={className} style={{ borderColor: colors.border }}>{content}</TouchableOpacity> : <View className={className} style={{ borderColor: colors.border }}>{content}</View>;
}
