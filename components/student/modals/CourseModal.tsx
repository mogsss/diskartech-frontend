import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const { colors } = useDarkMode();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close course selection"
        />
        <View 
          className="rounded-t-3xl px-6 pb-6 max-h-[70%]"
          style={{ backgroundColor: colors.surface }}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close course selection"
            className="items-center justify-center py-4"
          >
            <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.textSecondary }} />
          </TouchableOpacity>
          <View 
            className="flex-row items-center gap-3 mb-4 pb-2 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="w-10 h-10 items-center justify-center">
              <MaterialIcons name="menu-book" size={22} color={colors.accent} accessible={false} />
            </View>
            <Text className="flex-1 text-lg font-bold" style={{ color: colors.text }}>
              Select Course
            </Text>
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
                  className={`flex-1 mr-3 text-base ${selectedCourse === item ? 'text-red-600 font-bold' : ''}`}
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
