import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { promptNativeGoogleSignIn, GoogleAuthProfile } from '@/utils/googleAuth';

interface GoogleRegisterButtonProps {
  onGoogleProfileLoaded: (profile: GoogleAuthProfile) => void;
  linkedEmail?: string;
  linkedName?: string;
  linkedPhoto?: string;
  onUnlink?: () => void;
}

export default function GoogleRegisterButton({
  onGoogleProfileLoaded,
  linkedEmail,
  linkedName,
  linkedPhoto,
  onUnlink,
}: GoogleRegisterButtonProps) {
  const { isDark, colors } = useDarkMode();
  const [modalVisible, setModalVisible] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Custom Google account form states
  const [customFirstName, setCustomFirstName] = useState('');
  const [customLastName, setCustomLastName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [errorText, setErrorText] = useState('');

  const defaultAccounts: GoogleAuthProfile[] = [
    {
      id: 'g_user_1',
      name: 'John Lee Mogol',
      firstName: 'John Lee',
      lastName: 'Mogol',
      email: 'johnlee.mogol.dev@gmail.com',
      photoUrl: 'https://ui-avatars.com/api/?name=John+Lee+Mogol&background=DC2626&color=fff',
    },
    {
      id: 'g_user_2',
      name: 'Juan Dela Cruz',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'juandelacruz.student@gmail.com',
      photoUrl: 'https://ui-avatars.com/api/?name=Juan+Dela+Cruz&background=2563EB&color=fff',
    },
  ];

  const handleSelectAccount = (profile: GoogleAuthProfile) => {
    setModalVisible(false);
    setShowCustomInput(false);
    setErrorText('');
    onGoogleProfileLoaded(profile);
  };

  const handleConfirmCustom = () => {
    if (!customEmail.trim() || !customEmail.includes('@')) {
      setErrorText('Pakilagay ang wastong email address.');
      return;
    }
    if (!customFirstName.trim()) {
      setErrorText('Pakilagay ang iyong pangalan.');
      return;
    }

    const first = customFirstName.trim();
    const last = customLastName.trim() || 'User';
    const profile: GoogleAuthProfile = {
      id: `g_${Date.now()}`,
      name: `${first} ${last}`,
      firstName: first,
      lastName: last,
      email: customEmail.trim().toLowerCase(),
      photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        `${first}+${last}`
      )}&background=DC2626&color=fff`,
    };

    handleSelectAccount(profile);
  };

  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    try {
      setLoading(true);
      const nativeProfile = await promptNativeGoogleSignIn();
      if (nativeProfile) {
        onGoogleProfileLoaded(nativeProfile);
        return;
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }

    setErrorText('');
    setShowCustomInput(false);
    setModalVisible(true);
  };

  if (linkedEmail) {
    return (
      <View
        style={{
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.75)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(71, 85, 105, 0.4)' : '#E2E8F0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.25 : 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
        className="p-4 rounded-2xl border mb-5"
      >
        {/* Top Header Row: Status Badge & Change Action */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <MaterialIcons name="check-circle" size={13} color="#10B981" />
            <Text className="text-[11px] font-semibold text-emerald-500">
              Connected with Google
            </Text>
          </View>

          {onUnlink && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onUnlink}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60"
            >
              <MaterialIcons name="swap-horiz" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
              <Text
                style={{ color: isDark ? '#CBD5E1' : '#475569' }}
                className="text-[11px] font-semibold"
              >
                Change
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* User Identity Row: Avatar with Google Badge + Name + Email */}
        <View className="flex-row items-center gap-3">
          <View className="relative">
            <View
              style={{ borderColor: isDark ? '#334155' : '#E2E8F0' }}
              className="w-12 h-12 rounded-full overflow-hidden border-2 bg-slate-100 dark:bg-slate-800 items-center justify-center shadow-xs"
            >
              {linkedPhoto ? (
                <Image source={{ uri: linkedPhoto }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <AntDesign name="google" size={24} color="#EA4335" />
              )}
            </View>

            {/* Overlapping mini Google Badge on bottom-right corner */}
            {linkedPhoto && (
              <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700">
                <AntDesign name="google" size={11} color="#EA4335" />
              </View>
            )}
          </View>

          <View className="flex-1 justify-center">
            {linkedName ? (
              <Text
                style={{ color: colors.text }}
                className="text-base font-bold tracking-tight mb-0.5"
                numberOfLines={1}
              >
                {linkedName}
              </Text>
            ) : null}
            <Text
              style={{ color: colors.textSecondary }}
              className="text-xs font-medium"
              numberOfLines={1}
            >
              {linkedEmail}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-6">
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        disabled={loading}
        style={{
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderColor: isDark ? colors.border : '#E2E8F0',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}
        className="flex-row items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#EA4335" />
        ) : (
          <>
            <AntDesign name="google" size={20} color="#EA4335" />
            <Text style={{ color: colors.text }} className="text-sm font-bold">
              Continue with Google
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View className="flex-row items-center gap-3 mt-4">
        <View
          style={{ backgroundColor: isDark ? colors.border : '#E2E8F0' }}
          className="flex-1 h-px"
        />
        <Text
          style={{ color: colors.textSecondary }}
          className="text-xs font-medium uppercase tracking-wider"
        >
          or fill in manually
        </Text>
        <View
          style={{ backgroundColor: isDark ? colors.border : '#E2E8F0' }}
          className="flex-1 h-px"
        />
      </View>

      {/* Google Account Picker Modal (Google One-Tap Style) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/60"
        >
          <Pressable
            className="flex-1"
            onPress={() => setModalVisible(false)}
          />

          <View
            style={{
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
            }}
            className="p-6 shadow-2xl"
          >
            {/* Modal Handle */}
            <View className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700 self-center mb-4" />

            {/* Header */}
            <View className="flex-row items-center gap-3 mb-2">
              <View className="w-8 h-8 rounded-full bg-white shadow-xs items-center justify-center">
                <AntDesign name="google" size={18} color="#EA4335" />
              </View>
              <View className="flex-1">
                <Text
                  style={{ color: colors.text }}
                  className="text-base font-bold"
                >
                  Sign in with Google
                </Text>
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-xs"
                >
                  to continue to DiskarTech
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View className="h-px bg-gray-200 dark:bg-gray-800 my-3" />

            {!showCustomInput ? (
              <>
                <Text
                  style={{ color: colors.textSecondary }}
                  className="text-xs font-medium mb-3"
                >
                  Choose an account:
                </Text>

                {defaultAccounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    activeOpacity={0.7}
                    onPress={() => handleSelectAccount(acc)}
                    style={{
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    }}
                    className="flex-row items-center p-3 rounded-2xl border mb-2.5 bg-gray-50/50 dark:bg-gray-800/40"
                  >
                    <Image
                      source={{ uri: acc.photoUrl }}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                    <View className="flex-1">
                      <Text
                        style={{ color: colors.text }}
                        className="text-sm font-semibold"
                      >
                        {acc.name}
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary }}
                        className="text-xs"
                      >
                        {acc.email}
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}

                {/* Add Custom / Real Account Option */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowCustomInput(true)}
                  style={{
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  }}
                  className="flex-row items-center p-3 rounded-2xl border mb-2 border-dashed bg-transparent"
                >
                  <View className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 items-center justify-center mr-3">
                    <MaterialIcons name="person-add" size={20} color={colors.accent} />
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ color: colors.text }}
                      className="text-sm font-semibold text-red-600 dark:text-red-400"
                    >
                      Use another Google account
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary }}
                      className="text-xs"
                    >
                      Mag-type ng sarili mong Gmail para sa live OTP
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              /* Custom Gmail Form */
              <View className="mt-1">
                <Text
                  style={{ color: colors.text }}
                  className="text-sm font-bold mb-3"
                >
                  Enter your Google Account Details
                </Text>

                {errorText ? (
                  <Text className="text-xs text-red-600 mb-2 font-medium">
                    {errorText}
                  </Text>
                ) : null}

                <View className="mb-2.5">
                  <Text
                    style={{ color: colors.textSecondary }}
                    className="text-xs mb-1 font-medium"
                  >
                    First Name
                  </Text>
                  <TextInput
                    value={customFirstName}
                    onChangeText={setCustomFirstName}
                    placeholder="e.g. John"
                    placeholderTextColor="#94A3B8"
                    style={{
                      color: colors.text,
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    }}
                    className="p-3 rounded-xl border text-sm"
                  />
                </View>

                <View className="mb-2.5">
                  <Text
                    style={{ color: colors.textSecondary }}
                    className="text-xs mb-1 font-medium"
                  >
                    Last Name
                  </Text>
                  <TextInput
                    value={customLastName}
                    onChangeText={setCustomLastName}
                    placeholder="e.g. Doe"
                    placeholderTextColor="#94A3B8"
                    style={{
                      color: colors.text,
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    }}
                    className="p-3 rounded-xl border text-sm"
                  />
                </View>

                <View className="mb-4">
                  <Text
                    style={{ color: colors.textSecondary }}
                    className="text-xs mb-1 font-medium"
                  >
                    Google Email Address
                  </Text>
                  <TextInput
                    value={customEmail}
                    onChangeText={setCustomEmail}
                    placeholder="youremail@gmail.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                      color: colors.text,
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    }}
                    className="p-3 rounded-xl border text-sm"
                  />
                </View>

                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={() => setShowCustomInput(false)}
                    style={{
                      backgroundColor: isDark ? '#334155' : '#F1F5F9',
                    }}
                    className="flex-1 py-3.5 rounded-xl items-center"
                  >
                    <Text
                      style={{ color: colors.text }}
                      className="text-sm font-semibold"
                    >
                      Back
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleConfirmCustom}
                    className="flex-1 py-3.5 rounded-xl bg-red-600 items-center shadow-xs"
                  >
                    <Text className="text-white text-sm font-bold">
                      Continue
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text
              style={{ color: colors.textSecondary }}
              className="text-[11px] text-center mt-4"
            >
              Ang napiling Google account ay gagamitin para sa profile at pagpapadala ng 6-digit OTP verification code.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
