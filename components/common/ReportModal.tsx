import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import api from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetName?: string;
  targetType?: 'job' | 'employer' | 'user';
  jobId?: number | string | null;
  reportedUserId?: number | string | null;
  onSuccess?: () => void;
  onAlreadyReported?: (message: string) => void;
}

const REPORT_REASONS = [
  { key: 'scam', label: 'Scam or Fraud', icon: 'security' },
  { key: 'fake_job', label: 'Fake Job or Inaccurate Info', icon: 'error-outline' },
  { key: 'underpaid', label: 'Underpaid / Rate Discrepancy', icon: 'payments' },
  { key: 'abuse', label: 'Abuse or Harassment', icon: 'person-outline' },
  { key: 'unsafe', label: 'Unsafe Workplace', icon: 'health-and-safety' },
  { key: 'other', label: 'Other Concern', icon: 'help-outline' },
] as const;

export default function ReportModal({
  visible,
  onClose,
  targetName,
  targetType = 'job',
  jobId,
  reportedUserId,
  onSuccess,
  onAlreadyReported,
}: ReportModalProps) {
  const { colors, isDark } = useDarkMode();
  const [selectedReason, setSelectedReason] = useState<string>('scam');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required Field', 'Please provide a brief explanation of the issue.');
      return;
    }

    try {
      setSubmitting(true);
      const selectedReasonObj = REPORT_REASONS.find((r) => r.key === selectedReason);
      const subject = `${selectedReasonObj?.label || 'Incident Report'} - ${targetName || 'DiskarTech'}`;

      const response = await api.post('/reports', {
        job_id: jobId || null,
        reported_user_id: reportedUserId || null,
        report_type: selectedReason,
        subject,
        description: description.trim(),
      });

      if (response.data && response.data.status === 'already_reported') {
        setDescription('');
        onClose();
        if (onAlreadyReported) {
          onAlreadyReported(response.data.message);
        } else {
          Alert.alert('Report Already Submitted', response.data.message);
        }
        return;
      }

      if (response.data && response.data.status === 'success') {
        setDescription('');
        setSelectedReason('scam');
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          Alert.alert(
            'Report Submitted',
            'Thank you for reporting this issue. Our safety and moderation team will review this incident promptly.'
          );
        }
      }
    } catch (error: any) {
      console.error('Error submitting report:', error);
      const msg = error.response?.data?.message || 'Unable to submit report. Please try again.';
      Alert.alert('Submission Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setDescription('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            width: '100%',
            maxWidth: 420,
            padding: 24,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingBottom: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="outlined-flag" size={20} color={colors.text} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>
                  Report {targetType === 'job' ? 'Job Listing' : 'Hirer'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              disabled={submitting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
            {/* Reason Selection */}
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Select Incident Reason
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {REPORT_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.key;
                return (
                  <TouchableOpacity
                    key={reason.key}
                    onPress={() => setSelectedReason(reason.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      backgroundColor: isSelected
                        ? (isDark ? 'rgba(220, 38, 38, 0.2)' : '#FFF1F2')
                        : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC'),
                      borderColor: isSelected ? '#DC2626' : colors.border,
                    }}
                  >
                    <MaterialIcons
                      name={reason.icon as any}
                      size={14}
                      color={isSelected ? '#DC2626' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? 'bold' : 'normal',
                        color: isSelected ? (isDark ? colors.accent : '#BE123C') : colors.text,
                      }}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Please tell more
            </Text>
            <TextInput
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what occurred, discrepancies in rate, or safety issues..."
              placeholderTextColor={colors.textSecondary}
              textAlignVertical="top"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 14,
                fontSize: 12,
                color: colors.text,
                marginBottom: 8,
                height: 110,
              }}
            />
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 16 }}>
              Your report will be reviewed confidentially by DiskarTech administrators.
            </Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity
              onPress={handleClose}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: '#DC2626',
                borderRadius: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="send" size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
