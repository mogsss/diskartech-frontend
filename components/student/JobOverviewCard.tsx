import React from 'react';
import { View, Text } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getSalaryLabel, getSalaryUnit } from '@/utils/jobRate';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';
import {
  JobScheduleCard,
  JobDescriptionCard,
  JobRequirementsCard,
  JobSkillsCard,
} from '@/components/employer/job-details/JobDetailsCards';

interface JobOverviewCardProps {
  job: any;
  appliedDate?: string;
  cleanDays: string;
}

function parseList(value: unknown): string[] {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return value.trim() ? [value.trim()] : []; }
  }
  if (typeof parsed === 'string') return parsed.trim() ? [parsed.trim()] : [];
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];
}

export default function JobOverviewCard({ job, cleanDays }: JobOverviewCardProps) {
  const { colors } = useDarkMode();
  if (!job) return null;
  const amount = Number(job.salary);
  const hasRate = job.salary !== null && job.salary !== undefined && String(job.salary).trim() !== '' && Number.isFinite(amount);
  return (
    <>
      <ApplicationSection title={getSalaryLabel(job.salary_type)} icon="payments">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-2xl font-bold tracking-tight" style={{ color: colors.text, flexShrink: 1 }}>{hasRate ? '\u20B1' + amount.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : 'Not specified'}</Text>
          {hasRate && <Text className="text-xs" style={{ color: colors.textSecondary }}>{getSalaryUnit(job.salary_type, 'long')}</Text>}
        </View>
      </ApplicationSection>
      <JobScheduleCard availableDays={job.available_days ?? cleanDays} timeSlot={job.time_slot} />
      <JobDescriptionCard description={job.description} />
      <JobRequirementsCard requirements={parseList(job.requirements)} />
      <JobSkillsCard skills={parseList(job.skills)} />
    </>
  );
}
