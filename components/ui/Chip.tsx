import { Colors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/typography';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  removable?: boolean;
  onRemove?: () => void;
  variant?: 'filled' | 'outlined';
}

export default function Chip({
  label,
  selected = false,
  onPress,
  icon,
  removable = false,
  onRemove,
  variant = 'filled',
}: ChipProps) {
  const isFilled = variant === 'filled';
  const { isDark, colors } = useDarkMode();

  const unselectedBg = isFilled ? (isDark ? '#334155' : Colors.gray100) : 'transparent';
  const unselectedBorder = isDark ? '#475569' : Colors.border;
  const unselectedTextColor = isDark ? '#E2E8F0' : Colors.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? Colors.primary : unselectedBg,
          borderColor: selected ? Colors.primary : unselectedBorder,
          borderWidth: isFilled ? 0 : 1.5,
        },
      ]}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={16}
          color={selected ? Colors.white : unselectedTextColor}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          { color: selected ? Colors.white : unselectedTextColor },
        ]}
      >
        {label}
      </Text>
      {removable && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <MaterialIcons name="close" size={14} color={selected ? Colors.white : Colors.textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  filled: {
    backgroundColor: Colors.gray100,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  selectedFilled: {
    backgroundColor: Colors.primary,
  },
  selectedOutlined: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  icon: {
    marginRight: 4,
  },
  label: {
    ...Typography.buttonSmall,
  },
  filledLabel: {
    color: Colors.textSecondary,
  },
  outlinedLabel: {
    color: Colors.textSecondary,
  },
  selectedLabel: {
    color: Colors.white,
  },
  removeBtn: {
    marginLeft: 4,
    padding: 2,
  },
});

