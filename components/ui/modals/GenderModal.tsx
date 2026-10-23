import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';

const GENDER_LIST = [
  { label: 'Male', icon: 'male' },
  { label: 'Female', icon: 'female' },
  { label: 'Prefer not to say', icon: 'person-outline' },
] as const;

interface GenderModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (gender: string) => void;
  selectedGender: string;
}

export default function GenderModal({ visible, onClose, onSelect, selectedGender }: GenderModalProps) {
  const { colors } = useDarkMode();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close gender selection"
        />
        <View 
          className="rounded-t-3xl px-6 pb-6 max-h-[40%] border-t"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close gender selection"
            className="items-center justify-center py-4"
          >
            <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.textSecondary }} />
          </TouchableOpacity>
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: colors.border }}>
            <Text className="text-lg font-bold" style={{ color: colors.text }}>Select Gender</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {GENDER_LIST.map(({ label: item, icon }) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                className="py-3.5 border-b flex-row justify-between items-center"
                style={{ borderColor: colors.border }}
              >
                <View className="flex-1 flex-row items-center gap-3 mr-3">
                  <MaterialIcons name={icon} size={24} color={selectedGender === item ? colors.accent : colors.textSecondary} accessible={false} />
                  <Text
                  className="flex-1 text-base"
                  style={{
                    color: selectedGender === item ? '#DC2626' : colors.text,
                    fontWeight: selectedGender === item ? '700' : '400',
                  }}
                >
                  {item}
                </Text>
                </View>
                {selectedGender === item && <MaterialIcons name="check" size={20} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
