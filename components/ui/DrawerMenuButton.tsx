import React from 'react';
import { TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

interface DrawerMenuButtonProps {
  onPress: () => void;
}

export default function DrawerMenuButton({ onPress }: DrawerMenuButtonProps) {
  const { colors } = useDarkMode();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      className="w-12 h-12 rounded-2xl border items-center justify-center"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
    >
      <MaterialIcons name="menu" size={23} color={colors.text} />
    </TouchableOpacity>
  );
}
