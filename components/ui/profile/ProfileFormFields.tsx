import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

export function ProfileField({ label, required, ...input }: TextInputProps & { label: string; required?: boolean }) {
  const { colors, isDark } = useDarkMode();
  const accentText = isDark ? colors.accent : colors.primary;
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold leading-5" style={{ color: colors.text }}>
        {label}{required && <Text style={{ color: accentText }}> *</Text>}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={`${label}${required ? ', required' : ''}`}
        autoCorrect={false}
        placeholderTextColor={colors.textSecondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`rounded-xl border px-4 text-sm ${input.multiline ? 'min-h-24 py-3 leading-6' : 'h-14 py-3'}`}
        style={{
          color: colors.text,
          backgroundColor: isDark ? colors.background : '#F8FAFC',
          borderColor: focused ? accentText : colors.border,
          textAlignVertical: input.multiline ? 'top' : 'center',
          opacity: input.editable === false ? 0.65 : 1,
        }}
      />
    </View>
  );
}

export function FormSection({ title, description, icon, children }: {
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useDarkMode();
  const accentText = isDark ? colors.accent : colors.primary;
  return (
    <View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-start gap-3 px-5 py-4 border-b" style={{ borderColor: colors.border }}>
        <View className="h-9 w-9 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FFF1F2' }}>
          <MaterialIcons name={icon} size={19} color={accentText} />
        </View>
        <View className="flex-1 min-w-0">
          <Text accessibilityRole="header" className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{title}</Text>
          <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{description}</Text>
        </View>
      </View>
      <View className="p-5 gap-4">{children}</View>
    </View>
  );
}
