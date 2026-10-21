import React from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate } from '@/utils/helpers';
import {
  JobMetricsOverview,
  JobScheduleCard,
  JobDescriptionCard,
  JobRequirementsCard,
  JobSkillsCard,
} from '@/components/employer/job-details/JobDetailsCards';
import { JobActionsBar } from '@/components/employer/job-details/JobActionsBar';
import { useDarkMode } from '@/hooks/useDarkMode';

interface JobDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  job: any | null;
  onJobUpdated?: () => void;
}

function parseList(value: unknown): string[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim())
    : [];
}

export default function JobDetailsModal({ visible, onClose, job, onJobUpdated }: JobDetailsModalProps) {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();

  if (!job) return null;

  const status = String(job.status ?? '').toLowerCase().trim();
  const isActive = !['closed', 'inactive', 'archived', '0', 'false'].includes(status);
  const statusLabel = isActive ? 'Active' : status === 'archived' ? 'Archived' : status === 'inactive' ? 'Inactive' : 'Closed';
  const statusColor = isActive ? (isDark ? '#6EE7B7' : '#047857') : colors.textSecondary;
  const rawApplicantCount = Number(job.applications_count ?? (Array.isArray(job.applications) ? job.applications.length : 0));
  const applicantCount = Number.isFinite(rawApplicantCount) ? Math.max(0, rawApplicantCount) : 0;
  const postedDate = job.created_at && !Number.isNaN(new Date(job.created_at).getTime()) ? formatDate(job.created_at) : null;

  const handleViewApplicants = () => {
    onClose();
    router.push({
      pathname: '/employer/applicants-list',
      params: { jobId: String(job.id), jobTitle: job.title },
    });
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close job details"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <View
          style={{ height: '90%', backgroundColor: colors.surface, borderColor: colors.border, borderTopWidth: 1 }}
          className="rounded-t-[28px] overflow-hidden"
        >
          <View className="px-5 pt-3 pb-3 border-b" style={{ borderBottomColor: colors.border }}>
            <View className="w-9 h-1 rounded-full self-center mb-3" style={{ backgroundColor: colors.border }} />
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-semibold tracking-widest" style={{ color: colors.textSecondary }}>JOB DETAILS</Text>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Dismiss job details"
                activeOpacity={0.7}
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
              >
                <MaterialIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="mb-5">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="px-2.5 py-1.5 rounded-lg" style={{ maxWidth: '70%', backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
                  <Text className="text-[11px] font-medium" style={{ color: colors.textSecondary }} numberOfLines={1}>{job.category || 'General'}</Text>
                </View>
                <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: isActive ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5') : (isDark ? colors.background : '#F1F5F9') }}>
                  <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                  <Text className="text-[10px] font-semibold" style={{ color: statusColor }}>{statusLabel}</Text>
                </View>
              </View>
              <Text className="text-2xl font-bold tracking-tight leading-8" style={{ color: colors.text }}>{job.title}</Text>
              {postedDate && (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <MaterialIcons name="event" size={13} color={colors.textSecondary} />
                  <Text className="text-[11px]" style={{ color: colors.textSecondary }}>{'Posted ' + postedDate}</Text>
                </View>
              )}
            </View>

            <JobMetricsOverview rate={job.salary} salaryType={job.salary_type} applicantCount={applicantCount} onViewApplicants={handleViewApplicants} />
            <JobScheduleCard availableDays={job.available_days} timeSlot={job.time_slot} slots={job.schedule_slots} />
            <JobDescriptionCard description={job.description} />
            <JobRequirementsCard requirements={parseList(job.requirements)} />
            <JobSkillsCard skills={parseList(job.skills)} />
          </ScrollView>

          <View className="px-5" style={{ paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.surface }}>
            <JobActionsBar job={job} isActive={isActive} onClose={onClose} onJobUpdated={onJobUpdated} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
