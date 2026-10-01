import { Colors } from '@/constants/colors';
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
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 max-h-[50%]">
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-lg font-bold text-slate-900">Select Year Level</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
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
                className="py-3.5 border-b border-gray-50 flex-row justify-between items-center"
              >
                <Text className={`text-base ${selectedYear === item ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                  {item}
                </Text>
                {selectedYear === item && <MaterialIcons name="check" size={20} color="#DC2626" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}