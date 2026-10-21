import { useDarkMode } from '@/hooks/useDarkMode';
import { ScheduleSlot, slotLabel, WEEK_DAYS } from '@/utils/weeklySchedule';
import React from 'react';
import { Text, View } from 'react-native';

export default function WeeklyScheduleSummary({ slots, showEmpty = false }: { slots: ScheduleSlot[]; showEmpty?: boolean }) {
  const { colors } = useDarkMode();
  return <View style={{ gap: 12 }}>{WEEK_DAYS.filter(day => showEmpty || slots.some(s => s.day_of_week === day)).map(day =>
    <View key={day} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <Text style={{ color: colors.text, width: 32, fontSize: 12, fontWeight: '600' }}>{day}</Text>
      <View style={{ flex: 1, gap: 5 }}>{slots.some(s => s.day_of_week === day)
        ? slots.filter(s => s.day_of_week === day).map((s, i) => <Text key={i} style={{ color: colors.text, fontSize: 12, lineHeight: 19 }}>{slotLabel(s)}</Text>)
        : <Text style={{ color: colors.textSecondary, fontSize: 12 }}>No hours selected</Text>}</View>
    </View>)}</View>;
}
