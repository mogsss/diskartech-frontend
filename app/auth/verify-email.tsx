import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { redirectUserByRole } from '@/utils/authNavigation';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams();
  const router = useRouter();
  
  // State para sa 6 na individual digits
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Auto-send OTP kapag binuksan ang screen (May kasamang retry para hindi maunahan ng AsyncStorage write)
  useEffect(() => {
    checkTokenAndSendOtp();
  }, []);

  const checkTokenAndSendOtp = async (retries = 3) => {
    try {
      setSending(true);
      let token = await AsyncStorage.getItem('userToken');

      // Kung wala pang nahanap na token, bigyan ng konting segundo ang AsyncStorage na tapusin ang pagsulat
      if (!token && retries > 0) {
        console.log(`Token not found yet, retrying... (${retries} left)`);
        setTimeout(() => checkTokenAndSendOtp(retries - 1), 500);
        return;
      }

      if (!token) {
        Alert.alert('Error', 'Session expired. Please log in again.');
        router.replace('/auth/login' as any);
        return;
      }

      const response = await api.post('/email/send-otp');
      Alert.alert('Success', response.data.message || 'OTP has been sent to your email address.');
    } catch (error: any) {
      console.error('Error sending OTP:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setSending(false);
    }
  };

  const sendOtpCode = async () => {
    try {
      setSending(true);
      const response = await api.post('/email/send-otp');
      Alert.alert('Success', response.data.message || 'OTP has been sent to your email address.');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setSending(false);
    }
  };

  // Handler para sa pag-type sa bawat box (May kasamang Auto-Submit)
  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otpValues];
    newOtp[index] = text;
    setOtpValues(newOtp);

    // Auto-focus sa susunod na input kapag may inilagay
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit kapag napuno na ang 6 na kahon
    if (index === 5 && text) {
      Keyboard.dismiss();
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 6) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  // Handler para sa pag-backspace
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (overrideOtp?: string) => {
    const otpCode = overrideOtp || otpValues.join('');
    
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a complete 6-digit OTP code.');
      return;
    }

    try {
      setLoading(true);
      console.log('Sending request to /email/verify-otp with code:', otpCode);

      const response = await api.post('/email/verify-otp', { otp_code: otpCode });
      console.log('Verify OTP Response Received:', response.data);

      if (response.data.status === 'success') {
        Alert.alert('Success!', 'Your email has been successfully verified.');
        
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          user.isEmailVerified = true;
          await AsyncStorage.setItem('userData', JSON.stringify(user));

          try {
            if (user.role === 'student') {
              const profileRes = await api.get('/student/profile');
              const profileData = profileRes.data.profile || profileRes.data;
              if (profileData) {
                await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
              }
            } else if (user.role === 'employer' || user.role === 'household') {
              const profileRes = await api.get('/user/profile');
              const profileData = profileRes.data.profile || profileRes.data;
              if (profileData) {
                await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
              }
            }
          } catch (profileErr: any) {
            console.log('Error fetching profile block:', profileErr.response?.data || profileErr.message);
          }

          setTimeout(() => {
            redirectUserByRole(user.role);
          }, 100);
        } else {
          router.replace('/auth/login' as any);
        }
      }
    } catch (error: any) {
      console.error('CATCH ERROR IN VERIFY OTP:', error.response?.data || error.message);
      Alert.alert('Verification Failed', error.response?.data?.message || 'Invalid or expired OTP code.');
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

      {/* 6 Individual OTP Boxes Container (Ligtas sa CssInterop warning) */}
      <View className="flex-row justify-between items-center px-2 my-8">
        {otpValues.map((value, index) => (
          <TextInput
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
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
    </View>
  );
}