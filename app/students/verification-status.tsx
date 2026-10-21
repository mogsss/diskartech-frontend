import LoadingModal from '@/components/ui/modals/LoadingModal';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getDocumentAnalysisStatus, normalizeAiResult } from '@/utils/documentAnalysis';
import { getUploadRateLimitNotice } from '@/utils/uploadRateLimit';
import { useToast } from '@/hooks/useToast';

type DocumentType = 'school_id' | 'coe' | 'student_resume';
type AiResults = { school_id: boolean | null; coe: boolean | null };

export default function StudentVerificationStatusScreen() {
  const { isDark, colors } = useDarkMode();
  const { showToast } = useToast();
  const [hasSchoolId, setHasSchoolId] = useState(false);
  const [hasCoe, setHasCoe] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [aiResults, setAiResults] = useState<AiResults>({ school_id: null, coe: null });
  const uploadBusy = useRef(false);
  const profileRevision = useRef(0);

  const checkVerificationDocs = useCallback(async (isBackground = false) => {
    if (uploadBusy.current) return;
    const revision = profileRevision.current;
    try {
      const response = await api.get('/user/profile');
      if (uploadBusy.current || revision !== profileRevision.current) return;
      const profile = response.data?.profile;
      if (!profile) throw new Error('Profile unavailable');
      setHasSchoolId(!!profile.school_id);
      setHasCoe(!!profile.coe);
      setHasResume(!!profile.student_resume);
      setRejectionReason(profile.rejection_reason || null);
      setIsVerified(profile.isVerified === 1 || profile.isVerified === true || profile.isVerified === '1');
      setAiResults({ school_id: normalizeAiResult(profile.school_id_ai_is_valid), coe: normalizeAiResult(profile.coe_ai_is_valid) });
      setHasProfile(true);
      setLoadError(false);
      try { await AsyncStorage.setItem('userProfile', JSON.stringify(profile)); }
      catch { console.warn('Unable to cache the latest verification profile.'); }
    } catch (error) {
      if (uploadBusy.current || revision !== profileRevision.current) return;
      if (!isBackground) console.error('Error checking student verification status:', error);
      setLoadError(true);
    } finally { if (!uploadBusy.current && revision === profileRevision.current) setLoading(false); }
  }, []);

  useEffect(() => {
    checkVerificationDocs();
    const interval = setInterval(() => checkVerificationDocs(true), 3000);
    return () => clearInterval(interval);
  }, [checkVerificationDocs]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await checkVerificationDocs(); } finally { setRefreshing(false); }
  };

  const handleUploadDocument = async (documentType: DocumentType) => {
    if (uploadBusy.current || (isVerified && documentType !== 'student_resume')) return;
    uploadBusy.current = true;
    profileRevision.current += 1;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size && file.size > 5 * 1024 * 1024) {
        showToast({ type: 'warning', title: 'File too large', message: 'Please choose a PDF, JPG or PNG file no larger than 5 MB.' });
        return;
      }
      setIsUploading(true);
      const formData = new FormData();
      formData.append('document_type', documentType);
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
      const response = await api.post('/student/upload-doc', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (response.data?.status !== 'success') throw new Error(response.data?.message || 'Unable to upload this document.');
      if (documentType === 'school_id') setHasSchoolId(true);
      if (documentType === 'coe') setHasCoe(true);
      if (documentType === 'student_resume') setHasResume(true);
      if (documentType !== 'student_resume') {
        setRejectionReason(null);
        setIsVerified(false);
        setAiResults((current) => ({ ...current, [documentType]: null }));
      }
      showToast({ type: 'success', title: 'Document uploaded', message: 'Your document has been uploaded successfully.' });
    } catch (error: any) {
      const validationErrors = error.response?.data?.errors;
      const firstValidation = validationErrors ? Object.values(validationErrors).flat().find((message) => typeof message === 'string') : null;
      const message = firstValidation || error.response?.data?.message || error.message || 'Please check your connection and try again.';
      const cooldown = getUploadRateLimitNotice(error);
      showToast({ type: cooldown ? 'warning' : 'error', title: cooldown?.title ?? 'Upload failed', message: cooldown?.message ?? String(message) });
    } finally {
      uploadBusy.current = false;
      setIsUploading(false);
      void checkVerificationDocs(true);
    }
  };

  const isRejected = !isVerified && !!rejectionReason;
  const isSubmitted = !isVerified && hasSchoolId && hasCoe && !isRejected;
  const documentsComplete = hasSchoolId && hasCoe;
  const accentText = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const subtle = isDark ? '#263449' : '#F1F5F9';
  const verifiedColor = isDark ? '#6EE7B7' : '#15803D';
  const verifiedSurface = isDark ? 'rgba(110, 231, 183, 0.12)' : '#F0FDF4';
  const pendingText = isDark ? '#FCD34D' : '#B45309';
  const pendingSurface = isDark ? '#422F16' : '#FFFBEB';
  const statusColor = isVerified ? verifiedColor : isRejected ? accentText : isSubmitted ? pendingText : colors.textSecondary;
  const statusSurface = isVerified ? verifiedSurface : isRejected ? accentSurface : isSubmitted ? pendingSurface : subtle;
  const statusIcon: keyof typeof MaterialIcons.glyphMap = isVerified ? 'verified' : isRejected ? 'error-outline' : isSubmitted ? 'hourglass-empty' : 'assignment-late';
  const statusTitle = isVerified ? 'Account verified' : isRejected ? 'Update your documents' : isSubmitted ? 'Waiting for approval' : 'Documents required';
  const statusDescription = isVerified ? 'Your student account is verified. You can now apply for jobs.' : isRejected ? 'Review the reason below and upload the documents needed for another review.' : isSubmitted ? 'Your School ID and COR / COE have been submitted for verification. The latest status will appear here.' : 'Upload your valid School ID and Certificate of Enrollment (COR / COE) to verify your student account.';
  const steps = [
    { title: 'Submit documents', detail: documentsComplete || isVerified ? 'Required documents uploaded.' : `${Number(hasSchoolId) + Number(hasCoe)} of 2 required documents uploaded.`, done: documentsComplete || isVerified, active: !documentsComplete && !isVerified, failed: false },
    { title: isRejected ? 'Update documents' : 'Document review', detail: isVerified ? 'Your documents have been approved.' : isRejected ? 'Check the reason above.' : isSubmitted ? 'Waiting for verification approval.' : 'Begins after the required documents are uploaded.', done: isVerified, active: isSubmitted, failed: isRejected },
    { title: 'Verified account', detail: isVerified ? 'You can apply for student jobs.' : 'Job applications unlock after approval.', done: isVerified, active: false, failed: false },
  ];

  const renderDocument = (type: DocumentType, title: string, icon: keyof typeof MaterialIcons.glyphMap, uploaded: boolean, optional = false) => {
    const editable = optional || !isVerified;
    const status = type === 'student_resume' ? null : getDocumentAnalysisStatus(type, uploaded, aiResults[type]);
    const needsUpdate = !optional && isRejected;
    const color = status?.verdict === 'invalid' ? accentText : status?.verdict === 'pending' ? pendingText : uploaded ? verifiedColor : colors.textSecondary;
    const fill = status?.verdict === 'invalid' ? accentSurface : status?.verdict === 'pending' ? pendingSurface : uploaded ? verifiedSurface : subtle;
    const documentStatusIcon: keyof typeof MaterialIcons.glyphMap = status?.verdict === 'invalid' ? 'error-outline' : status?.verdict === 'pending' ? 'hourglass-empty' : uploaded ? 'check-circle-outline' : 'upload-file';
    return (
      <View className="rounded-2xl border p-4 mt-3" style={{ borderColor: colors.border }}>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: fill }}><MaterialIcons name={icon} size={20} color={color} /></View>
          <View className="flex-1"><Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{title}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{optional ? 'Optional for verification' : 'Required for verification'}</Text></View>
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2 mt-3">
          <View className="flex-row items-center gap-1.5 shrink">
            <MaterialIcons name={documentStatusIcon} size={16} color={color} />
            <Text className="text-xs font-medium leading-5 shrink" style={{ color }}>{status?.label ?? (uploaded ? 'Uploaded' : 'Not uploaded')}</Text>
          </View>
          {editable && <TouchableOpacity onPress={() => handleUploadDocument(type)} disabled={isUploading} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${uploaded ? 'Replace' : 'Upload'} ${title}`} accessibilityState={{ disabled: isUploading }} className="min-h-12 flex-row items-center gap-1.5 rounded-xl px-3 ml-auto" style={{ backgroundColor: accentSurface, opacity: isUploading ? 0.5 : 1 }}><MaterialIcons name={uploaded ? 'sync' : 'file-upload'} size={16} color={accentText} /><Text className="text-xs font-semibold" style={{ color: accentText }}>{needsUpdate ? 'Re-upload' : uploaded ? 'Replace' : 'Upload'}</Text></TouchableOpacity>}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center shrink-0 px-6 pt-2 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Go back" className="w-12 h-12 items-center justify-center"><MaterialIcons name="arrow-back" size={23} color={colors.text} /></TouchableOpacity>
        <Text className="flex-1 text-xl font-bold tracking-tight" style={{ color: colors.text }}>Verification status</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center pt-2 pb-6" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        {loading || !hasProfile ? (
          <View className="mx-6 rounded-3xl border px-6 py-8 items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {loading ? <ActivityIndicator size="large" color={colors.primary} /> : <MaterialIcons name="wifi-off" size={32} color={accentText} />}
            <Text className="text-lg font-bold text-center mt-4" style={{ color: colors.text }}>{loading ? 'Checking verification' : 'Unable to load verification status'}</Text>
            <Text className="text-sm leading-6 text-center mt-2" style={{ color: colors.textSecondary }}>{loading ? 'Getting your latest account and document status.' : 'Check your connection and try again.'}</Text>
            {!loading && <TouchableOpacity onPress={onRefresh} accessibilityRole="button" activeOpacity={0.75} disabled={refreshing} className="min-h-12 px-4 rounded-xl items-center justify-center mt-5" style={{ backgroundColor: accentSurface }}><Text className="text-sm font-semibold" style={{ color: accentText }}>{refreshing ? 'Checking...' : 'Try again'}</Text></TouchableOpacity>}
          </View>
        ) : (
          <>
            {loadError && <TouchableOpacity onPress={onRefresh} accessibilityRole="button" activeOpacity={0.75} className="mx-6 mb-4 flex-row items-center gap-2 rounded-xl p-3" style={{ backgroundColor: accentSurface }}><MaterialIcons name="refresh" size={18} color={accentText} /><Text className="flex-1 text-xs leading-5" style={{ color: accentText }}>Could not refresh the latest status. Tap to retry.</Text></TouchableOpacity>}
            <View className="mx-6 mb-4 rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View className="w-20 h-20 self-center rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: statusSurface }}><MaterialIcons name={statusIcon} size={44} color={statusColor} /></View>
              <Text className="text-xl font-bold leading-7 text-center" style={{ color: isVerified ? verifiedColor : colors.text }}>{statusTitle}</Text>
              <Text className="text-sm leading-6 mt-2 text-center" style={{ color: colors.textSecondary }}>{statusDescription}</Text>
            </View>
            {isRejected && <View className="mx-6 mb-4 rounded-2xl p-4" style={{ backgroundColor: accentSurface }}><View className="flex-row items-center gap-2 mb-2"><Text className="text-sm font-semibold" style={{ color: accentText }}>Reason : </Text></View><Text className="text-sm leading-6" style={{ color: accentText }}>{rejectionReason}</Text></View>}
            <View className="mx-6 mb-4 rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text className="text-lg font-bold mb-4" style={{ color: colors.text }}>Verification progress</Text>
              {steps.map((step, index) => {
                const color = step.done ? verifiedColor : step.failed ? accentText : step.active ? (index === 0 ? accentText : pendingText) : colors.textSecondary;
                const fill = step.done ? verifiedSurface : step.failed ? accentSurface : step.active ? (index === 0 ? accentSurface : pendingSurface) : subtle;
                return <View key={index} className="flex-row gap-3"><View className="w-8 items-center"><View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: fill }}>{step.done || step.failed || (step.active && index === 1) ? <MaterialIcons name={step.done ? 'check' : step.failed ? 'close' : 'schedule'} size={17} color={color} /> : <Text className="text-xs font-semibold" style={{ color }}>{index + 1}</Text>}</View>{index < steps.length - 1 && <View className="w-0.5 flex-1 my-1" style={{ backgroundColor: step.done ? verifiedColor : colors.border }} />}</View><View className={index < steps.length - 1 ? 'flex-1 pb-5' : 'flex-1'}><Text className="text-sm font-semibold leading-5" style={{ color: step.done ? verifiedColor : colors.text }}>{step.title}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{step.detail}</Text></View></View>;
              })}
            </View>
            <View className="mx-6 rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text className="text-lg font-bold" style={{ color: colors.text }}>Documents</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>School ID and COR / COE are required. Your resume is optional.</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>AI checks help with review. Final account approval is by an admin.</Text>
              {renderDocument('school_id', 'School ID', 'badge', hasSchoolId)}
              {renderDocument('coe', 'Certificate of Enrolment (COR / COE)', 'insert-drive-file', hasCoe)}
              {renderDocument('student_resume', 'Student resume', 'description', hasResume, true)}
              <View className="flex-row items-start gap-2 mt-4"><MaterialIcons name="info-outline" size={16} color={colors.textSecondary} /><Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>Accepted files: PDF, JPG or PNG. Maximum file size: 5 MB.</Text></View>
            </View>
          </>
        )}
      </ScrollView>
      <LoadingModal visible={isUploading} message="Uploading document..." />
    </View>
  );
}
