import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-surface">
      <View className="absolute top-[-120px] left-[-100px] w-[260px] h-[260px] rounded-full bg-primary/10" />
      <View className="absolute top-[60px] right-[-70px] w-[160px] h-[160px] rounded-full bg-primary/[0.05]" />

      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient
          colors={['#D32F2F', '#B71C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="items-center pt-20 pb-12 rounded-b-3xl"
        >
          <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center mb-4 border-2 border-white/30">
            <MaterialIcons name="work" size={48} color="#FFFFFF" />
          </View>
          <Text className="text-white text-4xl font-extrabold tracking-wider">DiskarTech</Text>
          <Text className="text-white/90 text-base italic mt-1 text-center max-w-[88%]">
            Smart Jobs for Smart Students
          </Text>
        </LinearGradient>

        <View className="flex-1 mx-1 -mt-6 p-5 pt-8 bg-white rounded-3xl shadow-lg shadow-black/10">
          <Text className="text-2xl font-bold text-gray-900 mb-1">Welcome!</Text>
          <Text className="text-base text-gray-500 mb-6 leading-6">
            Find the perfect part-time job that fits your student life.
          </Text>

          <View className="bg-gray-100 rounded-2xl p-4 mb-6 gap-2">
            <FeatureItem icon="schedule" title="Flexible Hours" subtitle="Work around your class schedule" />
            <FeatureItem icon="verified" title="Verified Employers" subtitle="Trusted local businesses" />
            <FeatureItem icon="school" title="Student-Friendly" subtitle="Jobs designed for students" />
            <FeatureItem icon="location-on" title="Nearby Jobs" subtitle="Find work close to you" />
          </View>

          <View className="gap-3">
            <PrimaryButton
              title="Student Login"
              onPress={() => router.push('/auth/login?type=student')}
              size="large"
              icon={<MaterialIcons name="school" size={20} color={Colors.white} />}
            />
            <View className="flex-row items-center gap-4 my-1">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-sm text-gray-400">or</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>
            <PrimaryButton
              title="Employer Login"
              onPress={() => router.push('/auth/login?type=employer')}
              variant="secondary"
              size="large"
              icon={<MaterialIcons name="business" size={20} color={Colors.primary} />}
            />
            <Text className="text-base text-gray-500 text-center mt-6">
              Don&apos;t have an account?{' '}
              <Text
                className="text-primary font-semibold"
                onPress={() => router.push('/auth/student-register')}
              >
                Register
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View className="flex-row items-center gap-4 bg-white rounded-xl p-4 shadow-sm shadow-black/5">
      <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
        <MaterialIcons name={icon} size={24} color={Colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900">{title}</Text>
        <Text className="text-sm text-gray-500 mt-0.5">{subtitle}</Text>
      </View>
    </View>
  );
}

