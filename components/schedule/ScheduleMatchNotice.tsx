import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

export interface ScheduleMatch { status: 'full' | 'partial' | 'conflict' | 'unknown'; percentage: number | null }
export default function ScheduleMatchNotice({ match, compact = false }: { match?: ScheduleMatch; compact?: boolean }) {
  const { isDark } = useDarkMode();
  if (!match) return null;
  const full = match.status === 'full';
  const foreground = full ? (isDark ? '#6EE7B7' : '#166534') : (isDark ? '#FCD34D' : '#92400E');
  const background = full ? (isDark ? '#14352A' : '#ECFDF5') : (isDark ? '#3B321D' : '#FFFBEB');
  if (compact) {
    const label = full ? 'Schedule match' : match.status === 'partial' ? 'Partial match' : match.status === 'conflict' ? 'Schedule conflict' : 'Not confirmed';
    const icon = full ? 'event-available' : match.status === 'unknown' ? 'event-note' : 'warning-amber';
    return <View style={{ backgroundColor: background, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, maxWidth: '100%' }}>
      <MaterialIcons name={icon} size={14} color={foreground} accessible={false} />
      <Text style={{ color: foreground, fontSize: 11, fontWeight: '600', lineHeight: 18, flexShrink: 1 }}>{label}</Text>
    </View>;
  }
  const label = full ? 'Full schedule match' : match.status === 'partial' ? `Partial schedule match · ${match.percentage}% of hours covered` : match.status === 'conflict' ? 'Schedule conflict · Review required hours' : 'Schedule not yet confirmed';
  return <View style={{ backgroundColor: background, padding: 10, borderRadius: 10, marginTop: 12 }}><Text style={{ color: foreground, fontSize: 11, fontWeight: '600', lineHeight: 18 }}>{label}</Text></View>;
}
