import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { formatDate, getStatusIcon } from '@/utils/helpers';

const statuses: Record<string, { label: string; message: string; light: string; dark: string; background: string }> = {
  pending: { label: 'Pending', message: 'Your application has been submitted and is waiting for the employer to review.', light: '#92400E', dark: '#FCD34D', background: '#FFFBEB' },
  viewed: { label: 'Viewed', message: 'The employer has viewed your application. Watch for an update or message.', light: '#1D4ED8', dark: '#93C5FD', background: '#EFF6FF' },
  shortlisted: { label: 'Shortlisted', message: 'You have been shortlisted for this role. The employer may contact you about the next step.', light: '#7E22CE', dark: '#D8B4FE', background: '#FAF5FF' },
  interview: { label: 'Interview', message: 'Review your interview details below and coordinate with the employer.', light: '#0E7490', dark: '#67E8F9', background: '#ECFEFF' },
  accepted: { label: 'Accepted', message: 'Your application has been accepted. Review the details below and coordinate the next steps with the employer.', light: '#047857', dark: '#6EE7B7', background: '#ECFDF5' },
  rejected: { label: 'Not selected', message: 'Your application was not selected for this role. You can remove this record from your history.', light: '#B91C1C', dark: '#FCA5A5', background: '#FEF2F2' },
  cancelled: { label: 'Cancelled', message: 'This application has been cancelled. You can remove this record from your history.', light: '#475569', dark: '#CBD5E1', background: '#F1F5F9' },
  completed: { label: 'Completed', message: 'Your employment contract is complete. You can request a certificate and rate your employer below.', light: '#047857', dark: '#6EE7B7', background: '#ECFDF5' },
  terminated: { label: 'Contract concluded', message: 'This employment contract has been concluded by the employer.', light: '#B91C1C', dark: '#FCA5A5', background: '#FEF2F2' },
};

function dateLabel(value?: string) {
  return value && !Number.isNaN(new Date(value).getTime()) ? formatDate(value) : null;
}

export default function ApplicationStatusCard({ status, jobTitle, category, companyName, applicationId, appliedAt, updatedAt, terminationReason }: {
  status: string;
  jobTitle?: string;
  category?: string;
  companyName: string;
  applicationId: string | number;
  appliedAt?: string;
  updatedAt?: string;
  terminationReason?: string;
}) {
  const { colors, isDark } = useDarkMode();
  const details = statuses[status] ?? { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Status unavailable', message: 'Message the employer for more information about your application.', light: '#475569', dark: '#CBD5E1', background: '#F1F5F9' };
  const statusColor = isDark ? details.dark : details.light;
  const appliedDate = dateLabel(appliedAt);
  const updatedDate = dateLabel(updatedAt);
  const showUpdated = ['accepted', 'completed', 'terminated'].includes(status) && updatedDate;

  return (
    <View className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <View className="flex-row flex-wrap items-center gap-2 mb-3">
        <View className="px-2.5 py-1.5 rounded-lg" style={{ maxWidth: '100%', backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
          <Text className="text-[11px] font-medium" style={{ color: colors.textSecondary }}>{category || 'General'}</Text>
        </View>
        <Text className="text-[11px] ml-auto" style={{ color: colors.textSecondary }}>{'Application #' + applicationId}</Text>
      </View>
      <Text className="text-2xl font-bold tracking-tight leading-8" style={{ color: colors.text }}>{jobTitle || 'Job opening'}</Text>
      <Text className="text-sm mt-1 mb-4" style={{ color: colors.textSecondary }}>{companyName}</Text>
      <View className="rounded-xl p-3" style={{ backgroundColor: isDark ? statusColor + '12' : details.background }}>
        <View className="flex-row items-center gap-2 mb-1.5">
          <MaterialIcons name={getStatusIcon(status) as keyof typeof MaterialIcons.glyphMap} size={17} color={statusColor} />
          <Text className="text-xs font-semibold" style={{ color: statusColor }}>{details.label}</Text>
        </View>
        <Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>{details.message}</Text>
      </View>
      {status === 'terminated' && terminationReason && (
        <View className="mt-3">
          <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Reason for termination</Text>
          <Text className="text-xs leading-5" style={{ color: colors.text }}>{terminationReason}</Text>
        </View>
      )}
      {(appliedDate || showUpdated) && (
        <View className="flex-row flex-wrap gap-x-4 gap-y-2 border-t pt-3 mt-4" style={{ borderTopColor: colors.border }}>
          {appliedDate && <Text className="text-[11px]" style={{ color: colors.textSecondary }}>{'Applied ' + appliedDate}</Text>}
          {showUpdated && <Text className="text-[11px]" style={{ color: colors.textSecondary }}>{(status === 'accepted' ? 'Accepted ' : status === 'completed' ? 'Completed ' : 'Concluded ') + updatedDate}</Text>}
        </View>
      )}
    </View>
  );
}
