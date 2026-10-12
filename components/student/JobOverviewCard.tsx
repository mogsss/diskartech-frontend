import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryLabel, getSalaryUnit } from '@/utils/jobRate';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';

interface JobOverviewCardProps {
  job: any;
  appliedDate?: string;
  cleanDays: string;
  embedded?: boolean;
}

function parseList(value: unknown): string[] {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return value.trim() ? [value.trim()] : []; }
  }
  if (typeof parsed === 'string') return parsed.trim() ? [parsed.trim()] : [];
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
}

export default function JobOverviewCard({ job, cleanDays, embedded }: JobOverviewCardProps) {
  const { colors, isDark } = useDarkMode();
  if (!job) return null;
  const amount = Number(job.salary);
  const hasRate = job.salary !== null && job.salary !== undefined && String(job.salary).trim() !== '' && Number.isFinite(amount);
  const requirements = parseList(job.requirements);
  const skills = parseList(job.skills);
  const days = parseList(job.available_days ?? cleanDays).join(', ') || 'Not specified';
  const accent = isDark ? colors.accent : '#B91C1C';
  return (
    <ApplicationSection title="Job details" icon="work-outline" embedded={embedded}>
      <View className="mb-4">
        <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>{getSalaryLabel(job.salary_type)}</Text>
        <View className="flex-row items-baseline gap-2">
          <Text className="text-2xl font-bold tracking-tight" style={{ color: colors.text, flexShrink: 1 }}>{hasRate ? '\u20B1' + amount.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : 'Not specified'}</Text>
          {hasRate && <Text className="text-xs" style={{ color: colors.textSecondary }}>{getSalaryUnit(job.salary_type, 'long')}</Text>}
        </View>
      </View>
      <View className="border-t pt-4" style={{ borderTopColor: colors.border }}>
        <Text className="text-sm font-semibold mb-3" style={{ color: colors.text }}>Work schedule</Text>
        <View className="gap-3">
          <View>
            <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Work days</Text>
            <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{days}</Text>
          </View>
          <View>
            <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Time slot</Text>
            <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{job.time_slot || 'Not specified'}</Text>
          </View>
        </View>
      </View>
      <View className="border-t pt-4 mt-4" style={{ borderTopColor: colors.border }}>
        <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>About the role</Text>
        <Text className="text-sm leading-6" style={{ color: colors.text }}>{job.description || 'No description provided for this opening.'}</Text>
      </View>
      {requirements.length > 0 && (
        <View className="border-t pt-4 mt-4" style={{ borderTopColor: colors.border }}>
          <Text className="text-sm font-semibold mb-3" style={{ color: colors.text }}>Requirements</Text>
          <View className="gap-3">
            {requirements.map((requirement, index) => (
              <View key={index} className="flex-row items-start gap-2.5">
                <MaterialIcons name="check-circle-outline" size={16} color={accent} style={{ marginTop: 2 }} />
                <Text className="flex-1 text-sm leading-5" style={{ color: colors.text }}>{requirement}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {skills.length > 0 && (
        <View className="border-t pt-4 mt-4" style={{ borderTopColor: colors.border }}>
          <Text className="text-sm font-semibold mb-3" style={{ color: colors.text }}>Skills needed</Text>
          <View className="flex-row flex-wrap gap-2">
            {skills.map((skill, index) => (
              <View key={index} className="rounded-lg px-3 py-2" style={{ maxWidth: '100%', backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
                <Text className="text-xs font-medium leading-4" style={{ color: colors.text, flexShrink: 1 }}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ApplicationSection>
  );
}
