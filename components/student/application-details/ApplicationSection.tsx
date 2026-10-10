import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function ApplicationSection({ title, icon, children, badge }: {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row flex-wrap items-center gap-2 mb-3">
        <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2' }}>
          <MaterialIcons name={icon} size={16} color={isDark ? colors.accent : '#B91C1C'} />
        </View>
        <Text className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>{title}</Text>
        {badge}
      </View>
      {children}
    </View>
  );
}
