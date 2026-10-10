import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, Text, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const loadingWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let targetRoute: string = '/onboarding';

    // Suriin agad ang saved session habang tumatakbo ang splash animation
    const checkAuthSession = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        const hasSeenOnboarding = await AsyncStorage.getItem('has_seen_onboarding');

        if (token && storedUser) {
          const user = JSON.parse(storedUser);
          const role =
            user.role ||
            (user.student_school_name
              ? 'student'
              : user.household_name
              ? 'household'
              : 'employer');

          if (role === 'student') {
            targetRoute = '/students/(tabs)/home';
          } else if (role === 'household') {
            targetRoute = '/employer/(tabs)/dashboard?type=household';
          } else {
            targetRoute = '/employer/(tabs)/dashboard?type=business';
          }
        } else if (hasSeenOnboarding === 'true') {
          targetRoute = '/auth/welcome';
        } else {
          targetRoute = '/onboarding';
        }
      } catch (e) {
        targetRoute = '/onboarding';
      }
    };

    checkAuthSession();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: false,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: false,
      }),
      Animated.timing(loadingWidth, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setTimeout(() => {
        router.replace(targetRoute as any);
      }, 200);
    });
  }, []);

  return (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="flex-1 items-center justify-center"
    >
      <Animated.View
        className="items-center mb-6"
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }}
      >
        <View className="w-[110px] h-[110px] rounded-3xl bg-white items-center justify-center mb-5 border-2 border-white/40 overflow-hidden shadow-2xl shadow-black/30">
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 100, height: 100, borderRadius: 24 }}
            resizeMode="cover"
          />
        </View>
        <Text className="text-[42px] font-extrabold text-white tracking-[1px]">DiskarTech</Text>
      </Animated.View>

      <Animated.Text 
        className="text-white/90 text-center px-10 text-xl font-normal"
        style={{ opacity: taglineOpacity }}
      >
        Smart Job-Matching Platform for Smart Students
      </Animated.Text>

      <View className="absolute bottom-[100px] left-10 right-10 items-center">
        <View className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
          <Animated.View
            className="h-full bg-white rounded-full"
            style={{
              width: loadingWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }}
          />
        </View>
      </View>
    </LinearGradient>
  );
}