import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getStatusIcon } from '@/utils/helpers';
import { buildApplicationTrail, formatTrailTimestamp, type ApplicationTrailRecord } from '@/utils/applicationTrail';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';

const statusColors: Record<string, { light: string; dark: string }> = {
  pending: { light: '#A16207', dark: '#FACC15' },
  viewed: { light: '#1D4ED8', dark: '#60A5FA' },
  shortlisted: { light: '#7E22CE', dark: '#C084FC' },
  interview: { light: '#0E7490', dark: '#22D3EE' },
  accepted: { light: '#15803D', dark: '#34D399' },
  rejected: { light: '#DC2626', dark: '#F87171' },
  cancelled: { light: '#475569', dark: '#E2E8F0' },
  completed: { light: '#15803D', dark: '#34D399' },
  terminated: { light: '#DC2626', dark: '#F87171' },
};

type ApplicationStatusCardProps = ApplicationTrailRecord & {
  jobTitle?: string;
  category?: string;
  companyName: string;
  applicationId: string | number;
  updatedAt?: string;
  terminationReason?: string;
  children?: React.ReactNode;
};

export default function ApplicationStatusCard(props: ApplicationStatusCardProps) {
  const { jobTitle, category, companyName, applicationId, updatedAt, terminationReason, children } = props;
  const { colors, isDark } = useDarkMode();
  const status = props.status.trim().toLowerCase();
  const palette = statusColors[status] ?? { light: '#475569', dark: '#CBD5E1' };
  const statusColor = isDark ? palette.dark : palette.light;
  const recordedColor = isDark ? '#34D399' : '#15803D';
  const upcomingColor = isDark ? '#CBD5E1' : '#64748B';
  const { label, steps } = buildApplicationTrail(props);
  const updatedDate = formatTrailTimestamp(updatedAt);

  return (
    <ApplicationSection title="Application trail" icon="timeline" transparent>
      <View className="flex-row items-center justify-between gap-3 mb-3">
        <Text className="flex-1 text-[11px] font-medium" style={{ color: colors.textSecondary }}>{category || 'General'}</Text>
        <View className="flex-row items-center gap-1.5 py-1.5" style={{ maxWidth: '60%' }}>
          <MaterialIcons name={getStatusIcon(status) as keyof typeof MaterialIcons.glyphMap} size={15} color={statusColor} />
          <Text className="text-xs font-semibold" style={{ color: statusColor, flexShrink: 1 }}>{label}</Text>
        </View>
      </View>
      <Text className="text-2xl font-bold tracking-tight leading-8" style={{ color: colors.text }}>{jobTitle || 'Job opening'}</Text>
      <Text className="text-sm mt-1 mb-5" style={{ color: colors.textSecondary }}>{companyName}</Text>

      {steps.map((step, index) => {
        const current = step.state === 'current';
        const upcoming = step.state === 'upcoming';
        const last = index === steps.length - 1;
        const color = current ? statusColor : upcoming ? upcomingColor : recordedColor;
        const date = formatTrailTimestamp(step.occurredAt);
        const stateLabel = current ? 'Current' : upcoming ? 'Next' : 'Recorded';
        return (
          <View key={step.key} className="flex-row gap-3" accessible accessibilityLabel={[step.title, stateLabel, step.description, date].filter(Boolean).join('. ')}>
            <View className="items-center" style={{ width: 28 }}>
              <View className="w-7 h-7 rounded-full items-center justify-center" style={{ borderWidth: 1.5, borderColor: upcoming ? upcomingColor + '80' : color, backgroundColor: upcoming ? colors.surface : color + '16' }}>
                <MaterialIcons name={current ? getStatusIcon(status) as keyof typeof MaterialIcons.glyphMap : upcoming ? 'radio-button-unchecked' : 'check'} size={15} color={color} />
              </View>
              {!last && <View style={{ width: 2, flex: 1, minHeight: 20, marginVertical: 4, backgroundColor: colors.border }} />}
            </View>
            <View className="flex-1" style={{ paddingBottom: last ? 0 : 22 }}>
              <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <Text className="text-sm font-semibold leading-6" style={{ color: upcoming ? colors.textSecondary : colors.text }}>{step.title}</Text>
                <Text className="text-[10px] font-semibold" style={{ color }}>{stateLabel}</Text>
              </View>
              <Text className="text-xs leading-5 mt-0.5" style={{ color: colors.textSecondary }}>{step.description}</Text>
              {date && <Text className="text-[11px] leading-5 mt-1" style={{ color: colors.textSecondary }}>{date}</Text>}
            </View>
          </View>
        );
      })}

      {status === 'terminated' && terminationReason && (
        <View className="mt-4 rounded-xl p-3" style={{ backgroundColor: isDark ? colors.background : '#FEF2F2' }}>
          <Text className="text-[11px] font-semibold mb-1" style={{ color: statusColor }}>Reason for termination</Text>
          <Text className="text-xs leading-5" style={{ color: colors.text }}>{terminationReason}</Text>
        </View>
      )}
      {children}
      <View className="flex-row items-start justify-between gap-3 border-t pt-3 mt-4" style={{ borderTopColor: colors.border }}>
        {updatedDate && <Text className="min-w-0 flex-1 text-[11px] leading-5" style={{ color: colors.textSecondary }}>{'Last updated ' + updatedDate}</Text>}
        <Text className="ml-auto text-right text-[11px] leading-5" style={{ color: colors.textSecondary }}>{'Application #' + applicationId}</Text>
      </View>
    </ApplicationSection>
  );
}
