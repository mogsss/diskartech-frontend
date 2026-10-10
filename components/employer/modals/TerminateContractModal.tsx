import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import NotificationModal from '@/components/ui/modals/NotificationModal';

interface TerminateContractModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
  studentName?: string;
  jobTitle?: string;
  notification?: React.ReactNode;
}

const REASON_PRESETS = [
  'Project Completed / Work Concluded',
  'Mutual Agreement',
  'Student Schedule Conflict',
  'Breach of Contract Terms',
  'Performance Concerns',
  'Hirer Operational Change',
];

export default function TerminateContractModal({
  visible,
  onClose,
  onSubmit,
  studentName = 'Student',
  jobTitle = 'Job Position',
  notification,
}: TerminateContractModalProps) {
  const { isDark, colors } = useDarkMode();
  const [selectedReason, setSelectedReason] = useState(REASON_PRESETS[0]);
  const [confirmedSettle, setConfirmedSettle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  useEffect(() => {
    if (visible) { setSelectedReason(REASON_PRESETS[0]); setConfirmedSettle(false); }
    else setNoticeMessage('');
  }, [visible]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!confirmedSettle) {
      setNoticeMessage('Please check the box confirming that you wish to terminate the contract and settle any outstanding obligations.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(selectedReason);
    } catch (e) {
      console.error('Error terminating contract:', e);
      setNoticeMessage('Unable to terminate the contract at this time. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={() => { if (!isSubmitting) onClose(); }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
      >
        <View 
          className="rounded-t-[32px] p-6 w-full shadow-2xl max-h-[85%] border-t"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b" style={{ borderColor: colors.border }}>
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <View 
                className="w-10 h-10 rounded-2xl items-center justify-center border"
                style={{ 
                  backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
                  borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'
                }}
              >
                <MaterialIcons name="gavel" size={22} color={colors.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold" numberOfLines={1} style={{ color: colors.text }}>
                  Terminate Contract
                </Text>
                <Text className="text-xs" numberOfLines={1} style={{ color: colors.textSecondary }}>
                  {studentName} • {jobTitle}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              disabled={isSubmitting}
              className="p-1 rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }}
            >
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mt-3">
            {/* Warning Alert */}
            <View 
              className="rounded-2xl p-3.5 mb-4 flex-row items-start gap-2.5 border"
              style={{ 
                backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'
              }}
            >
              <MaterialIcons name="warning-amber" size={20} color={colors.accent} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-xs font-bold" style={{ color: isDark ? colors.accent : '#991B1B' }}>
                  Contract Termination Notice
                </Text>
                <Text className="text-xs mt-0.5 leading-4" style={{ color: isDark ? '#FECACA' : '#B91C1C' }}>
                  Terminating this contract will change the student&apos;s status to Terminated and officially close the job engagement.
                </Text>
              </View>
            </View>

            {/* Reason Selection */}
            <Text className="text-xs font-semibold mb-2" style={{ color: colors.text }}>Reason for Termination</Text>
            <View className="flex-row flex-wrap gap-2 mb-3.5">
              {REASON_PRESETS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setSelectedReason(reason)}
                    className="px-3 py-2 rounded-xl border"
                    style={{
                      backgroundColor: isSelected
                        ? isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2'
                        : isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                      borderColor: isSelected ? '#DC2626' : colors.border,
                    }}
                  >
                    <Text
                      className="text-xs"
                      style={{
                        color: isSelected ? (isDark ? colors.accent : '#B91C1C') : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      }}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Settle Obligations Checkbox */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setConfirmedSettle(!confirmedSettle)}
              className="flex-row items-start gap-2.5 p-3 rounded-2xl mb-4 border"
              style={{
                backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB',
                borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : '#FDE68A',
              }}
            >
              <MaterialIcons
                name={confirmedSettle ? 'check-box' : 'check-box-outline-blank'}
                size={20}
                color="#D97706"
                style={{ marginTop: 1 }}
              />
              <Text className="text-xs flex-1 leading-4" style={{ color: isDark ? '#FDE68A' : '#78350F' }}>
                I confirm that all agreed compensation and work hours have been accounted for, and I authorize the formal termination of this contract.
              </Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 24, paddingTop: 8 }}>
              <TouchableOpacity
                onPress={onClose}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Keep Contract</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
                style={{
                  flex: 1.8,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: '#DC2626',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  paddingHorizontal: 12,
                }}
              >
                {isSubmitting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                      Processing...
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="gavel" size={17} color="#FFFFFF" />
                    <Text
                      numberOfLines={1}
                      style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}
                    >
                      Confirm Termination
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      {notification}
      <NotificationModal
        visible={visible && Boolean(noticeMessage)}
        title="Notice"
        message={noticeMessage}
        iconName="error-outline"
        onPrimaryPress={() => setNoticeMessage('')}
      />
    </Modal>
  );
}
