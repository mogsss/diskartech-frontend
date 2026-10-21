import WeeklyScheduleModal from '@/components/schedule/WeeklyScheduleModal';
import WeeklyScheduleSummary from '@/components/schedule/WeeklyScheduleSummary';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { JobPostingForm } from '@/hooks/useJobPosting';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import JobFormSection from './JobFormSection';

export default function JobScheduleFields({ form }: { form: JobPostingForm['schedule'] }) {
  const { colors, isDark } = useDarkMode();
  const [visible, setVisible] = useState(false);
  return <JobFormSection number="02" title="Work schedule" subtitle="Choose the days and exact hours this job requires." icon="calendar-today">
    {form.weeklySchedule.slots.length > 0 ? <WeeklyScheduleSummary slots={form.weeklySchedule.slots} /> :
      <View style={{ padding: 16, borderRadius: 12, backgroundColor: isDark ? colors.background : '#F8FAFC', marginBottom: 12 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 21 }}>No schedule yet. Set different hours for each work day, including breaks and overnight shifts.</Text>
      </View>}
    <TouchableOpacity onPress={() => setVisible(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, marginTop: 14, padding: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 12 }}>
      <MaterialIcons name="edit-calendar" size={19} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{form.weeklySchedule.slots.length ? 'Change days & hours' : 'When do you need help?'}</Text>
    </TouchableOpacity>
    <WeeklyScheduleModal visible={visible} value={form.weeklySchedule} mode="job" defaultToToday={form.defaultToToday} onClose={() => setVisible(false)} onSave={value => { form.setWeeklySchedule(value); return true; }} />
  </JobFormSection>;
}
