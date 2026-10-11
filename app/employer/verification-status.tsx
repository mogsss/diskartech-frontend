import LoadingModal from '@/components/ui/modals/LoadingModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useState, useCallback, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';

type DocumentType = 'valid_id_path' | 'certificate_path';
type VerificationProfile = {
  valid_id_path?: string | null;
  employer_certificate_path?: string | null;
  rejection_reason?: string | null;
  isVerified?: boolean | number | string;
  ai_is_valid?: boolean | number | string | null;
  cert_ai_is_valid?: boolean | number | string | null;
};
type IconName = keyof typeof MaterialIcons.glyphMap;

const normalizeAiResult = (value: unknown): boolean | null => {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return null;
};

const fileTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', heic: 'image/heic',
  heif: 'image/heif', bmp: 'image/bmp', pdf: 'application/pdf',
};

const cacheProfile = async (latest: VerificationProfile) => {
  try { await AsyncStorage.setItem('userProfile', JSON.stringify(latest)); }
  catch { /* A cache failure must not report a successful upload as failed. */ }
};

export default function VerificationStatusScreen() {
  const { isDark, colors } = useDarkMode();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';
  const [profile, setProfile] = useState<VerificationProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{
    visible: boolean; title: string; message: string; iconName: IconName; iconColor: string;
  }>({ visible: false, title: '', message: '', iconName: 'info-outline', iconColor: '#DC2626' });
  const focused = useRef(false);
  const uploadBusy = useRef(false);
  const profileRevision = useRef(0);
  const pendingRequest = useRef<AbortController | null>(null);

  const checkVerificationDocs = useCallback(async () => {
    if (!focused.current || pendingRequest.current || uploadBusy.current) return;
    const request = new AbortController();
    const revision = profileRevision.current;
    pendingRequest.current = request;
    try {
      const response = await api.get('/user/profile', { signal: request.signal, timeout: 15000 });
      const latest = response.data?.profile;
      if (!latest || typeof latest !== 'object') throw new Error('Profile unavailable');
      if (request.signal.aborted || !focused.current || revision !== profileRevision.current) return;
      setProfile(latest);
      setLoadError(false);
      await cacheProfile(latest);
    } catch {
      if (!request.signal.aborted && focused.current && revision === profileRevision.current) setLoadError(true);
    } finally {
      if (pendingRequest.current === request) pendingRequest.current = null;
      if (!request.signal.aborted && focused.current && revision === profileRevision.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void checkVerificationDocs();
    const interval = setInterval(() => { void checkVerificationDocs(); }, 3000);
    return () => {
      focused.current = false;
      clearInterval(interval);
      pendingRequest.current?.abort();
      pendingRequest.current = null;
    };
  }, [checkVerificationDocs]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await checkVerificationDocs(); } finally { setRefreshing(false); }
  };

  const hasValidId = !!profile?.valid_id_path;
  const hasCertificate = !!profile?.employer_certificate_path;
  const isVerified = normalizeAiResult(profile?.isVerified) === true;
  const rejectionReason = profile?.rejection_reason || null;
  const isRejected = !isVerified && !!rejectionReason;
  const documentsComplete = hasValidId && (isHousehold || hasCertificate);
  const isSubmitted = !isVerified && documentsComplete && !isRejected;
  const documentCount = Number(hasValidId) + (isHousehold ? 0 : Number(hasCertificate));

  const handleUploadDocument = async (documentType: DocumentType) => {
    const uploaded = documentType === 'valid_id_path' ? hasValidId : hasCertificate;
    if (uploadBusy.current || !profile || (isVerified && uploaded) || (isHousehold && documentType === 'certificate_path')) return;
    uploadBusy.current = true;
    profileRevision.current += 1;
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled || !focused.current) return;
      const file = result.assets[0];
      if (!file || !file.uri) throw new Error('Please choose a valid document.');
      if (file.size !== undefined && (file.size <= 0 || file.size > 5 * 1024 * 1024)) {
        throw new Error('Please choose a non-empty document no larger than 5 MB.');
      }
      // Sanitize upload metadata only. Document contents remain unchanged.
      let name = (file.name || '').split(/[\\/]/).pop()!
        .replace(/[\x00-\x1F\x7F-\x9F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
        .replace(/[<>:"|?*]/g, '').trim().slice(-180);
      let extension = name.split('.').pop()?.toLowerCase();
      if (!name.includes('.')) {
        extension = Object.keys(fileTypes).find((key) => fileTypes[key] === file.mimeType);
        if (extension) name = `${name || 'verification-document'}.${extension}`;
      }
      if (!extension || !fileTypes[extension]) throw new Error('Choose a PDF, JPG, PNG, WEBP, HEIC, HEIF, BMP or JFIF document.');
      const mime = file.mimeType?.toLowerCase();
      const genericMime = !mime || mime === 'application/octet-stream' || mime.endsWith('/*');
      if (!genericMime && mime !== fileTypes[extension] && !(extension === 'jfif' && mime === 'image/pjpeg') && !(extension === 'bmp' && mime === 'image/x-ms-bmp')) {
        throw new Error('The file type does not match its extension. Please choose a valid document.');
      }
      setIsUploading(true);
      const formData = new FormData();
      formData.append('type', isHousehold ? 'household' : 'employer');
      formData.append(documentType, { uri: file.uri, name, type: fileTypes[extension] } as any);
      const response = await api.post('/upload-verification-doc', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (response.data?.status !== 'success' || !response.data?.profile) throw new Error(response.data?.message || 'Unable to upload this document.');
      const latest = response.data.profile;
      if (focused.current) {
        setProfile(latest);
        setLoadError(false);
        setLoading(false);
        setNotification({ visible: true, title: 'Document uploaded', message: 'Your document has been submitted for verification.', iconName: 'check-circle-outline', iconColor: '#15803D' });
      }
      await cacheProfile(latest);
    } catch (error: any) {
      const firstValidation = Object.values(error.response?.data?.errors || {}).flat().find((message) => typeof message === 'string');
      if (focused.current) setNotification({ visible: true, title: 'Upload failed', message: String(firstValidation || error.response?.data?.message || error.message || 'Please check your connection and try again.'), iconName: 'error-outline', iconColor: '#DC2626' });
    } finally {
      uploadBusy.current = false;
      setIsUploading(false);
      if (focused.current) {
        void checkVerificationDocs();
      }
    }
  };

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
  const statusDescription = isVerified ? `Your ${isHousehold ? 'household' : 'employer'} account is verified. You can now post jobs.` : isRejected ? 'Review the reason below and upload the documents needed for another review.' : isSubmitted ? `${isHousehold ? 'Your valid ID has' : 'Your valid ID and business document have'} been submitted for verification. The latest status will appear here.` : isHousehold ? 'Upload a valid government-issued ID to verify your household account.' : 'Upload a valid government-issued ID and Business Permit / Certificate to verify your employer account.';
  const steps = [
    { title: 'Submit documents', detail: documentsComplete || isVerified ? 'Required documents uploaded.' : `${documentCount} of ${isHousehold ? 1 : 2} required documents uploaded.`, done: documentsComplete || isVerified, active: !documentsComplete && !isVerified, failed: false },
    { title: isRejected ? 'Update documents' : 'Document review', detail: isVerified ? 'Your documents have been approved.' : isRejected ? 'Check the reason above.' : isSubmitted ? 'Waiting for verification approval.' : 'Begins after the required documents are uploaded.', done: isVerified, active: isSubmitted, failed: isRejected },
    { title: 'Verified account', detail: isVerified ? 'You can post jobs.' : 'Job posting unlocks after approval.', done: isVerified, active: false, failed: false },
  ];

  const renderDocument = (documentType: DocumentType, title: string, icon: IconName, uploaded: boolean) => {
    const editable = !isVerified || !uploaded;
    const showAi = isRejected && uploaded;
    const aiResult = normalizeAiResult(documentType === 'valid_id_path' ? profile?.ai_is_valid : profile?.cert_ai_is_valid);
    const color = showAi ? aiResult === false ? accentText : aiResult === true ? verifiedColor : pendingText : isVerified && uploaded ? verifiedColor : uploaded ? pendingText : colors.textSecondary;
    const fill = showAi ? aiResult === false ? accentSurface : aiResult === true ? verifiedSurface : pendingSurface : isVerified && uploaded ? verifiedSurface : uploaded ? pendingSurface : subtle;
    const recommendation = aiResult === true ? documentType === 'valid_id_path' ? 'Valid ID' : 'Valid Business Permit / Certificate' : aiResult === false ? documentType === 'valid_id_path' ? 'Invalid ID' : 'Invalid Business Permit / Certificate' : 'Pending analysis';
    const documentStatusIcon: IconName = showAi ? aiResult === false ? 'error-outline' : aiResult === true ? 'check-circle-outline' : 'hourglass-empty' : isVerified && uploaded ? 'check-circle-outline' : uploaded ? 'hourglass-empty' : 'upload-file';
    return (
      <View className="rounded-2xl border p-4 mt-3" style={{ borderColor: colors.border }}>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: fill }}><MaterialIcons name={icon} size={20} color={color} /></View>
          <View className="flex-1"><Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{title}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Required for verification</Text></View>
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2 mt-3">
          <View className={showAi ? 'w-full flex-row items-start gap-1.5' : 'flex-row items-center gap-1.5'}>
            <MaterialIcons name={documentStatusIcon} size={showAi ? 18 : 14} color={color} />
            <Text className={showAi ? 'flex-1 text-xs font-medium leading-5' : 'text-xs font-medium'} style={{ color }}>{showAi ? recommendation : isVerified && uploaded ? 'Verified' : uploaded ? 'Uploaded' : 'Not uploaded'}</Text>
          </View>
          {editable && <TouchableOpacity onPress={() => handleUploadDocument(documentType)} disabled={isUploading} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${uploaded ? 'Replace' : 'Upload'} ${title}`} accessibilityState={{ disabled: isUploading }} className="min-h-12 flex-row items-center gap-1.5 rounded-xl px-3 ml-auto" style={{ backgroundColor: accentSurface, opacity: isUploading ? 0.5 : 1 }}><MaterialIcons name={uploaded ? 'sync' : 'file-upload'} size={16} color={accentText} /><Text className="text-xs font-semibold" style={{ color: accentText }}>{isRejected && uploaded ? 'Re-upload' : uploaded ? 'Replace' : 'Upload'}</Text></TouchableOpacity>}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center shrink-0 px-6 pt-2 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Go back" className="w-12 h-12 rounded-2xl border items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}><MaterialIcons name="arrow-back" size={23} color={colors.text} /></TouchableOpacity>
        <Text className="flex-1 text-xl font-bold tracking-tight" style={{ color: colors.text }}>Verification status</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center pt-2 pb-6" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} enabled={!isUploading} colors={[accentText]} tintColor={accentText} />}>
        {loading || !profile ? (
          <View className="mx-6 rounded-3xl border px-6 py-8 items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {loading ? <ActivityIndicator size="large" color={accentText} /> : <MaterialIcons name="wifi-off" size={32} color={accentText} />}
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
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{isHousehold ? 'A government-issued valid ID is required.' : 'A government-issued valid ID and Business Permit / Certificate are required.'}</Text>
              {isRejected && <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Document checks help with review. Final account approval is by an admin.</Text>}
              {renderDocument('valid_id_path', 'Government Valid ID', 'badge', hasValidId)}
              {!isHousehold && renderDocument('certificate_path', 'Business Permit / Certificate', 'insert-drive-file', hasCertificate)}
              <View className="flex-row items-start gap-2 mt-4"><MaterialIcons name="info-outline" size={16} color={colors.textSecondary} /><Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>Accepted files: PDF, JPG, PNG, WEBP, HEIC, HEIF, BMP or JFIF. Maximum file size: 5 MB.</Text></View>
            </View>
          </>
        )}
      </ScrollView>
      <LoadingModal visible={isUploading} title="Uploading document" message="Please wait while your document is uploaded." />
      <NotificationModal visible={notification.visible} title={notification.title} message={notification.message} iconName={notification.iconName} iconColor={notification.iconColor} iconBgColor={notification.iconName === 'check-circle-outline' ? 'bg-emerald-50' : notification.iconColor === '#D97706' ? 'bg-amber-50' : 'bg-red-50'} onPrimaryPress={() => setNotification((current) => ({ ...current, visible: false }))} />
    </View>
  );
}
