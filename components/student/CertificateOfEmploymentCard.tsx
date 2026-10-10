import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';

interface CertificateOfEmploymentCardProps {
  certificateStatus?: string;
  loadingCert?: boolean;
  requestingCert?: boolean;
  onOpenCertificate: () => void;
  onDownloadPdf: () => void;
  onRequestCertificate: () => void;
}

export default function CertificateOfEmploymentCard({ certificateStatus, loadingCert, requestingCert, onOpenCertificate, onDownloadPdf, onRequestCertificate }: CertificateOfEmploymentCardProps) {
  const { colors, isDark } = useDarkMode();
  const isApproved = certificateStatus === 'approved';
  const isRequested = certificateStatus === 'requested';
  const accent = isDark ? colors.accent : '#B91C1C';
  const statusColor = isApproved ? (isDark ? '#6EE7B7' : '#047857') : colors.textSecondary;
  return (
    <ApplicationSection title="Certificate of employment" icon="workspace-premium">
      <View className="self-start rounded-lg px-2 py-1 mb-3" style={{ backgroundColor: isApproved ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5') : (isDark ? colors.background : '#F1F5F9') }}>
        <Text className="text-[10px] font-semibold" style={{ color: statusColor }}>{isApproved ? 'Issued & ready' : isRequested ? 'Pending approval' : 'Available to request'}</Text>
      </View>
      <Text className="text-xs leading-5 mb-3" style={{ color: colors.textSecondary }}>Official proof of your employment for school verification, scholarship submissions, and academic endorsements.</Text>
      {isApproved ? (
        <View className="gap-3">
          <View className="flex-row items-start gap-2">
            <MaterialIcons name="check-circle-outline" size={17} color={statusColor} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-xs leading-5" style={{ color: colors.text }}>Your certificate has been approved and signed by the employer.</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={onOpenCertificate} disabled={loadingCert} accessibilityRole="button" accessibilityLabel="View certificate" accessibilityState={{ disabled: loadingCert, busy: loadingCert }} activeOpacity={0.7} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-2 py-3" style={{ minHeight: 44, borderColor: colors.border, backgroundColor: isDark ? colors.background : '#F8FAFC', opacity: loadingCert ? 0.5 : 1 }}>
              {loadingCert ? <ActivityIndicator size="small" color={accent} /> : <>
                <MaterialIcons name="visibility" size={17} color={colors.textSecondary} />
                <Text className="text-xs font-semibold" style={{ color: colors.text }}>View</Text>
              </>}
            </TouchableOpacity>
            <TouchableOpacity onPress={onDownloadPdf} accessibilityRole="button" accessibilityLabel="Download certificate PDF" activeOpacity={0.8} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-red-600 px-2 py-3" style={{ minHeight: 44 }}>
              <MaterialIcons name="file-download" size={17} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">Download PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : isRequested ? (
        <View className="flex-row items-start gap-2 rounded-xl border p-3" style={{ backgroundColor: isDark ? colors.background : '#F8FAFC', borderColor: colors.border }}>
          <MaterialIcons name="hourglass-empty" size={17} color={colors.textSecondary} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>Your request has been sent. You will be notified once the certificate is signed.</Text>
        </View>
      ) : (
        <TouchableOpacity onPress={onRequestCertificate} disabled={requestingCert} accessibilityRole="button" accessibilityLabel="Request certificate of employment" accessibilityState={{ disabled: requestingCert, busy: requestingCert }} activeOpacity={0.8} className="flex-row items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-3" style={{ minHeight: 44, opacity: requestingCert ? 0.5 : 1 }}>
          {requestingCert ? <ActivityIndicator size="small" color="#FFFFFF" /> : <>
            <MaterialIcons name="description" size={17} color="#FFFFFF" />
            <Text className="text-xs font-semibold text-white">Request certificate</Text>
          </>}
        </TouchableOpacity>
      )}
    </ApplicationSection>
  );
}
