import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const loadingWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(loadingWidth, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setTimeout(() => {
        router.replace('/onboarding');
      }, 300);
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
        <View className="w-[120px] h-[120px] rounded-[60px] bg-white/20 items-center justify-center mb-4 border-[3px] border-white/30">
          <MaterialIcons name="work" size={60} color={Colors.white} />
        </View>
        <Text className="text-[42px] font-extrabold text-white tracking-[1px]">DiskarTech</Text>
      </Animated.View>

      <Animated.Text 
        className="text-white/90 italic text-center px-10 text-lg font-normal"
        style={{ opacity: taglineOpacity }}
      >
        "Smart Jobs for Smart Students"
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