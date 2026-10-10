import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

interface InfoRowProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: any;
}

export default function InfoRow({ icon, label, value }: InfoRowProps) {
  const { colors } = useDarkMode();

  return (
    <View className="flex-row items-start gap-4 mb-4">
      <MaterialIcons name={icon} size={18} color={colors.textSecondary} />
      <View className="flex-1">
        <Text style={{ color: colors.textSecondary }} className="text-xs">{String(label || '')}</Text>
        <Text style={{ color: colors.text }} className="text-sm font-medium mt-[2px]">
          {String(value !== undefined && value !== null ? value : 'Not specified')}
        </Text>
      </View>
    </View>
  );
}