import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const BUSINESS_TYPES = [
  'Food & Beverage / Restaurant',
  'Retail & Convenience Store',
  'BPO / Call Center',
  'Hospitality & Hotel',
  'Education / Tutoring',
  'Logistics & Delivery',
  'IT & Tech Services',
  'Other / General Business'
];

interface BusinessTypeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
  selectedType: string;
}

export default function BusinessTypeModal({ visible, onClose, onSelect, selectedType }: BusinessTypeModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 max-h-[60%]">
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-lg font-bold text-slate-900">Select Business Type</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {BUSINESS_TYPES.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                className="py-3.5 border-b border-gray-50 flex-row justify-between items-center"
              >
                <Text className={`text-base ${selectedType === item ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                  {item}
                </Text>
                {selectedType === item && <MaterialIcons name="check" size={20} color="#DC2626" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}