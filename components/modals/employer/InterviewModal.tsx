import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import DateTimePicker from '@react-native-community/datetimepicker';

interface InterviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (interviewType: string, date: string, time: string, location: string) => void;
  date: string;
  setDate: (val: string) => void;
  time: string;
  setTime: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  defaultAddress: string;
}

export default function InterviewModal({
  visible,
  onClose,
  onSubmit,
  date,
  setDate,
  time,
  setTime,
  location,
  setLocation,
  defaultAddress,
}: InterviewModalProps) {
  const [interviewType, setInterviewType] = useState<'walk-in' | 'online'>('walk-in');

  // States para sa pagpapakita ng Native Date/Time Pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const handleTypeChange = (type: 'walk-in' | 'online') => {
    setInterviewType(type);
    if (type === 'walk-in') {
      setLocation(defaultAddress);
    } else {
      setLocation('');
    }
  };

  // I-handle ang pagpili ng Date mula sa Native Calendar
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Sa iOS nananatili habang pinipili
    if (selectedDate) {
      setTempDate(selectedDate);
      // I-format ang petsa patungong readable string (halimbawa: September 15, 2026)
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      setDate(selectedDate.toLocaleDateString('en-US', options));
    }
  };

  // I-handle ang pagpili ng Time mula sa Native Clock picker
  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      // I-format ang oras patungong 12-hour format na may AM/PM
      const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
      setTime(selectedTime.toLocaleTimeString('en-US', options));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/60 justify-end"
      >
        <View className="bg-white rounded-t-[32px] p-6 w-full shadow-2xl max-h-[85%]">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xl font-bold text-slate-900">Schedule Interview</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <MaterialIcons name="close" size={24} color={Colors.gray400} />
            </TouchableOpacity>
          </View>
          
          <Text className="text-xs text-slate-500 mb-5">This will send an invite and automatically message the student via chat.</Text>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Interview Type Selector */}
            <Text className="text-xs font-semibold text-slate-700 mb-2">Interview Type</Text>
            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                onPress={() => handleTypeChange('walk-in')}
                className={`flex-1 flex-row items-center justify-center py-3 rounded-2xl border ${
                  interviewType === 'walk-in' ? 'bg-red-50 border-red-600' : 'bg-slate-50 border-gray-200'
                }`}
              >
                <MaterialIcons name="store" size={18} color={interviewType === 'walk-in' ? '#DC2626' : Colors.gray400} style={{ marginRight: 6 }} />
                <Text className={`text-xs font-bold ${interviewType === 'walk-in' ? 'text-red-600' : 'text-slate-600'}`}>Walk-In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleTypeChange('online')}
                className={`flex-1 flex-row items-center justify-center py-3 rounded-2xl border ${
                  interviewType === 'online' ? 'bg-red-50 border-red-600' : 'bg-slate-50 border-gray-200'
                }`}
              >
                <MaterialIcons name="videocam" size={18} color={interviewType === 'online' ? '#DC2626' : Colors.gray400} style={{ marginRight: 6 }} />
                <Text className={`text-xs font-bold ${interviewType === 'online' ? 'text-red-600' : 'text-slate-600'}`}>Online</Text>
              </TouchableOpacity>
            </View>

            {/* Interview Date Picker Trigger */}
            <Text className="text-xs font-semibold text-slate-700 mb-1.5">Interview Date</Text>
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              className="bg-slate-50 border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 flex-row items-center justify-between"
            >
              <Text className={`text-sm ${date ? 'text-slate-900' : 'text-gray-400'}`}>
                {date || 'Select interview date'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color={Colors.primary} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={onDateChange}
              />
            )}

            {/* Interview Time Picker Trigger */}
            <Text className="text-xs font-semibold text-slate-700 mb-1.5">Interview Time</Text>
            <TouchableOpacity 
              onPress={() => setShowTimePicker(true)}
              className="bg-slate-50 border border-gray-200 rounded-2xl px-4 py-3.5 mb-4 flex-row items-center justify-between"
            >
              <Text className={`text-sm ${time ? 'text-slate-900' : 'text-gray-400'}`}>
                {time || 'Select interview time'}
              </Text>
              <MaterialIcons name="access-time" size={20} color={Colors.primary} />
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={tempDate}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}

            {/* Location / Venue Input */}
            <Text className="text-xs font-semibold text-slate-700 mb-1.5">
              {interviewType === 'walk-in' ? 'Office Address / Venue' : 'Google Meet / Zoom Link'}
            </Text>
            <TextInput
              placeholder={interviewType === 'walk-in' ? 'Employer address' : 'e.g., https://meet.google.com/abc-xyz'}
              placeholderTextColor={Colors.gray400}
              value={location}
              onChangeText={setLocation}
              className="bg-slate-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm text-slate-900 mb-6"
            />

            <TouchableOpacity
              onPress={() => onSubmit(interviewType, date, time, location)}
              className="w-full bg-red-600 py-4 rounded-2xl items-center shadow-md shadow-red-200 mb-4"
            >
              <Text className="text-sm font-bold text-white">Send Interview Invite</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}