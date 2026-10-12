import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function ApplicationSection({ title, icon, children, badge, embedded = false }: {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
  badge?: React.ReactNode;
  embedded?: boolean;
}) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className={embedded ? 'border-t pt-4 mt-4' : 'mb-5'} style={embedded ? { borderTopColor: colors.border } : undefined}>
      <View className={embedded ? 'flex-row flex-wrap items-center gap-2 mb-3' : 'flex-row flex-wrap items-center gap-2 mb-2 px-1'}>
        {embedded && (
          <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2' }}>
            <MaterialIcons name={icon} size={16} color={isDark ? colors.accent : '#B91C1C'} />
          </View>
        )}
        <Text accessibilityRole="header" className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>{title}</Text>
        {badge}
      </View>
      <View className={embedded ? undefined : 'rounded-2xl border p-4'} style={embedded ? undefined : { backgroundColor: colors.surface, borderColor: colors.border }}>
        {children}
      </View>
    </View>
  );
}
