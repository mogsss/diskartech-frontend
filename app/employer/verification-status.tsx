import PrimaryButton from '@/components/ui/PrimaryButton';
import LoadingModal from '@/components/ui/modals/LoadingModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function VerificationStatusScreen() {
  const { isDark, colors } = useDarkMode();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const [hasValidId, setHasValidId] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const checkVerificationDocs = async () => {
      try {
        const response = await api.get('/user/profile');
        const data = response.data;
        const profile = data.profile;

        if (profile) {
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));

          if (isHousehold) {
            setHasValidId(!!profile.valid_id_path);
          } else {
            setHasValidId(!!profile.valid_id_path);
            setHasCertificate(!!profile.employer_certificate_path);
          }

          setRejectionReason(profile.rejection_reason || null);
          setIsVerified(profile.isVerified === 1 || profile.isVerified === true);
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
      }
    };

    checkVerificationDocs();
    const interval = setInterval(checkVerificationDocs, 3000);
    return () => clearInterval(interval);
  }, [isHousehold]);

  const handleUploadDocument = async (documentField: 'valid_id_path' | 'certificate_path') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsUploading(true);

      const file = result.assets[0];

      const formData = new FormData();
      formData.append('type', isHousehold ? 'household' : 'employer');

      formData.append(documentField, {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      const response = await api.post('/upload-verification-doc', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data;

      Alert.alert('Success', 'Document uploaded successfully!');
      await AsyncStorage.setItem('userProfile', JSON.stringify(data.profile));

      setRejectionReason(null);
      setIsVerified(false);

      if (documentField === 'valid_id_path') {
        setHasValidId(true);
      } else {
        setHasCertificate(true);
      }

    } catch (error: any) {
      console.error('Detailed Upload Error:', error.response?.data || error);
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      Alert.alert('Error', 'Upload failed: ' + errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const isRejected = !isVerified && !!rejectionReason;
  const isSubmitted = !isVerified && (isHousehold
    ? (hasValidId && !isRejected)
    : (hasValidId && hasCertificate && !isRejected));

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">

        {/* Header */}
        <View className="flex-row items-center mb-6 pt-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center mr-4"
            style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold" style={{ color: colors.text }}>Verification Status</Text>
        </View>

        {/* Dynamic Status Card */}
        <View 
          className="rounded-2xl p-6 items-center shadow-md mb-4 border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View
            style={{
              backgroundColor: isVerified
                ? '#10B98115'
                : (isRejected ? '#EF444415' : (isSubmitted ? Colors.warning + '15' : (isDark ? 'rgba(255, 255, 255, 0.08)' : Colors.gray200)))
            }}
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
          >
            <MaterialIcons
              name={isVerified ? "verified" : (isRejected ? "error-outline" : (isSubmitted ? "hourglass-empty" : "assignment-late"))}
              size={44}
              color={isVerified ? '#10B981' : (isRejected ? '#EF4444' : (isSubmitted ? Colors.warning : colors.textSecondary))}
            />
          </View>

          <Text className="text-xl font-bold mb-2 text-center" style={{ color: colors.text }}>
            {isVerified ? 'Account Verified!' : (isRejected ? 'Verification Rejected' : (isSubmitted ? 'Verification Pending' : 'Documents Required'))}
          </Text>

          <Text className="text-base text-center mb-6 leading-[22px]" style={{ color: colors.textSecondary }}>
            {isVerified
              ? 'Congratulations! Your account and documents have been successfully verified and approved by the admin.'
              : (isRejected
                ? 'Some of your uploaded documents were rejected. Please check the remarks and re-upload valid documents using the button below.'
                : (isSubmitted
                  ? (isHousehold
                    ? 'Your valid ID is currently being reviewed. This usually takes 1-2 business days.'
                    : 'Your account and business documents are currently being reviewed. This usually takes 1-2 business days.')
                  : 'Please upload the required verification documents to activate and verify your account.'))}
          </Text>

          {/* Progress Timeline */}
          <View className="w-full items-center px-4">
            <View className="flex-row items-center w-full mb-1">
              <View className={`w-7 h-7 rounded-full items-center justify-center mr-4 ${isSubmitted || isRejected || isVerified ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                <MaterialIcons name="check" size={16} color={Colors.white} />
              </View>
              <Text className="text-sm font-semibold" style={{ color: colors.text }}>Documents Submitted</Text>
            </View>

            <View className={`w-[2px] h-5 ml-[13px] my-1 ${isSubmitted || isRejected || isVerified ? 'bg-emerald-600' : (isDark ? 'bg-white/10' : 'bg-gray-200')}`} />

            <View className="flex-row items-center w-full mb-1">
              <View
                style={{ backgroundColor: isVerified ? '#10B981' : (isRejected ? '#EF4444' : (isSubmitted ? Colors.warning : (isDark ? 'rgba(255, 255, 255, 0.1)' : Colors.gray200))) }}
                className="w-7 h-7 rounded-full items-center justify-center mr-4"
              >
                <MaterialIcons
                  name={isVerified || isSubmitted ? "check" : (isRejected ? "close" : "hourglass-empty")}
                  size={16}
                  color={Colors.white}
                />
              </View>
              <Text style={{ color: isVerified ? '#10B981' : (isRejected ? '#EF4444' : (isSubmitted ? Colors.warning : colors.textSecondary)) }} className="text-sm font-semibold">
                {isVerified ? 'Approved & Reviewed' : (isRejected ? 'Action Required (Rejected)' : 'Under Review')}
              </Text>
            </View>

            <View className={`w-[2px] h-5 ml-[13px] my-1 ${isVerified ? 'bg-emerald-600' : (isDark ? 'bg-white/10' : 'bg-gray-200')}`} />

            <View className="flex-row items-center w-full mb-1">
              <View className={`w-7 h-7 rounded-full items-center justify-center mr-4 ${isVerified ? 'bg-emerald-600' : (isDark ? 'bg-white/10' : 'bg-gray-200')}`}>
                <MaterialIcons name="check" size={16} color={isVerified ? Colors.white : colors.textSecondary} />
              </View>
              <Text style={{ color: isVerified ? '#10B981' : colors.textSecondary }} className="text-sm font-semibold">
                Verified
              </Text>
            </View>
          </View>
        </View>

        {/* Rejection Reason Banner */}
        {isRejected && (
          <View 
            className="rounded-2xl p-4 mb-4 border"
            style={{ 
              backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA'
            }}
          >
            <View className="flex-row items-center mb-1">
              <MaterialIcons name="error" size={18} color={colors.accent} style={{ marginRight: 6 }} />
              <Text className="text-xs font-bold" style={{ color: isDark ? colors.accent : '#B91C1C' }}>Reason:</Text>
            </View>
            <Text className="text-sm ml-6 text-center" style={{ color: isDark ? '#FECACA' : '#DC2626' }}>{rejectionReason}</Text>
          </View>
        )}

        {/* Uploaded Documents List */}
        {!isVerified && (
          <View 
            className="rounded-2xl p-4 mb-4 shadow-sm border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Text className="text-lg font-bold mb-4" style={{ color: colors.text }}>Uploaded Documents</Text>

            {/* Government Valid ID */}
            <View className="flex-row items-center gap-4 py-3 border-b" style={{ borderColor: colors.border }}>
              <MaterialIcons
                name="description"
                size={24}
                color={hasValidId ? (isRejected ? '#EF4444' : Colors.success) : colors.textSecondary}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Government Valid ID</Text>
                <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                  {isRejected ? 'Rejected - Needs re-upload' : (hasValidId ? 'Uploaded & Submitted' : 'Not yet uploaded')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleUploadDocument('valid_id_path')}
                className="px-3 py-1.5 rounded-lg border"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: colors.border
                }}
              >
                <Text className="text-xs font-bold text-red-600">
                  {isRejected ? 'Re-upload' : (hasValidId ? 'Change' : 'Upload')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Business Permit */}
            {!isHousehold && (
              <View className="flex-row items-center gap-4 py-3">
                <MaterialIcons
                  name="description"
                  size={24}
                  color={hasCertificate ? (isRejected ? '#EF4444' : Colors.success) : colors.textSecondary}
                />
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: colors.text }}>Business Permit / Certificate</Text>
                  <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                    {isRejected ? 'Rejected - Needs re-upload' : (hasCertificate ? 'Uploaded & Submitted' : 'Not yet uploaded')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleUploadDocument('certificate_path')}
                  className="px-3 py-1.5 rounded-lg border"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderColor: colors.border
                  }}
                >
                  <Text className="text-xs font-bold text-red-600">
                    {isRejected ? 'Re-upload' : (hasCertificate ? 'Change' : 'Upload')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Loading Modal Component */}
      <LoadingModal
        visible={isUploading}
        title="Uploading Document"
        message="Please wait while we securely upload your document..."
      />
    </View>
  );
}