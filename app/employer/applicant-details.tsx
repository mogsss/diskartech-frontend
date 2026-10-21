import ApplicantDetailsContent, { ApplicantActionButton } from '@/components/employer/applicant-details/ApplicantDetailsContent';
import ApplicantDetailsModals from '@/components/employer/applicant-details/ApplicantDetailsModals';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { useApplicantActions } from '@/hooks/useApplicantActions';
import { useApplicantDetails } from '@/hooks/useApplicantDetails';
import { useApplicantDocuments } from '@/hooks/useApplicantDocuments';
import { useDarkMode } from '@/hooks/useDarkMode';
import { resolveMediaUrl } from '@/utils/media';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ApplicantDetailsScreen() {
  const { isDark, colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const { applicationId } = useLocalSearchParams<{ applicationId?: string }>();
  const details = useApplicantDetails(applicationId);
  const { application, setApplication, loading, student, contractReview, studentAddress, availableDaysText, isReviewable } = details;
  const actions = useApplicantActions({ applicationId, application, setApplication });
  const { busyAction, disabled } = actions;
  const documents = useApplicantDocuments({ applicationId, application, setApplication,
    showNotice: actions.showNotice, withBusyAction: actions.withBusyAction, closeWhenIdle: actions.closeWhenIdle });

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <SafeStatusBar backgroundColor={colors.background} style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (!application) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <SafeStatusBar backgroundColor={colors.background} style={isDark ? 'light' : 'dark'} />
        <Text className="font-semibold" style={{ color: colors.textSecondary }}>Application details not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.surface} style={isDark ? 'light' : 'dark'} withSpacer={false} />
      <View className="px-5 pb-3 border-b" style={{ paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} disabled={disabled} accessibilityRole="button" accessibilityLabel="Back" className="w-11 h-11 items-center justify-center">
            <MaterialIcons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text accessibilityRole="header" className="flex-1 text-base font-semibold" style={{ color: colors.text }}>Applicant details</Text>
          <TouchableOpacity onPress={actions.deleteApplication} disabled={disabled} accessibilityRole="button" accessibilityLabel="Delete application" accessibilityState={{ disabled, busy: busyAction === 'Delete' }} className="w-11 h-11 items-center justify-center" style={{ opacity: disabled ? 0.5 : 1 }}>
            {busyAction === 'Delete' ? <ActivityIndicator size="small" color="#DC2626" /> : <MaterialIcons name="delete-outline" size={20} color={isDark ? colors.accent : '#B91C1C'} />}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: isReviewable ? 12 : Math.max(insets.bottom, 20) }}>
        <ApplicantDetailsContent
          application={application}
          interviewAvailability={actions.interviewAvailability}
          contractReview={contractReview}
          avatarUri={resolveMediaUrl(student.avatar) ?? undefined}
          studentAddress={studentAddress}
          availableDaysText={availableDaysText}
          loadingCert={documents.loadingCertificate}
          approvingCert={documents.approvingCertificate}
          disabled={disabled}
          completing={busyAction === 'Complete'}
          messaging={busyAction === 'chat'}
          onMessage={actions.message}
          onComplete={actions.complete}
          onTerminate={actions.openTerminate}
          onReview={actions.review}
          onPreviewCertificate={documents.previewCertificate}
          onApproveCertificate={documents.openSignature}
          onDownloadCertificate={documents.downloadCertificate}
          onEditInterview={actions.prepareInterview}
          onJoinInterview={() => router.push({ pathname: '/online-interview-call', params: { applicationId: String(applicationId) } })}
          onOpenResume={documents.openResume}
        />
      </ScrollView>
      {isReviewable && <View className="border-t px-5 pt-3" style={{ backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }}>
        <Text className="text-[11px] leading-4 mb-2" style={{ color: colors.textSecondary }}>{details.status === 'interview' ? actions.interviewAvailability.hireMessage : 'Review this profile, then choose your next step.'}</Text>
        <View className="flex-row gap-3">
          <ApplicantActionButton label="Reject" variant="danger" size="large" onPress={actions.reject} disabled={disabled} loading={busyAction === 'Reject'} />
          <ApplicantActionButton
            label={details.status === 'interview' ? 'Hire applicant' : 'Invite for interview'}
            variant="primary"
            size="large"
            disabled={disabled || (details.status === 'interview' && !actions.interviewAvailability.canHire)}
            loading={busyAction === 'prepareInterview'}
            onPress={details.status === 'interview' ? actions.openHire : actions.prepareInterview}
          />
        </View>
      </View>}

      <ApplicantDetailsModals details={details} actions={actions} documents={documents} />
    </View>
  );
}
