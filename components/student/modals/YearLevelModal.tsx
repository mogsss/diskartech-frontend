import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const YEAR_LEVEL_LIST = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];

interface YearLevelModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (year: string) => void;
  selectedYear: string;
}

export default function YearLevelModal({ visible, onClose, onSelect, selectedYear }: YearLevelModalProps) {
  const { colors, isDark } = useDarkMode();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <View 
          className="rounded-t-3xl p-6 max-h-[50%]"
          style={{ backgroundColor: colors.surface }}
        >
          <View 
            className="flex-row justify-between items-center mb-4 pb-2 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Text className="text-lg font-bold" style={{ color: colors.text }}>
              Select Year Level
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
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