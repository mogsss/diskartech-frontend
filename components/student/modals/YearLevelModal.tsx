import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const YEAR_LEVEL_LIST = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

interface YearLevelModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (year: string) => void;
  selectedYear: string;
}

export default function YearLevelModal({ visible, onClose, onSelect, selectedYear }: YearLevelModalProps) {
  const { colors } = useDarkMode();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close year level selection"
        />
        <View 
          className="rounded-t-3xl px-6 pb-6 max-h-[50%]"
          style={{ backgroundColor: colors.surface }}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close year level selection"
            className="items-center justify-center py-4"
          >
            <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.textSecondary }} />
          </TouchableOpacity>
          <View 
            className="flex-row items-center gap-3 mb-4 pb-2 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="w-10 h-10 items-center justify-center">
              <MaterialIcons name="format-list-numbered" size={22} color={colors.accent} accessible={false} />
            </View>
            <Text className="flex-1 text-lg font-bold" style={{ color: colors.text }}>
              Select Year Level
            </Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {YEAR_LEVEL_LIST.map((item) => (
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
                  className={`text-base ${selectedYear === item ? 'text-red-600 font-bold' : ''}`}
                  style={selectedYear === item ? undefined : { color: colors.text }}
                >
                  {item}
                </Text>
                {selectedYear === item && <MaterialIcons name="check" size={20} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
