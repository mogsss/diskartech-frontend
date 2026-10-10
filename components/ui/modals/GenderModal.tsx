import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';

const GENDER_LIST = ['Male', 'Female', 'Prefer not to say'];

interface GenderModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (gender: string) => void;
  selectedGender: string;
}

export default function GenderModal({ visible, onClose, onSelect, selectedGender }: GenderModalProps) {
  const { isDark, colors } = useDarkMode();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
        <View 
          className="rounded-t-3xl p-6 max-h-[40%] border-t"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b" style={{ borderColor: colors.border }}>
            <Text className="text-lg font-bold" style={{ color: colors.text }}>Select Gender</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {GENDER_LIST.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                className="py-3.5 border-b flex-row justify-between items-center"
                style={{ borderColor: colors.border }}
              >
                <Text 
                  className="text-base"
                  style={{
                    color: selectedGender === item ? '#DC2626' : colors.text,
                    fontWeight: selectedGender === item ? '700' : '400',
                  }}
                >
                  {item}
                </Text>
                {selectedGender === item && <MaterialIcons name="check" size={20} color={colors.accent} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}