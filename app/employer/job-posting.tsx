import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const SCHEDULE_OPTIONS = ['Flexible', 'Weekdays', 'Weekends', 'Morning Shift', 'Night Shift'];

export default function JobPostingScreen() {
  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [salary, setSalary] = useState('');
  
  // Schedule state (mga napiling schedules)
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>(['Flexible']);
  
  const [requirementInput, setRequirementInput] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);
  
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  // Toggle schedule selection
  const handleToggleSchedule = (option: string) => {
    if (selectedSchedules.includes(option)) {
      // Huwag payagang tanggalin kung iisa na lang ang natitira
      if (selectedSchedules.length > 1) {
        setSelectedSchedules(selectedSchedules.filter((item) => item !== option));
      }
    } else {
      setSelectedSchedules([...selectedSchedules, option]);
    }
  };

  // Salary input handler para siguradong numbers lang
  const handleSalaryChange = (text: string) => {
    // Tinatanggal ang lahat maliban sa mga numero at decimal point kung kailangan
    const numericOnly = text.replace(/[^0-9]/g, '');
    setSalary(numericOnly);
  };

  const handleAddRequirement = () => {
    if (requirementInput.trim() && !requirements.includes(requirementInput.trim())) {
      setRequirements([...requirements, requirementInput.trim()]);
      setRequirementInput('');
    }
  };

  const handleRemoveRequirement = (indexToRemove: number) => {
    setRequirements(requirements.filter((_, index) => index !== indexToRemove));
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (indexToRemove: number) => {
    setSkills(skills.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!jobTitle || !description || !salary) {
      Alert.alert('Incomplete Details', 'Please fill in all the required fields (Job Title, Description, and Salary).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://192.168.1.2:8000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          title: jobTitle,
          description: description,
          salary: salary,
          schedules: selectedSchedules,
          requirements: requirements,
          skills: skills,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Your job has been successfully posted!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', data.message || 'Something went wrong.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <ScrollView
          contentContainerClassName="p-6 pt-12 pb-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row items-center mb-1">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-slate-900">Post a New Job</Text>
          </View>
          <Text className="text-base text-slate-500 mb-6">Fill in the details to attract the best student applicants</Text>

          <InputField 
            label="Job Title *" 
            placeholder="e.g. Service Crew, Barista" 
            value={jobTitle} 
            onChangeText={setJobTitle} 
            icon="work" 
          />
          
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Job Description *</Text>
            <TextInput
              className="border-[1.5px] border-gray-200 rounded-xl p-4 bg-white text-base text-slate-900 min-h-[100px]"
              placeholder="Describe the job responsibilities and expectations..."
              placeholderTextColor={Colors.gray400}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Salary Range (Numbers only) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Rate  / Rate per day (₱) *</Text>
            <View className="flex-row items-center border-[1.5px] border-gray-200 rounded-xl px-4 bg-white">
              <MaterialIcons name="attach-money" size={20} color={Colors.gray400} style={{ marginRight: 8 }} />
              <TextInput
                className="flex-1 py-4 text-base text-slate-900"
                placeholder="e.g. 85"
                placeholderTextColor={Colors.gray400}
                value={salary}
                onChangeText={handleSalaryChange}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Schedule Selection Chips */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Schedule Options</Text>
            <View className="flex-row flex-wrap gap-2">
              {SCHEDULE_OPTIONS.map((option) => {
                const isSelected = selectedSchedules.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => handleToggleSchedule(option)}
                    className={`px-4 py-2 rounded-full border ${
                      isSelected 
                        ? 'bg-red-600 border-red-600' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Instructional Text */}
          <Text className="text-sm font-bold text-slate-800 mt-2 mb-4">List the skills and requirements needed</Text>

          {/* Requirements with Chip style */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Requirements</Text>
            <View className="flex-row items-center gap-2 mb-2">
              <TextInput
                className="flex-1 border-[1.5px] border-gray-200 rounded-xl px-4 py-3 bg-white text-sm text-slate-900"
                placeholder="Type requirement and click Add..."
                placeholderTextColor={Colors.gray400}
                value={requirementInput}
                onChangeText={setRequirementInput}
              />
              <TouchableOpacity 
                onPress={handleAddRequirement}
                className="bg-red-600 px-5 py-3 rounded-xl items-center justify-center shadow-sm"
              >
                <Text className="text-sm font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2 mt-1">
              {requirements.map((req, index) => (
                <View key={index} style={{ backgroundColor: Colors.primary + '10' }} className="flex-row items-center px-3 py-1.5 rounded-full gap-1">
                  <Text className="text-xs font-medium text-red-600">{req}</Text>
                  <TouchableOpacity onPress={() => handleRemoveRequirement(index)}>
                    <MaterialIcons name="close" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Skills Needed with Chip style */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Skills Needed</Text>
            <View className="flex-row items-center gap-2 mb-2">
              <TextInput
                className="flex-1 border-[1.5px] border-gray-200 rounded-xl px-4 py-3 bg-white text-sm text-slate-900"
                placeholder="Type skill and click Add..."
                placeholderTextColor={Colors.gray400}
                value={skillInput}
                onChangeText={setSkillInput}
              />
              <TouchableOpacity 
                onPress={handleAddSkill}
                className="bg-red-600 px-5 py-3 rounded-xl items-center justify-center shadow-sm"
              >
                <Text className="text-sm font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2 mt-1">
              {skills.map((skill, index) => (
                <View key={index} style={{ backgroundColor: Colors.primary + '10' }} className="flex-row items-center px-3 py-1.5 rounded-full gap-1">
                  <Text className="text-xs font-medium text-red-600">{skill}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSkill(index)}>
                    <MaterialIcons name="close" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          <PrimaryButton
            title={loading ? "Posting Job..." : "Submit Job Posting"}
            onPress={handleSubmit}
            size="large"
            style={{ marginTop: 16 }}
            disabled={loading}
          />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}