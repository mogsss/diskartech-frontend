import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { redirectUserByRole } from '@/utils/authNavigation';
import { registerAndSyncPushToken } from '@/utils/notifications';
import { MaterialIcons } from '@expo/vector-icons';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function VerifyEmailScreen() {
  const { isDark, colors } = useDarkMode();
  const { email, role: paramRole } = useLocalSearchParams<{ email: string; role?: string }>();
  const router = useRouter();
  
  // State para sa 6 na individual digits
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const sendingRef = useRef(false);
  const resendAtRef = useRef(0);

  // States para sa ating Reusable Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  const showModal = useCallback((config: any) => {
    setModalConfig(config);
    setModalVisible(true);
  }, []);

  const startCooldown = useCallback((seconds: unknown) => {
    const duration = Number(seconds);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const deadline = Date.now() + Math.ceil(duration) * 1000;
    resendAtRef.current = deadline;
    setResendAt(deadline);
    setCooldownSeconds(Math.ceil(duration));
  }, []);

  useEffect(() => {
    if (!resendAt) return;
    const updateCountdown = () => {
      setCooldownSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [resendAt]);

  const requestOtp = useCallback(async (title: string) => {
    if (sendingRef.current || resendAtRef.current > Date.now()) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const response = await api.post('/email/send-otp');
      if (response.data.status !== 'success' || response.data.mail_sent !== true) {
        throw new Error('The verification email could not be sent. Please try again later.');
      }
      startCooldown(response.data.retry_after || 60);
      showModal({
        title,
        message: response.data.message || 'Verification email sent. Please check your inbox and spam folder.',
        iconName: 'mark-email-read',
        iconColor: '#16a34a',
        iconBgColor: 'bg-green-50',
        primaryButtonText: 'Got it',
        onPrimaryPress: () => setModalVisible(false),
      });
    } catch (error: any) {
      startCooldown(error.response?.data?.retry_after || error.response?.headers?.['retry-after']);
      showModal({
        title: error.response?.status === 429 ? 'Please Wait' : 'Sending Failed',
        message: error.response?.data?.message || error.message || 'Failed to send OTP. Please try again.',
        iconName: 'error-outline',
        iconColor: '#ef4444',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: () => setModalVisible(false),
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [showModal, startCooldown]);

  useEffect(() => {
    let active = true;
    const sendInitialOtp = async () => {
      let token = await AsyncStorage.getItem('userToken');
      for (let attempt = 0; !token && attempt < 3 && active; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        token = await AsyncStorage.getItem('userToken');
      }
      if (!active) return;
      if (!token) {
        showModal({
          title: 'Session Expired',
          message: 'Please log in again to verify your email.',
          iconName: 'timer-off',
          iconColor: '#ef4444',
          iconBgColor: 'bg-red-50',
          primaryButtonText: 'Go to Login',
          onPrimaryPress: () => {
            setModalVisible(false);
            router.replace('/auth/login' as any);
          },
        });
        return;
      }
      await requestOtp('OTP Sent');
    };
    void sendInitialOtp();
    return () => { active = false; };
  }, [requestOtp, router, showModal]);

  const sendOtpCode = () => requestOtp('OTP Resent');

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otpValues];
    newOtp[index] = text;
    setOtpValues(newOtp);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (index === 5 && text) {
      Keyboard.dismiss();
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (overrideOtp?: string) => {
    const otpCode = overrideOtp || otpValues.join('');
    
    if (otpCode.length !== 6) {
      showModal({
        title: 'Incomplete Code',
        message: 'Please enter a complete 6-digit OTP code.',
        iconName: 'dialpad',
        iconColor: '#ef4444',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: () => setModalVisible(false),
      });
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/email/verify-otp', { otp_code: otpCode });

      if (response.data.status === 'success') {
        const storedUser = await AsyncStorage.getItem('userData');
        const apiUser = response.data.user;
        let parsedStoredUser = storedUser ? JSON.parse(storedUser) : null;

        // Tiyakin ang tamang role: unahin ang mula sa API response, sunod ang paramRole, at huli ang parsedStoredUser
        const resolvedRole = apiUser?.role || (paramRole as string) || parsedStoredUser?.role || 'employer';

        const updatedUser = {
          ...(parsedStoredUser || {}),
          ...(apiUser || {}),
          email: (email as string) || apiUser?.email || parsedStoredUser?.email,
          role: resolvedRole,
          isEmailVerified: true,
        };

        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
        const targetRole = resolvedRole;

        if (updatedUser?.id) {
          registerAndSyncPushToken(updatedUser.id);
        }

        // Fetch profile updates silently in the background
        try {
          if (targetRole === 'student') {
            const profileRes = await api.get('/student/profile');
            const profileData = profileRes.data.profile || profileRes.data;
            if (profileData) await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
          } else if (targetRole === 'employer' || targetRole === 'household') {
            const profileRes = await api.get('/user/profile');
            const profileData = profileRes.data.profile || profileRes.data;
            if (profileData) await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
          }
        } catch (profileErr: any) {
          console.log('Error fetching profile block:', profileErr.response?.data || profileErr.message);
        }

        // Show Success Modal that redirects upon button press
        showModal({
          title: 'Verified Successfully!',
          message: 'Your email has been successfully verified. Welcome to DiskarTech!',
          iconName: 'verified',
          iconColor: '#16a34a', // Green success icon
          iconBgColor: 'bg-green-50',
          primaryButtonText: 'Continue to Dashboard',
          onPrimaryPress: () => {
            setModalVisible(false);
            if (targetRole) {
              redirectUserByRole(targetRole);
            } else {
              router.replace('/auth/login' as any);
            }
          },
        });
      }
    } catch (error: any) {
      console.error('CATCH ERROR IN VERIFY OTP:', error.response?.data || error.message);
      showModal({
        title: 'Verification Failed',
        message: error.response?.data?.message || 'Invalid or expired OTP code. Please try again.',
        iconName: 'error-outline',
        iconColor: '#ef4444',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'Try Again',
        onPrimaryPress: () => {
          setModalVisible(false);
          setOtpValues(['', '', '', '', '', '']); // Optional: Clear boxes on error
          inputRefs.current[0]?.focus();
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{ backgroundColor: colors.background }}
      className="flex-1 justify-between p-8 pt-16 pb-12"
    >
      {/* Top Header Section */}
      <View className="items-center mt-6">
        <View
          style={{ backgroundColor: isDark ? colors.surface : '#FEF2F2' }}
          className="w-16 h-16 rounded-2xl items-center justify-center mb-6"
        >
          <MaterialIcons name="mark-email-unread" size={32} color={colors.accent} />
        </View>
        <Text style={{ color: colors.text }} className="text-2xl font-bold mb-2 text-center">Verify Your Email</Text>
        <Text style={{ color: colors.textSecondary }} className="text-center text-sm leading-relaxed px-4">
          Verify <Text style={{ color: colors.text }} className="font-semibold">{email}</Text> using a 6-digit code. Once the email arrives, enter it below to continue.
        </Text>
      </View>

      {/* 6 Individual OTP Boxes Container */}
      <View className="flex-row justify-between items-center px-2 my-8">
        {otpValues.map((value, index) => (
          <TextInput
            key={index}
            ref={(el: TextInput | null) => { inputRefs.current[index] = el; }}
            className="w-12 h-14 border-2 rounded-2xl text-center text-xl font-bold"
            style={{
              borderColor: value ? '#DC2626' : colors.border,
              backgroundColor: isDark ? colors.surface : (value ? '#FFFFFF' : '#F8FAFC'),
              color: colors.text,
            }}
            keyboardType="number-pad"
            maxLength={1}
            value={value}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            selectTextOnFocus
          />
        ))}
      </View>

      {/* Action Buttons Section */}
      <View className="gap-4">
        {/* Verify Button */}
        <TouchableOpacity
          onPress={() => handleVerifyOtp()}
          disabled={loading || otpValues.some((val) => !val)}
          className={`rounded-xl py-4 items-center shadow-md ${
            loading || otpValues.some((val) => !val) ? 'bg-red-300' : 'bg-red-600'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base tracking-wide">Verify Account</Text>
          )}
        </TouchableOpacity>

        {/* Resend OTP */}
        <View className="flex-row justify-center items-center mt-2">
          <Text style={{ color: colors.textSecondary }} className="text-xs">Didn&apos;t receive code? </Text>
          <TouchableOpacity onPress={sendOtpCode} disabled={sending || cooldownSeconds > 0}>
            <Text className="text-red-600 font-bold text-xs">
              {sending ? 'Sending...' : cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Back to Login */}
      <TouchableOpacity 
        onPress={() => router.replace('/auth/login' as any)}
        className="items-center mt-4"
      >
        <Text style={{ color: colors.textSecondary }} className="text-sm font-semibold">Back to Login</Text>
      </TouchableOpacity>

      {/* REUSABLE NOTIFICATION MODAL */}
      <NotificationModal 
        visible={modalVisible}
        title={modalConfig.title}
        message={modalConfig.message}
        iconName={modalConfig.iconName}
        iconColor={modalConfig.iconColor}
        iconBgColor={modalConfig.iconBgColor}
        primaryButtonText={modalConfig.primaryButtonText}
        onPrimaryPress={modalConfig.onPrimaryPress}
        secondaryButtonText={modalConfig.secondaryButtonText}
        onSecondaryPress={modalConfig.onSecondaryPress}
      />
    </View>
  );
}
