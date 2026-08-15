import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const COURSE_LIST = [
  'BS Information Technology (BSIT)',
  'BS Computer Science (BSCS)',
  'BS Business Administration (BSBA)',
  'Bachelor of Elementary Education (BEED)',
  'Bachelor of Secondary Education (BSED)',
  'BS Agriculture (BSA)',
  'BS Hospitality Management (BSHM)',
  'Other / General'
];

interface CourseModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (course: string) => void;
  selectedCourse: string;
}

export default function CourseModal({ visible, onClose, onSelect, selectedCourse }: CourseModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 max-h-[70%]">
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-lg font-bold text-slate-900">Select Course</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {COURSE_LIST.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                className="py-3.5 border-b border-gray-50 flex-row justify-between items-center"
              >
                <Text className={`text-base ${selectedCourse === item ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                  {item}
                </Text>
                {selectedCourse === item && <MaterialIcons name="check" size={20} color="#DC2626" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}