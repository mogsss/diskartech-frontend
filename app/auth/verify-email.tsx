import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { redirectUserByRole } from '@/utils/authNavigation';
import { MaterialIcons } from '@expo/vector-icons';
import NotificationModal from '@/components/ui/modals/NotificationModal';

export default function VerifyEmailScreen() {
  const { email, role: paramRole } = useLocalSearchParams<{ email: string; role?: string }>();
  const router = useRouter();
  
  // State para sa 6 na individual digits
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // States para sa ating Reusable Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  // Helper para madaling magpakita ng modal
  const showModal = (config: any) => {
    setModalConfig(config);
    setModalVisible(true);
  };

  useEffect(() => {
    checkTokenAndSendOtp();
  }, []);

  const checkTokenAndSendOtp = async (retries = 3) => {
    try {
      setSending(true);
      let token = await AsyncStorage.getItem('userToken');

      if (!token && retries > 0) {
        console.log(`Token not found yet, retrying... (${retries} left)`);
        setTimeout(() => checkTokenAndSendOtp(retries - 1), 500);
        return;
      }

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

      const response = await api.post('/email/send-otp');
      showModal({
        title: 'OTP Sent',
        message: response.data.message || 'Verification code has been sent to your email address.',
        iconName: 'mark-email-read',
        iconColor: '#16a34a', // Green
        iconBgColor: 'bg-green-50',
        primaryButtonText: 'Got it',
        onPrimaryPress: () => setModalVisible(false),
      });
    } catch (error: any) {
      console.error('Error sending OTP:', error.response?.data || error.message);
      showModal({
        title: 'Sending Failed',
        message: error.response?.data?.message || 'Failed to send OTP. Please check your connection.',
        iconName: 'error-outline',
        iconColor: '#ef4444',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: () => setModalVisible(false),
      });
    } finally {
      setSending(false);
    }
  };

  const sendOtpCode = async () => {
    try {
      setSending(true);
      const response = await api.post('/email/send-otp');
      showModal({
        title: 'OTP Resent',
        message: response.data.message || 'A new verification code has been sent to your email.',
        iconName: 'mark-email-read',
        iconColor: '#16a34a',
        iconBgColor: 'bg-green-50',
        primaryButtonText: 'OK',
        onPrimaryPress: () => setModalVisible(false),
      });
    } catch (error: any) {
      console.error(error);
      showModal({
        title: 'Resend Failed',
        message: error.response?.data?.message || 'Failed to resend OTP. Please try again.',
        iconName: 'error-outline',
        iconColor: '#ef4444',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: () => setModalVisible(false),
      });
    } finally {
      setSending(false);
    }
  };

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
    <View className="flex-1 justify-between p-8 bg-white pt-16 pb-12">
      {/* Top Header Section */}
      <View className="items-center mt-6">
        <View className="w-16 h-16 bg-red-50 rounded-2xl items-center justify-center mb-6">
          <MaterialIcons name="mark-email-unread" size={32} color="#DC2626" />
        </View>
        <Text className="text-2xl font-bold text-slate-900 mb-2 text-center">Verify Your Email</Text>
        <Text className="text-center text-slate-500 text-sm leading-relaxed px-4">
          We’ve sent a secure 6-digit verification code to <Text className="font-semibold text-slate-800">{email}</Text>. Enter the code below to continue.
        </Text>
      </View>

      {/* 6 Individual OTP Boxes Container */}
      <View className="flex-row justify-between items-center px-2 my-8">
        {otpValues.map((value, index) => (
          <TextInput
            key={index}
            ref={(el: TextInput | null) => { inputRefs.current[index] = el; }}
            className="w-12 h-14 border-2 rounded-2xl text-center text-xl font-bold text-slate-900"
            style={{
              borderColor: value ? '#DC2626' : '#E2E8F0',
              backgroundColor: value ? '#FFFFFF' : '#F8FAFC',
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
          <Text className="text-slate-400 text-xs">Didn't receive code? </Text>
          <TouchableOpacity onPress={sendOtpCode} disabled={sending}>
            <Text className="text-red-600 font-bold text-xs">
              {sending ? 'Sending...' : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Back to Login */}
      <TouchableOpacity 
        onPress={() => router.replace('/auth/login' as any)}
        className="items-center mt-4"
      >
        <Text className="text-sm font-semibold text-slate-400">Back to Login</Text>
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