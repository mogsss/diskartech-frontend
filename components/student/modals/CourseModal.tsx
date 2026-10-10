import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';
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
  const { colors, isDark } = useDarkMode();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <View 
          className="rounded-t-3xl p-6 max-h-[70%]"
          style={{ backgroundColor: colors.surface }}
        >
          <View 
            className="flex-row justify-between items-center mb-4 pb-2 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Text className="text-lg font-bold" style={{ color: colors.text }}>
              Select Course
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
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
                className="py-3.5 border-b flex-row justify-between items-center"
                style={{ borderBottomColor: colors.border }}
              >
                <Text 
                  className={`text-base ${selectedCourse === item ? 'text-red-600 font-bold' : ''}`}
                  style={selectedCourse === item ? undefined : { color: colors.text }}
                >
                  {item}
                </Text>
                {selectedCourse === item && <MaterialIcons name="check" size={20} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}