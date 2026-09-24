import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { redirectUserByRole } from '@/utils/authNavigation';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams();
  const router = useRouter();
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Auto-send OTP kapag binuksan ang screen na ito
  useEffect(() => {
    sendOtpCode();
  }, []);

  const sendOtpCode = async () => {
    try {
      setSending(true);

      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Error', 'Session expired. Please log in again.');
        router.replace('/auth/login' as any);
        return;
      }

      const response = await api.post('/email/send-otp');
      Alert.alert('Success', response.data.message || 'OTP has been sent to your email address.');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP code.');
      return;
    }

    try {
      setLoading(true);

      const response = await api.post('/email/verify-otp', { otp_code: otpCode });

      if (response.data.status === 'success') {
        Alert.alert('Success!', 'Your email has been successfully verified.');
        
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          
          user.isEmailVerified = true;
          await AsyncStorage.setItem('userData', JSON.stringify(user));

          // Gamitin na ang redirectUserByRole para maging pareho sila ng LoginScreen
          setTimeout(() => {
            redirectUserByRole(user.role);
          }, 100);
        } else {
          router.replace('/auth/login' as any);
        }
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Verification Failed', error.response?.data?.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center items-center p-6 bg-white">
      <Text className="text-2xl font-bold text-slate-900 mb-2">Verify Your Email</Text>
      <Text className="text-center text-slate-600 mb-6">
        We have sent a 6-digit verification code to <Text className="font-semibold text-slate-900">{email}</Text>. Please enter the code below.
      </Text>

      {/* 6-Digit OTP Input Box */}
      <TextInput
        className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-slate-900 mb-4"
        placeholder="123456"
        placeholderTextColor="#94a3b8"
        keyboardType="number-pad"
        maxLength={6}
        value={otpCode}
        onChangeText={setOtpCode}
      />

      {/* Verify OTP Button */}
      <TouchableOpacity
        onPress={handleVerifyOtp}
        disabled={loading}
        className="bg-red-600 rounded-xl py-3 px-6 w-full items-center mb-4"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold text-base">Verify OTP</Text>
        )}
      </TouchableOpacity>

      {/* Resend OTP Button */}
      <TouchableOpacity onPress={sendOtpCode} disabled={sending} className="mb-4">
        <Text className="text-red-600 font-semibold text-sm">
          {sending ? 'Sending Code...' : "Didn't receive code? Resend OTP"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/auth/login' as any)}>
        <Text className="text-sm font-semibold text-slate-500">Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}