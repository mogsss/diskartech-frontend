import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function ApplicantDetailsScreen() {
  const { name, position } = useLocalSearchParams();

  const applicantName = (name as string) || 'Junnyl Mabini';
  const applicantPosition = (position as string) || 'Service Crew';

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        <View className="flex-row items-center mb-4 pt-4">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-900">Applicant Details</Text>
        </View>

        <View className="bg-white rounded-2xl p-6 items-center shadow-md mb-4">
          <Avatar uri="" name={applicantName} size={80} />
          <Text className="text-xl font-bold text-slate-900 mt-4">{applicantName}</Text>
          <Text className="text-sm text-slate-500 mt-1 mb-3">{applicantPosition} Applicant</Text>
          <Badge text="Pending Review" variant="warning" />
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-4">School Information</Text>
          <View className="flex-row items-start gap-4 mb-4">
            <MaterialIcons name="school" size={20} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">University of Santo Tomas</Text>
              <Text className="text-sm text-slate-500 mt-0.5">BS Information Technology</Text>
            </View>
          </View>
          <View className="flex-row items-start gap-2 mb-2">
            <MaterialIcons name="star" size={20} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Year Level</Text>
              <Text className="text-sm text-slate-500 mt-0.5">3rd Year</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-4">Skills</Text>
          <View className="flex-row flex-wrap gap-2">
            {['Customer Service', 'Communication', 'Teamwork', 'Time Management', 'Adaptability'].map((skill) => (
              <View key={skill} style={{ backgroundColor: Colors.primary + '10' }} className="px-4 py-2 rounded-full">
                <Text className="text-sm font-medium text-red-600">{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-4">Availability</Text>
          <View className="flex-row items-start gap-4">
            <MaterialIcons name="schedule" size={20} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Available Schedule</Text>
              <Text className="text-sm text-slate-500 mt-0.5">Weekdays (After 3PM), Weekends (Full Day)</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <View className="flex-row items-center gap-4">
            <MaterialIcons name="description" size={24} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Resume</Text>
              <Text className="text-sm text-slate-500 mt-0.5">{applicantName.replace(/\s+/g, '_')}_Resume.pdf</Text>
            </View>
            <MaterialIcons name="download" size={20} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        <View className="mt-2">
          <PrimaryButton
            title="Accept Application"
            onPress={() => {}}
            variant="primary"
            size="medium"
            style={{ marginBottom: 8 }}
            icon={<MaterialIcons name="check-circle" size={20} color={Colors.white} />}
          />
          {/* Ginamitan natin ng explicit width at percentage para hindi mag-collapse */}
          <View className="flex-row justify-between">
            <View style={{ width: '48%' }}>
              <PrimaryButton
                title="Reject"
                onPress={() => {}}
                variant="outline"
                size="medium"
              />
            </View>
            <View style={{ width: '48%' }}>
              <PrimaryButton
                title="Message"
                onPress={() => router.push('/chat')}
                variant="secondary"
                size="medium"
                icon={<MaterialIcons name="message" size={18} color={Colors.primary} />}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}