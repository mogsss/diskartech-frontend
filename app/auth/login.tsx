import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import api from '@/api/axios';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { redirectUserByRole } from '@/utils/authNavigation';
import { registerAndSyncPushToken } from '@/utils/notifications';
import { promptNativeGoogleSignIn } from '@/utils/googleAuth';
// I-import ang custom modal
import NotificationModal from '@/components/ui/modals/NotificationModal';

export default function LoginScreen() {
  const { isDark, colors } = useDarkMode();
  const { google, email: initialEmail } = useLocalSearchParams<{ google?: string; email?: string }>();
  const automaticGoogleLoginStarted = useRef(false);
  const [email, setEmail] = useState(typeof initialEmail === 'string' ? initialEmail : '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // States para sa ating Reusable Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        if (token && storedUser) {
          const user = JSON.parse(storedUser);
          const role =
            user.role ||
            (user.student_school_name
              ? 'student'
              : user.household_name
                ? 'household'
                : 'employer');
          redirectUserByRole(role);
        }
      } catch {
        /* ignore */
      }
    };
    checkAuth();
  }, []);

  const dismissKeyboard = () => Keyboard.dismiss();

  const showLoginRateLimit = useCallback((error: any): boolean => {
    if (error.response?.status !== 429) return false;
    const retryAfter = Number(error.response?.data?.retry_after ?? error.response?.headers?.['retry-after']);
    const seconds = Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 3600
      ? Math.ceil(retryAfter) : 60;
    setModalConfig({
      title: 'Please wait before signing in',
      message: `Too many sign-in attempts. Try again in ${seconds} seconds.`,
      iconName: 'schedule',
      iconColor: Colors.primary,
      iconBgColor: '#FEF2F2',
      primaryButtonText: 'OK',
      onPrimaryPress: () => setModalVisible(false),
      secondaryButtonText: undefined,
      onSecondaryPress: undefined,
    });
    setModalVisible(true);
    return true;
  }, []);

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
        await AsyncStorage.setItem('userData', JSON.stringify({ ...user, authentication_method: 'password' }));
        if (profile) {
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        }

        if (user?.id) {
          registerAndSyncPushToken(user.id);
        }

        setTimeout(() => {
          redirectUserByRole(role);
        }, 100);
      }
    } catch (error: any) {
      const responseData = error.response?.data;
      const status = error.response?.status;
      setEmailError('');
      setPasswordError('');

      if (showLoginRateLimit(error)) return;

      if (responseData) {
        // Kapag ang email ay hindi pa beripikado (Status 403)
        if (status === 403) {
          if (responseData.token) {
            await AsyncStorage.setItem('userToken', responseData.token);
          }
          if (responseData.user) {
            await AsyncStorage.setItem('userData', JSON.stringify({ ...responseData.user, authentication_method: 'password' }));
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

  const handleGoogleLogin = useCallback(async () => {
    try {
      setGoogleLoading(true);
      const profile = await promptNativeGoogleSignIn({ selectAccount: true });
      if (!profile?.email) {
        setGoogleLoading(false);
        return;
      }

      const response = await api.post('/google-login', {
        email: profile.email,
      });

      if (response.data.status === 'success') {
        const { role } = response.data.user;
        const { user, profile: userProfile, token } = response.data;

        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('userData', JSON.stringify({ ...user, authentication_method: 'google' }));
        if (userProfile) {
          await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
        }

        if (user?.id) {
          registerAndSyncPushToken(user.id);
        }

        setTimeout(() => {
          redirectUserByRole(role);
        }, 100);
      }
    } catch (error: any) {
      const responseData = error.response?.data;
      const status = error.response?.status;

      if (showLoginRateLimit(error)) return;

      if (status === 403) {
        const token = responseData?.token;
        const user = responseData?.user;
        if (token) await AsyncStorage.setItem('userToken', token);
        if (user) await AsyncStorage.setItem('userData', JSON.stringify({ ...user, authentication_method: 'google' }));

        setModalConfig({
          title: 'Email Verification Required',
          message: 'Just one more step! Enter the 6-digit verification code sent to your email to continue.',
          iconName: 'mark-email-unread',
          iconColor: Colors.primary,
          iconBgColor: '#FEF2F2',
          primaryButtonText: 'I-verify ang Email',
          onPrimaryPress: () => {
            setModalVisible(false);
            router.push({
              pathname: '/auth/verify-email',
              params: { email: user?.email, role: user?.role },
            });
          },
          secondaryButtonText: 'I-cancel',
          onSecondaryPress: () => setModalVisible(false),
        });
        setModalVisible(true);
      } else if (status === 404 || responseData?.status === 'not_registered') {
        setModalConfig({
          title: 'Account Not Found',
          message: 'Wala pang DiskarTech account na naka-link sa Google email na ito. Gusto mo bang mag-register muna?',
          iconName: 'person-add',
          iconColor: Colors.primary,
          iconBgColor: '#FEF2F2',
          primaryButtonText: 'Register as Student',
          onPrimaryPress: () => {
            setModalVisible(false);
            router.push('/auth/student-register');
          },
          secondaryButtonText: 'I-cancel',
          onSecondaryPress: () => setModalVisible(false),
        });
        setModalVisible(true);
      } else {
        const errorMsg = responseData?.message || error.message || 'Hindi nakapasok gamit ang Google.';
        setModalConfig({
          title: 'Google Login Failed',
          message: errorMsg,
          iconName: 'error',
          iconColor: '#DC2626',
          iconBgColor: '#FEF2F2',
          primaryButtonText: 'Subukan Muli',
          onPrimaryPress: () => setModalVisible(false),
          secondaryButtonText: undefined,
          onSecondaryPress: undefined,
        });
        setModalVisible(true);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [showLoginRateLimit]);

  React.useEffect(() => {
    if (google !== '1' || automaticGoogleLoginStarted.current) return;
    automaticGoogleLoginStarted.current = true;
    void handleGoogleLogin();
  }, [google, handleGoogleLogin]);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
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
              style={{ backgroundColor: isDark ? colors.surface : '#F1F5F9' }}
              className="w-10 h-10 rounded-full items-center justify-center mb-6"
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            {/* Logo */}
            <View className="flex-row items-center gap-3 mb-6">
              <View className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-red-100 items-center justify-center overflow-hidden">
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={{ width: 44, height: 44, borderRadius: 10 }}
                  resizeMode="cover"
                />
              </View>
              <Text className="text-[28px] font-extrabold text-red-600">DiskarTech</Text>
            </View>

            <Text style={{ color: colors.text }} className="text-2xl font-bold mb-1">Welcome Back!</Text>
            <Text style={{ color: colors.textSecondary }} className="text-base mb-6">Login to your account</Text>

            {/* Form */}
            <View className="gap-2">
              <InputField
                label="Email"
                placeholder="juandelacruz@gmail.com"
                value={email}
                onChangeText={(text) => { setEmail(text); setEmailError(''); }}
                error={emailError}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="email"
              />

              <InputField
                label="Password"
                placeholder="********"
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
                      borderColor: isDark ? colors.border : Colors.gray400,
                      ...(rememberMe ? { backgroundColor: Colors.primary, borderColor: Colors.primary } : {})
                    }}
                    className="w-5 h-5 rounded-[4px] border-2 items-center justify-center"
                  >
                    {rememberMe && <MaterialIcons name="check" size={14} color={Colors.white} />}
                  </View>
                  <Text style={{ color: colors.textSecondary }} className="text-sm">Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/auth/forgot-password')} disabled={loading || googleLoading} accessibilityRole="button" accessibilityLabel="Forgot password">
                  <Text className="text-sm text-red-600 font-semibold">Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <PrimaryButton
                title={loading ? "Logging In" : "Login"}
                onPress={handleLogin}
                size="large"
                style={{ marginTop: 16 }}
                disabled={loading || googleLoading}
              />

              <View className="flex-row items-center gap-4 my-3">
                <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
                <Text className="text-sm" style={{ color: colors.textSecondary }}>or</Text>
                <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} accessible={false} />
              </View>

              {/* Google Login */}
              <TouchableOpacity
                onPress={handleGoogleLogin}
                disabled={googleLoading || loading}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                accessibilityState={{ disabled: googleLoading || loading, busy: googleLoading }}
                activeOpacity={0.85}
                style={{
                  backgroundColor: isDark ? colors.surface : '#FFFFFF',
                  borderColor: isDark ? colors.border : '#E2E8F0',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.2 : 0.06,
                  shadowRadius: 6,
                  elevation: 2,
                }}
                className="flex-row items-center justify-center gap-2.5 border rounded-2xl py-[14px]"
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#EA4335" />
                ) : (
                  <>
                    <Image
                      source={require('../../assets/images/google-g.png')}
                      style={{ width: 20, height: 20 }}
                      resizeMode="contain"
                      accessible={false}
                    />
                    <Text style={{ color: colors.text }} className="text-base font-bold">
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={{ color: colors.textSecondary }} className="text-base text-center mt-6">
                Don&apos;t have an account?{' '}
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
