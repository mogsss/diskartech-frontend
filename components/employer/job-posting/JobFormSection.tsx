import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

export default function JobFormSection({ number, title, subtitle, icon, children }: {
  number: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-3 px-1 mb-3">
        <View className="w-10 h-10 items-center justify-center">
          <MaterialIcons name={icon} size={20} color={isDark ? colors.accent : '#B91C1C'} />
        </View>
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-base font-bold mb-0.5" style={{ color: colors.text }}>{title}</Text>
          <Text className="text-[11px] leading-4" style={{ color: colors.textSecondary }}>{subtitle}</Text>
        </View>
        <Text className="text-xs font-semibold" style={{ color: colors.textSecondary }}>{number}</Text>
      </View>
      <View className="rounded-3xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        {children}
      </View>
    </View>
  );
}
