import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface InfoRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: any;
}

export default function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-start gap-4 mb-4">
      <MaterialIcons name={icon} size={18} color={Colors.gray500} />
      <View className="flex-1">
        <Text className="text-xs text-slate-400">{String(label || '')}</Text>
        <Text className="text-sm font-medium text-slate-900 mt-[2px]">
          {String(value !== undefined && value !== null ? value : 'Not specified')}
        </Text>
      </View>
    </View>
  );
}