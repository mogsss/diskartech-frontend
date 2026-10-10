import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryLabel, getSalaryUnit } from '@/utils/jobRate';

interface JobMetricsOverviewProps {
  rate?: string | number | null;
  salaryType?: unknown;
  applicantCount: number;
  onViewApplicants: () => void;
}

export function JobMetricsOverview({ rate, salaryType, applicantCount, onViewApplicants }: JobMetricsOverviewProps) {
  const { colors, isDark } = useDarkMode();
  const amount = Number(rate);
  const hasRate = rate !== null && rate !== undefined && String(rate).trim() !== '' && Number.isFinite(amount);
  const accentColor = isDark ? colors.accent : '#B91C1C';

  return (
    <View className="flex-row rounded-2xl border p-4 mb-4" style={{ backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border }}>
      <View className="flex-1 pr-4" style={{ minWidth: 0 }}>
        <Text className="text-[10px] font-semibold tracking-wide mb-2" style={{ color: colors.textSecondary }}>{getSalaryLabel(salaryType).toUpperCase()}</Text>
        <Text className="text-2xl font-bold tracking-tight" style={{ color: colors.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {hasRate ? '\u20B1' + amount.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : 'Not set'}
        </Text>
        <Text className="text-[11px] mt-1" style={{ color: colors.textSecondary }}>{hasRate ? getSalaryUnit(salaryType, 'long') : 'No rate provided'}</Text>
      </View>
      <TouchableOpacity
        onPress={onViewApplicants}
        accessibilityRole="button"
        accessibilityLabel="View applicants"
        activeOpacity={0.7}
        className="flex-1 pl-4 border-l"
        style={{ borderLeftColor: colors.border }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[10px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>APPLICANTS</Text>
          <MaterialIcons name="people-outline" size={16} color={colors.textSecondary} />
        </View>
        <Text className="text-2xl font-bold tracking-tight" style={{ color: colors.text }}>{applicantCount.toLocaleString('en-PH')}</Text>
        <View className="flex-row items-center gap-0.5 mt-1">
          <Text className="text-[11px] font-semibold" style={{ color: accentColor }}>View applicants</Text>
          <MaterialIcons name="chevron-right" size={14} color={accentColor} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function DetailSection({ title, icon, count, children }: {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  count?: number;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row items-center gap-2 mb-3">
        <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FEF2F2' }}>
          <MaterialIcons name={icon} size={16} color={isDark ? colors.accent : '#B91C1C'} />
        </View>
        <Text className="flex-1 text-sm font-semibold" style={{ color: colors.text }}>{title}</Text>
        {count !== undefined && <Text className="text-[11px]" style={{ color: colors.textSecondary }}>{count}</Text>}
      </View>
      {children}
    </View>
  );
}

interface JobScheduleCardProps {
  availableDays: unknown;
  timeSlot?: string;
}

export function JobScheduleCard({ availableDays, timeSlot }: JobScheduleCardProps) {
  const { colors } = useDarkMode();
  let parsedDays = availableDays;
  if (typeof availableDays === 'string') {
    try { parsedDays = JSON.parse(availableDays); } catch {}
  }
  const daysLabel = Array.isArray(parsedDays)
    ? parsedDays.filter((day) => typeof day === 'string' && day.trim()).join(', ') || 'Not specified'
    : typeof parsedDays === 'string' && parsedDays.trim() ? parsedDays : 'Not specified';

  return (
    <DetailSection title="Work schedule" icon="calendar-today">
      <View className="mb-3">
        <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Work days</Text>
        <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{daysLabel}</Text>
      </View>
      <View className="border-t pt-3" style={{ borderTopColor: colors.border }}>
        <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Time slot</Text>
        <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{timeSlot || 'Not specified'}</Text>
      </View>
    </DetailSection>
  );
}

export function JobDescriptionCard({ description }: { description?: string }) {
  const { colors } = useDarkMode();
  return (
    <DetailSection title="About the role" icon="description">
      <Text className="text-sm leading-6" style={{ color: colors.text }}>{description || 'No description provided for this opening.'}</Text>
    </DetailSection>
  );
}

export function JobRequirementsCard({ requirements }: { requirements: string[] }) {
  const { colors, isDark } = useDarkMode();
  if (!requirements?.length) return null;
  return (
    <DetailSection title="Requirements" icon="checklist" count={requirements.length}>
      <View className="gap-3">
        {requirements.map((requirement, index) => (
          <View key={index} className="flex-row items-start gap-2.5">
            <MaterialIcons name="check-circle-outline" size={16} color={isDark ? colors.accent : '#B91C1C'} style={{ marginTop: 2 }} />
            <Text className="flex-1 text-sm leading-5" style={{ color: colors.text }}>{requirement}</Text>
          </View>
        ))}
      </View>
    </DetailSection>
  );
}

export function JobSkillsCard({ skills }: { skills: string[] }) {
  const { colors, isDark } = useDarkMode();
  if (!skills?.length) return null;
  return (
    <DetailSection title="Skills needed" icon="psychology" count={skills.length}>
      <View className="flex-row flex-wrap gap-2">
        {skills.map((skill, index) => (
          <View key={index} className="border rounded-xl px-3 py-2" style={{ maxWidth: '100%', backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border }}>
            <Text className="text-xs font-medium leading-4" style={{ color: colors.text, flexShrink: 1 }}>{skill}</Text>
          </View>
        ))}
      </View>
    </DetailSection>
  );
}
