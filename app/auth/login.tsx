import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import api from '@/api/axios'; 
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { redirectUserByRole } from '@/utils/authNavigation';
// I-import ang custom modal
import NotificationModal from '@/components/ui/modals/NotificationModal';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // States para sa ating Reusable Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  const dismissKeyboard = () => Keyboard.dismiss();

  const handleLogin = async () => {
    dismissKeyboard();
    setLoading(true);

    try {
      const response = await api.post('/login', {
        email: email,
        password: password,
        rememberme: rememberMe,
      });

      if (response.data.status === 'success') {
        const { role } = response.data.user;
        const { user, profile, token } = response.data;

        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        if (profile) {
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        }

        setTimeout(() => {
          redirectUserByRole(role);
        }, 100);
      }
    } catch (error: any) {
      console.error(error);
      const responseData = error.response?.data;
      const status = error.response?.status;
      setEmailError('');
      setPasswordError('');

      if (responseData) {
        // Kapag ang email ay hindi pa beripikado (Status 403)
        if (status === 403) {
          if (responseData.token) {
            await AsyncStorage.setItem('userToken', responseData.token);
          }
          if (responseData.user) {
            await AsyncStorage.setItem('userData', JSON.stringify(responseData.user));
          }

          // Gagamitin na natin ang custom modal sa halip na Alert
          setModalConfig({
            title: 'Email Not Verified',
            message: responseData.message || 'Please verify your email to continue.',
            iconName: 'mark-email-unread',
            iconColor: '#DC2626',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'Verify Email Now',
            onPrimaryPress: () => {
              setModalVisible(false);
              router.push({
                pathname: '/auth/verify-email',
                params: { email: email }
              });
            },
            secondaryButtonText: 'Cancel',
            onSecondaryPress: () => setModalVisible(false),
          });
          setModalVisible(true);
          return;
        }

        // Validation Errors
        if (responseData.errors) {
          if (responseData.errors.email) {
            setEmailError(responseData.errors.email[0]);
          }
          if (responseData.errors.password) {
            setPasswordError(responseData.errors.password[0]);
          }
        }
        else if (status === 404 || responseData.message?.toLowerCase().includes('email') || responseData.message?.toLowerCase().includes('exist')) {
          setEmailError(responseData.message);
        }
        else if (status === 401 || responseData.message?.toLowerCase().includes('password')) {
          setPasswordError(responseData.message);
        }
        else {
          // Custom Modal para sa general login failure
          setModalConfig({
            title: 'Login Failed',
            message: responseData.message || 'Invalid credentials.',
            iconName: 'error-outline',
            iconColor: '#ef4444',
            iconBgColor: 'bg-red-50',
            primaryButtonText: 'Try Again',
            onPrimaryPress: () => setModalVisible(false),
            secondaryButtonText: undefined,
            onSecondaryPress: undefined,
          });
          setModalVisible(true);
        }
      } else {
        // Custom Modal para sa connection error
        setModalConfig({
          title: 'Connection Error',
          message: 'Cannot connect to the server. Please try again.',
          iconName: 'wifi-off',
          iconColor: '#64748b',
          iconBgColor: 'bg-slate-100',
          primaryButtonText: 'OK',
          onPrimaryPress: () => setModalVisible(false),
          secondaryButtonText: undefined,
          onSecondaryPress: undefined,
        });
        setModalVisible(true);
      }
    } finally {
      setLoading(false); 
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-6 pt-12 pb-10"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mb-6"
            >
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>

            {/* Logo */}
            <View className="flex-row items-center gap-3 mb-6">
              <View
                style={{ backgroundColor: Colors.primary + '15' }}
                className="w-12 h-12 rounded-full items-center justify-center"
              >
                <MaterialIcons name="work" size={36} color={Colors.primary} />
              </View>
              <Text className="text-[28px] font-extrabold text-red-600">DiskarTech</Text>
            </View>

            <Text className="text-2xl font-bold text-slate-900 mb-1">Welcome Back!</Text>
            <Text className="text-base text-slate-500 mb-6">Login to your account</Text>

            {/* Form */}
            <View className="gap-2">
              <InputField
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={(text) => { setEmail(text); setEmailError(''); }} 
                error={emailError}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="email"
              />

              <InputField
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(text) => { setPassword(text); setPasswordError(''); }} 
                error={passwordError}
                isPassword
                icon="lock"
              />

              {/* Remember me & Forgot password */}
              <View className="flex-row justify-between items-center mt-2">
                <TouchableOpacity
                  className="flex-row items-center gap-2"
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View
                    style={{
                      borderColor: Colors.gray400,
                      ...(rememberMe ? { backgroundColor: Colors.primary, borderColor: Colors.primary } : {})
                    }}
                    className="w-5 h-5 rounded-[4px] border-2 items-center justify-center"
                  >
                    {rememberMe && <MaterialIcons name="check" size={14} color={Colors.white} />}
                  </View>
                  <Text className="text-sm text-slate-500">Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text className="text-sm text-red-600 font-semibold">Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <PrimaryButton
                title={loading ? "Logging In" : "Login"}
                onPress={handleLogin}
                size="large"
                style={{ marginTop: 16 }}
                disabled={loading}
              />

              {/* Google Login */}
              <TouchableOpacity
                style={{ borderColor: Colors.border }}
                className="flex-row items-center justify-center gap-2 bg-white border-[1.5px] rounded-2xl py-[14px] mt-4"
              >
                <MaterialIcons name="android" size={22} color={Colors.text} />
                <Text className="text-base font-semibold text-slate-900">Continue with Google</Text>
              </TouchableOpacity>

              <Text className="text-base text-slate-500 text-center mt-6">
                Don't have an account?{' '}
                <Text
                  className="text-red-600 font-semibold"
                  onPress={() => router.push('/auth/student-register')}
                >
                  Register
                </Text>
              </Text>
            </View>
          </ScrollView>

          {/* DITO NATIN INILAGAY ANG REUSABLE MODAL */}
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
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}