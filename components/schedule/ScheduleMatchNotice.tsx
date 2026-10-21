import { useDarkMode } from '@/hooks/useDarkMode';
import React from 'react';
import { Text, View } from 'react-native';

export interface ScheduleMatch { status: 'full' | 'partial' | 'conflict' | 'unknown'; percentage: number | null }
export default function ScheduleMatchNotice({ match }: { match?: ScheduleMatch }) {
  const { isDark } = useDarkMode();
  if (!match) return null;
  const full = match.status === 'full';
  const foreground = full ? (isDark ? '#6EE7B7' : '#166534') : (isDark ? '#FCD34D' : '#92400E');
  const background = full ? (isDark ? '#14352A' : '#ECFDF5') : (isDark ? '#3B321D' : '#FFFBEB');
  const label = full ? 'Full schedule match' : match.status === 'partial' ? `Partial schedule match · ${match.percentage}% of hours covered` : match.status === 'conflict' ? 'Schedule conflict · Review required hours' : 'Schedule not yet confirmed';
  return <View style={{ backgroundColor: background, padding: 10, borderRadius: 10, marginTop: 12 }}><Text style={{ color: foreground, fontSize: 11, fontWeight: '600', lineHeight: 18 }}>{label}</Text></View>;
}
