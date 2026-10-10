import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface InputSuggestionsProps {
  value: string;
  options: readonly string[];
  existingValues?: readonly string[];
  label: string;
  onChangeText: (value: string) => void;
  multiple?: boolean;
}

export default function InputSuggestions({
  value,
  options,
  existingValues = [],
  label,
  onChangeText,
  multiple = true,
}: InputSuggestionsProps) {
  const { colors, isDark } = useDarkMode();
  const parts = multiple ? value.split(',') : [value];
  const query = parts[parts.length - 1].trim().toLowerCase();
  const selectedValues = new Set(
    [...existingValues, ...parts.slice(0, -1)].map((item) => item.trim().toLowerCase())
  );
  const suggestions = query
    ? options
      .filter((item) => item.toLowerCase().includes(query) && !selectedValues.has(item.toLowerCase()))
      .sort((a, b) => Number(b.toLowerCase().startsWith(query)) - Number(a.toLowerCase().startsWith(query)))
    : [];

  if (suggestions.length === 0) return null;

  const handleSelect = (item: string) => {
    if (!multiple) {
      onChangeText(item);
      return;
    }
    const prefix = value.slice(0, value.lastIndexOf(',') + 1);
    onChangeText(`${prefix}${prefix ? ' ' : ''}${item}, `);
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2 px-1">
        <Text style={{ color: colors.textSecondary }} className="text-[10px] font-semibold tracking-widest">
          {label.toUpperCase()}
        </Text>
        <Text style={{ color: colors.textSecondary }} className="text-[10px]">
          Tap to select
        </Text>
      </View>
      <ScrollView
        key={query}
        style={{
          maxHeight: 176,
          flexGrow: 0,
          borderColor: colors.border,
          backgroundColor: isDark ? colors.background : '#F8FAFC',
        }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        className="border rounded-2xl overflow-hidden"
      >
        {suggestions.map((item, index) => {
          const matchStart = item.toLowerCase().indexOf(query);
          return (
            <TouchableOpacity
              key={item}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${item}`}
              activeOpacity={0.65}
              style={{
                minHeight: 44,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}
              className="flex-row items-center gap-3 px-3.5 py-2.5"
            >
              <MaterialIcons name="search" size={17} color={colors.textSecondary} />
              <Text style={{ color: colors.text }} className="flex-1 text-sm" numberOfLines={2}>
                {item.slice(0, matchStart)}
                <Text style={{ color: isDark ? colors.accent : '#B91C1C', fontWeight: '600' }}>
                  {item.slice(matchStart, matchStart + query.length)}
                </Text>
                {item.slice(matchStart + query.length)}
              </Text>
              <View
                style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEE2E2' }}
                className="w-6 h-6 rounded-full items-center justify-center"
              >
                <MaterialIcons name={multiple ? 'add' : 'check'} size={16} color={isDark ? colors.accent : '#B91C1C'} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
