import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ApplyJobScreen() {
  const { id } = useLocalSearchParams();
  const [resume, setResume] = useState('uploaded_resume.pdf');
  const [coverLetter, setCoverLetter] = useState('');
  const [availability, setAvailability] = useState('');

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="p-6 pt-12 pb-10" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-6">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-900">Apply for Job</Text>
        </View>

        <View 
          style={{ backgroundColor: Colors.primary + '08', borderColor: Colors.primary + '20' }}
          className="flex-row items-center rounded-2xl p-4 mb-4 border-[1.5px] border-dashed"
        >
          <MaterialIcons name="description" size={24} color={Colors.primary} />
          <View className="flex-1 ml-4">
            <Text className="text-xs text-slate-500">Resume</Text>
            <Text className="text-sm font-semibold text-slate-900 mt-[2px]">{resume}</Text>
          </View>
          <TouchableOpacity className="px-4 py-2">
            <Text className="text-sm text-blue-600 font-semibold">Change</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-4">
          <Text className="text-lg font-bold text-slate-900 mb-2">Cover Letter</Text>
          <TextInput
            className="border-[1.5px] border-gray-200 rounded-xl p-4 bg-white text-base text-slate-900 min-h-[120px]"
            placeholder="Write a brief cover letter explaining why you're a good fit..."
            placeholderTextColor={Colors.gray400}
            value={coverLetter}
            onChangeText={setCoverLetter}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View className="mb-4">
          <Text className="text-lg font-bold text-slate-900 mb-2">Availability</Text>
          <InputField
            placeholder="e.g. Weekdays after 3PM, Weekends full day"
            value={availability}
            onChangeText={setAvailability}
            icon="schedule"
          />
        </View>

        <View className="flex-row items-start gap-2 mb-4">
          <MaterialIcons name="info-outline" size={20} color={Colors.textSecondary} />
          <Text className="text-xs text-slate-500 flex-1 leading-5">By submitting, you confirm that all information provided is accurate and you agree to our terms.</Text>
        </View>

        <PrimaryButton 
          title="Submit Application" 
          onPress={() => router.back()} 
          size="large" 
          icon={<MaterialIcons name="send" size={20} color={Colors.white} />} 
          style={{ marginTop: 16 }} 
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}