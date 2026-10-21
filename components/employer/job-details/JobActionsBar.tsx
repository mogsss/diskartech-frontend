import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '@/api/axios';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useToast } from '@/hooks/useToast';
import { jobQuotaError } from '@/utils/jobQuota';

interface JobActionsBarProps {
  job: any;
  isActive: boolean;
  onClose: () => void;
  onJobUpdated?: () => void;
}

export function JobActionsBar({ job, isActive, onClose, onJobUpdated }: JobActionsBarProps) {
  const { colors, isDark } = useDarkMode();
  const { showToast } = useToast();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof MaterialIcons.glyphMap;
    iconColor?: string;
    iconBgColor?: string;
    primaryButtonText?: string;
    onPrimaryPress: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }>({ visible: false, title: '', message: '', onPrimaryPress: () => {} });

  const closeNotification = () => setNotification((prev) => ({ ...prev, visible: false }));

  const showSuccess = (title: string, message: string, onDone?: () => void) => {
    setNotification({
      visible: true,
      title,
      message,
      iconName: 'check-circle',
      iconColor: '#16A34A',
      iconBgColor: isDark ? 'rgba(22, 163, 74, 0.15)' : 'bg-emerald-50',
      primaryButtonText: 'Done',
      onPrimaryPress: () => { closeNotification(); onDone?.(); },
    });
  };

  const showError = (title: string, message: string) => {
    setNotification({
      visible: true,
      title,
      message,
      iconName: 'error-outline',
      iconColor: '#DC2626',
      iconBgColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'bg-red-50',
      primaryButtonText: 'OK',
      onPrimaryPress: closeNotification,
    });
  };

  const showConfirm = (
    title: string,
    message: string,
    primaryText: string,
    onConfirm: () => void,
    iconName: keyof typeof MaterialIcons.glyphMap = 'lock'
  ) => {
    setNotification({
      visible: true,
      title,
      message,
      iconName,
      iconColor: '#DC2626',
      iconBgColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'bg-red-50',
      primaryButtonText: primaryText,
      onPrimaryPress: onConfirm,
      secondaryButtonText: 'Cancel',
      onSecondaryPress: closeNotification,
    });
  };

  const executeToggleStatus = async (nextStatus: 'active' | 'closed') => {
    closeNotification();
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/employer/jobs/${job.id}/status`, { status: nextStatus });
      if (res.data?.status === 'success') {
        showSuccess(
          'Status Updated',
          nextStatus === 'closed'
            ? 'This job listing has been closed. It will no longer accept new candidate applications.'
            : 'This job listing has been reopened and is now accepting candidate applications.',
          () => { onJobUpdated?.(); onClose(); }
        );
      } else {
        showError('Notice', res.data?.message || 'Unable to update job status at this time.');
      }
    } catch (e: any) {
      const quotaError = e.response?.status === 422 ? jobQuotaError(e.response?.data) : null;
      showError(quotaError ? 'Active job limit reached' : 'Error', quotaError || e.response?.data?.message || 'Unable to update job status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleStatus = () => {
    const nextStatus = isActive ? 'closed' : 'active';
    showConfirm(
      isActive ? 'Close Job Listing' : 'Reopen Job Listing',
      isActive
        ? 'Are you sure you want to close this job opening? Students will no longer be able to submit new applications.'
        : 'Do you want to reopen this job opening? It will immediately become visible to active student candidates.',
      isActive ? 'Yes, Close Listing' : 'Yes, Reopen Listing',
      () => executeToggleStatus(nextStatus),
      isActive ? 'lock-outline' : 'replay'
    );
  };

  const executeDeleteJob = async () => {
    closeNotification();
    setDeleting(true);
    try {
      const res = await api.delete(`/jobs/${job.id}`);
      if (res.data?.status === 'success') {
        showToast({ type: 'success', title: 'Listing deleted', message: 'Your job listing has been deleted successfully.' });
        onJobUpdated?.();
        onClose();
      } else {
        showError('Notice', res.data?.message || 'Unable to delete job listing.');
      }
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Unable to delete this listing.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteJob = () => {
    showConfirm(
      'Delete Job Listing',
      'Are you sure you want to permanently delete this job opening? All submitted candidate records for this job will also be removed. This action cannot be reversed.',
      'Delete Permanently',
      executeDeleteJob,
      'delete-forever'
    );
  };

  const handleEditJob = () => {
    onClose();
    router.push({
      pathname: '/employer/job-posting',
      params: { jobId: String(job.id), ...(type ? { type } : {}) },
    });
  };

  const busy = updatingStatus || deleting;
  const accentColor = isDark ? colors.accent : '#B91C1C';

  return (
    <>
      <View className="border-t pt-3" style={{ borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handleEditJob}
          accessibilityRole="button"
          accessibilityLabel="Edit job details"
          disabled={busy}
          activeOpacity={0.8}
          className="flex-row items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-600"
          style={{ minHeight: 48, opacity: busy ? 0.5 : 1 }}
        >
          <MaterialIcons name="edit" size={18} color="#FFFFFF" />
          <Text className="text-sm font-semibold text-white">Edit details</Text>
        </TouchableOpacity>
        <View className="flex-row gap-2 mt-2">
          <TouchableOpacity
            onPress={handleToggleStatus}
            accessibilityRole="button"
            accessibilityLabel={isActive ? 'Close listing' : 'Reopen listing'}
            disabled={busy}
            activeOpacity={0.8}
            className="flex-1 flex-row items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border"
            style={{ minHeight: 48, backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border, opacity: busy ? 0.5 : 1 }}
          >
            {updatingStatus ? <ActivityIndicator size="small" color={colors.text} /> : (
              <>
                <MaterialIcons name={isActive ? 'lock-outline' : 'replay'} size={18} color={colors.textSecondary} />
                <Text className="text-[13px] font-semibold" style={{ color: colors.text }}>{isActive ? 'Close job' : 'Reopen job'}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteJob}
            accessibilityRole="button"
            accessibilityLabel="Delete listing"
            disabled={busy}
            activeOpacity={0.7}
            className="flex-1 flex-row items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border"
            style={{
              minHeight: 48,
              backgroundColor: isDark ? 'rgba(220, 38, 38, 0.08)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(248, 113, 113, 0.25)' : '#FECACA',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {deleting ? <ActivityIndicator size="small" color={accentColor} /> : (
              <>
                <MaterialIcons name="delete-outline" size={18} color={accentColor} />
                <Text className="text-[13px] font-semibold" style={{ color: accentColor }}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <NotificationModal
        visible={notification.visible}
        title={notification.title}
        message={notification.message}
        iconName={notification.iconName}
        iconColor={notification.iconColor}
        iconBgColor={notification.iconBgColor}
        primaryButtonText={notification.primaryButtonText}
        onPrimaryPress={notification.onPrimaryPress}
        secondaryButtonText={notification.secondaryButtonText}
        onSecondaryPress={notification.onSecondaryPress}
      />
    </>
  );
}
