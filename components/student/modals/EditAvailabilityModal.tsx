import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_ROWS = [DAYS_OF_WEEK.slice(0, 4), DAYS_OF_WEEK.slice(4)];
const TIME_SLOTS = [
  { value: 'Morning (6AM - 12PM)', label: 'Morning', hours: '6 AM – 12 PM', icon: 'wb-sunny' },
  { value: 'Afternoon (1PM - 5PM)', label: 'Afternoon', hours: '1 PM – 5 PM', icon: 'wb-twilight' },
  { value: 'Evening (6PM - 10PM)', label: 'Evening', hours: '6 PM – 10 PM', icon: 'nightlight-round' },
  { value: 'Whole Day', label: 'Whole day', hours: 'Available throughout the day', icon: 'schedule' },
] as const;

interface EditAvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
  currentDays: string[];
  currentTimeSlot: string;
  onSave: (days: string[], timeSlot: string) => void;
}

export default function EditAvailabilityModal({ visible, onClose, currentDays, currentTimeSlot, onSave }: EditAvailabilityModalProps) {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [selectedDays, setSelectedDays] = useState<string[]>(currentDays);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(currentTimeSlot);
  const wasVisible = useRef(false);

  // Load saved values on opening without overwriting edits during profile polling.
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setSelectedDays([...currentDays]);
      setSelectedTimeSlot(currentTimeSlot);
    }
    wasVisible.current = visible;
  }, [visible, currentDays, currentTimeSlot]);

  const accentText = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const subtle = isDark ? '#263449' : '#F1F5F9';
  const canSave = selectedDays.length > 0 && !!selectedTimeSlot.trim();

  const toggleDay = (day: string) => {
    setSelectedDays((days) => days.includes(day) ? days.filter((value) => value !== day) : [...days, day]);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave([...selectedDays], selectedTimeSlot);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <TouchableOpacity onPress={onClose} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Dismiss availability editor" className="absolute inset-0" />
        <View accessibilityViewIsModal className="w-full max-w-2xl self-center rounded-t-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '90%', paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="w-10 h-1 rounded-full self-center mt-3 mb-1" style={{ backgroundColor: colors.border }} />
          <View className="flex-row items-center gap-3 px-6 pt-4 pb-5">
            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: accentSurface }}>
              <MaterialIcons name="event-available" size={23} color={accentText} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Edit availability</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Set the days and hours you can work.</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Close availability editor" className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: subtle }}>
              <MaterialIcons name="close" size={21} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView className="shrink" contentContainerClassName="px-6 pb-5" showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between gap-2 mb-1">
              <Text className="text-sm font-semibold" style={{ color: colors.text }}>Available days</Text>
            </View>
            <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>You can choose more than one day.</Text>
            <View className="gap-2 mb-6">
              {DAY_ROWS.map((days, row) => (
                <View key={row} className="flex-row gap-2">
                  {days.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <TouchableOpacity key={day} onPress={() => toggleDay(day)} activeOpacity={0.75} accessibilityRole="checkbox" accessibilityLabel={day} accessibilityState={{ checked: isSelected }} className="flex-1 min-h-12 py-3 rounded-xl border items-center justify-center" style={{ backgroundColor: isSelected ? colors.primary : subtle, borderColor: isSelected ? colors.primary : colors.border }}>
                        <Text className="text-sm font-semibold" style={{ color: isSelected ? '#FFFFFF' : colors.textSecondary }}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {days.length < 4 && <View className="flex-1" />}
                </View>
              ))}
            </View>

            <Text className="text-sm font-semibold" style={{ color: colors.text }}>Preferred time</Text>
            <Text className="text-xs leading-5 mt-1 mb-3" style={{ color: colors.textSecondary }}>Choose one time slot for your selected days.</Text>
            <View accessibilityRole="radiogroup" className="gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlot === slot.value;
                return (
                  <TouchableOpacity key={slot.value} onPress={() => setSelectedTimeSlot(slot.value)} activeOpacity={0.75} accessibilityRole="radio" accessibilityLabel={slot.label + ', ' + slot.hours} accessibilityState={{ checked: isSelected }} className="flex-row items-center gap-3 rounded-2xl border p-3" style={{ backgroundColor: isSelected ? accentSurface : colors.surface, borderColor: isSelected ? colors.primary : colors.border }}>
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: isSelected ? accentSurface : subtle }}>
                      <MaterialIcons name={slot.icon} size={20} color={isSelected ? accentText : colors.textSecondary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" style={{ color: isSelected ? accentText : colors.text }}>{slot.label}</Text>
                      <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{slot.hours}</Text>
                    </View>
                    <MaterialIcons name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'} size={21} color={isSelected ? accentText : colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View className="px-6 pt-4 border-t" style={{ borderColor: colors.border }}>
            <View className="flex-row items-start gap-2 mb-3">
              <MaterialIcons name={canSave ? 'event-available' : 'info-outline'} size={16} color={canSave ? accentText : colors.textSecondary} />
              <Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>
                {canSave ? DAYS_OF_WEEK.filter((day) => selectedDays.includes(day)).join(', ') + ' · ' + selectedTimeSlot : 'Select at least one day and a time slot to continue.'}
              </Text>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={onClose} activeOpacity={0.75} accessibilityRole="button" className="flex-1 min-h-12 px-3 py-3 rounded-xl border items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Text className="text-sm font-semibold" style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={!canSave} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ disabled: !canSave }} className="flex-1 min-h-12 px-3 py-3 rounded-xl items-center justify-center" style={{ backgroundColor: colors.primary, opacity: canSave ? 1 : 0.5 }}>
                <Text className="text-sm font-semibold text-white text-center">Save availability</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
