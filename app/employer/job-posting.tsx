import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const AVAILABLE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  'Morning (6AM - 12PM)', 
  'Afternoon (1PM - 5PM)', 
  'Evening (6PM - 10PM)', 
  'Whole Day'
];
const CATEGORY_OPTIONS = ['Food Service', 'Retail', 'Tutoring', 'Delivery', 'Cleaning', 'General'];

export default function JobPostingScreen() {
  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [salary, setSalary] = useState('');
  
  // Category state at dropdown visibility toggle
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Schedule states na kapareho ng sa student availability
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('Whole Day');
  
  const [requirementInput, setRequirementInput] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);
  
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  // Toggle days selection
  const handleToggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Salary input handler para siguradong numbers lang
  const handleSalaryChange = (text: string) => {
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
      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.1.2:8000/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: jobTitle,
          description: description,
          salary: salary,
          category: selectedCategory,
          available_days: selectedDays, 
          time_slot: selectedTimeSlot,  
          requirements: requirements,
          skills: skills,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success', 
          `Your job has been successfully posted! Matched ${data.matched_students_count} students nearby.`, 
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', data.message || 'Something went wrong.');
      }
    } catch (error) {
      console.error(error);
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
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setIsCategoryOpen(false); }}>
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

          {/* Salary Range */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Rate / Rate per day (₱) *</Text>
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

          {/* Category Dropdown */}
          <View className="mb-4 relative z-50">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Job Category</Text>
            <TouchableOpacity
              onPress={() => setIsCategoryOpen(!isCategoryOpen)}
              className="flex-row items-center justify-between border-[1.5px] border-gray-200 rounded-xl p-4 bg-white"
            >
              <View className="flex-row items-center">
                <MaterialIcons name="category" size={20} color={Colors.gray400} style={{ marginRight: 8 }} />
                <Text className="text-base text-slate-900">{selectedCategory}</Text>
              </View>
              <MaterialIcons 
                name={isCategoryOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                size={24} 
                color={Colors.gray400} 
              />
            </TouchableOpacity>

            {isCategoryOpen && (
              <View className="absolute top-20 left-0 right-0 bg-white border-[1.5px] border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                {CATEGORY_OPTIONS.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setIsCategoryOpen(false);
                    }}
                    className="p-4 border-b border-gray-100 flex-row items-center justify-between bg-white"
                  >
                    <Text className={`text-base ${selectedCategory === cat ? 'font-bold text-red-600' : 'text-slate-800'}`}>
                      {cat}
                    </Text>
                    {selectedCategory === cat && (
                      <MaterialIcons name="check" size={18} color="#dc2626" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Available Days Selection (Katulad ng sa Student) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Available Days *</Text>
            <View className="flex-row flex-wrap gap-2">
              {AVAILABLE_DAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => handleToggleDay(day)}
                    className={`px-4 py-2.5 rounded-xl border ${
                      isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Time Slot Selection (Katulad ng sa Student) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-900 mb-2">Time Slot *</Text>
            <View className="gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setSelectedTimeSlot(slot)}
                    className={`p-4 rounded-xl border ${
                      isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Instructional Text */}
          <Text className="text-sm font-bold text-slate-800 mt-2 mb-4">List the skills and requirements needed</Text>

          {/* Requirements */}
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

          {/* Skills Needed */}
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