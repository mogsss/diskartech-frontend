import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = ['Morning (8AM - 12PM)', 'Afternoon (1PM - 5PM)', 'Evening (6PM - 10PM)', 'Whole Day'];

interface EditAvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
  currentDays: string[];
  currentTimeSlot: string;
  onSave: (days: string[], timeSlot: string) => void;
}

export default function EditAvailabilityModal({
  visible,
  onClose,
  currentDays,
  currentTimeSlot,
  onSave,
}: EditAvailabilityModalProps) {
  const [selectedDays, setSelectedDays] = useState<string[]>(currentDays);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(currentTimeSlot);

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-lg font-bold text-slate-900">Edit Availability</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Select Days */}
            <Text className="text-sm font-semibold text-slate-700 mb-2">Available Days</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => toggleDay(day)}
                    style={{
                      backgroundColor: isSelected ? '#DC2626' : '#F1F5F9',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: isSelected ? '#FFFFFF' : '#334155', fontWeight: '600', fontSize: 13 }}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Select Time Slot */}
            <Text className="text-sm font-semibold text-slate-700 mb-2">Time Slot</Text>
            <View className="mb-6">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setSelectedTimeSlot(slot)}
                    className={`py-3.5 px-4 rounded-2xl mb-2 border flex-row justify-between items-center ${
                      isSelected ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <Text className={`text-sm font-medium ${isSelected ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                      {slot}
                    </Text>
                    {isSelected && <MaterialIcons name="check-circle" size={18} color="#DC2626" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={() => {
                onSave(selectedDays, selectedTimeSlot);
                onClose();
              }}
              className="bg-red-600 rounded-2xl py-4 items-center justify-center mb-6 shadow-sm"
            >
              <Text className="text-white font-bold text-base">Save Availability</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}