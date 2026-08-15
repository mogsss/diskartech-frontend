import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const dismissKeyboard = () => Keyboard.dismiss();

  const handleLogin = async () => {
    dismissKeyboard();

    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      // Tawagin ang Laravel login API endpoint
      const response = await axios.post('http://192.168.1.2:8000/api/login', {
        email: email,
        password: password,
      });

      if (response.data.status === 'success') {
        const { role } = response.data.user;

        Alert.alert('Success', 'Login successful!');

        // Automatic na i-redirect base sa role na nakuha mula sa database
        if (role === 'student') {
          router.replace('/students/(tabs)/home');
        } else if (role === 'employer') {
          router.replace('/employer/(tabs)/dashboard?type=business');
        } else if (role === 'household') {
          router.replace('/employer/(tabs)/dashboard?type=household');
        }
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.message || 'Invalid credentials or connection error.';
      Alert.alert('Login Failed', errorMsg);
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
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="email"
            />
            <InputField
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
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
              title={loading ? "Loading..." : "Login"}
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
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}