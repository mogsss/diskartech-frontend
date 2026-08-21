import PrimaryButton from '@/components/ui/PrimaryButton';
import LoadingModal from '@/components/LoadingModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function VerificationStatusScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const [hasValidId, setHasValidId] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const checkVerificationDocs = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        
        const response = await fetch('http://192.168.1.2:8000/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
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
          }
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
      const token = await AsyncStorage.getItem('userToken');

      const formData = new FormData();
      formData.append('type', isHousehold ? 'household' : 'employer');
      
      formData.append(documentField, {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      const response = await fetch('http://192.168.1.2:8000/api/upload-verification-doc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Document uploaded successfully!');
        await AsyncStorage.setItem('userProfile', JSON.stringify(data.profile));
        
        setRejectionReason(null);

        if (documentField === 'valid_id_path') {
          setHasValidId(true);
        } else {
          setHasCertificate(true);
        }
      } else {
        Alert.alert('Error', data.message || 'Upload failed.');
      }

    } catch (error: any) {
      console.error('Detailed Upload Error:', error);
      Alert.alert('Error', 'Upload failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const isRejected = !!rejectionReason;
  const isSubmitted = isHousehold 
    ? (hasValidId && !isRejected) 
    : (hasValidId && hasCertificate && !isRejected);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        
        {/* Header */}
        <View className="flex-row items-center mb-6 pt-4">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-900">Verification Status</Text>
        </View>

        {/* Dynamic Status Card */}
        <View className="bg-white rounded-2xl p-6 items-center shadow-md mb-4">
          <View 
            style={{ 
              backgroundColor: isRejected 
                ? '#EF444415' 
                : (isSubmitted ? Colors.warning + '15' : Colors.gray200) 
            }}
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
          >
            <MaterialIcons 
              name={isRejected ? "error-outline" : (isSubmitted ? "hourglass-empty" : "assignment-late")} 
              size={44} 
              color={isRejected ? '#EF4444' : (isSubmitted ? Colors.warning : Colors.gray500)} 
            />
          </View>

          <Text className="text-xl font-bold text-slate-900 mb-2">
            {isRejected ? 'Verification Rejected' : (isSubmitted ? 'Verification Pending' : 'Documents Required')}
          </Text>

          <Text className="text-base text-slate-500 text-center mb-6 leading-[22px]">
            {isRejected
              ? 'Some of your uploaded documents were rejected. Please check the remarks and re-upload valid documents using the button below.'
              : (isSubmitted
                ? (isHousehold
                    ? 'Your valid ID is currently being reviewed. This usually takes 1-2 business days.'
                    : 'Your account and business documents are currently being reviewed. This usually takes 1-2 business days.')
                : 'Please upload the required verification documents to activate and verify your account.')}
          </Text>
          
          {/* Progress Timeline */}
          <View className="w-full items-center px-4">
            <View className="flex-row items-center w-full mb-1">
              <View className={`w-7 h-7 rounded-full items-center justify-center mr-4 ${isSubmitted || isRejected ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                <MaterialIcons name="check" size={16} color={Colors.white} />
              </View>
              <Text className="text-sm font-semibold text-slate-900">Documents Submitted</Text>
            </View>

            <View className={`w-[2px] h-5 ml-[13px] my-1 ${isSubmitted || isRejected ? 'bg-emerald-600' : 'bg-gray-200'}`} />

            <View className="flex-row items-center w-full mb-1">
              <View 
                style={{ backgroundColor: isRejected ? '#EF4444' : (isSubmitted ? Colors.warning : Colors.gray200) }}
                className="w-7 h-7 rounded-full items-center justify-center mr-4"
              >
                <MaterialIcons 
                  name={isRejected ? "close" : "hourglass-empty"} 
                  size={16} 
                  color={Colors.white} 
                />
              </View>
              <Text style={{ color: isRejected ? '#EF4444' : (isSubmitted ? Colors.warning : Colors.gray400) }} className="text-sm font-semibold">
                {isRejected ? 'Action Required (Rejected)' : 'Under Review'}
              </Text>
            </View>

            <View className={`w-[2px] h-5 ml-[13px] my-1 bg-gray-200`} />

            <View className="flex-row items-center w-full mb-1">
              <View className="w-7 h-7 rounded-full items-center justify-center mr-4 bg-gray-200">
                <MaterialIcons name="check" size={16} color={Colors.gray400} />
              </View>
              <Text className="text-sm font-semibold text-gray-400">Verified</Text>
            </View>
          </View>
        </View>

        {/* Rejection Reason Banner (Lalabas lang kapag rejected) */}
        {isRejected && (
          <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-1">
              <MaterialIcons name="error" size={18} color="#DC2626" className="mr-1.5" />
              <Text className="text-xs font-bold text-red-700">Reason:</Text>
            </View>
            <Text className="text-sm text-red-600 ml-6 text-center">{rejectionReason}</Text>
          </View>
        )}

        {/* Uploaded Documents List */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-4">Uploaded Documents</Text>
          
          {/* Government Valid ID */}
          <View className="flex-row items-center gap-4 py-3 border-b border-gray-100">
            <MaterialIcons 
              name="description" 
              size={24} 
              color={hasValidId ? (isRejected ? '#EF4444' : Colors.success) : Colors.gray400} 
            />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Government Valid ID</Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                {isRejected ? 'Rejected - Needs re-upload' : (hasValidId ? 'Uploaded & Submitted' : 'Not yet uploaded')}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => handleUploadDocument('valid_id_path')} 
              className="bg-gray-100 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-xs font-bold text-red-600">
                {isRejected ? 'Re-upload' : (hasValidId ? 'Change' : 'Upload')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Business Permit (Para lang sa Business Employer) */}
          {!isHousehold && (
            <View className="flex-row items-center gap-4 py-3">
              <MaterialIcons 
                name="description" 
                size={24} 
                color={hasCertificate ? (isRejected ? '#EF4444' : Colors.success) : Colors.gray400} 
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">Business Permit / Certificate</Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  {isRejected ? 'Rejected - Needs re-upload' : (hasCertificate ? 'Uploaded & Submitted' : 'Not yet uploaded')}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => handleUploadDocument('certificate_path')} 
                className="bg-gray-100 px-3 py-1.5 rounded-lg"
              >
                <Text className="text-xs font-bold text-red-600">
                  {isRejected ? 'Re-upload' : (hasCertificate ? 'Change' : 'Upload')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Professional Loading Modal Component */}
      <LoadingModal 
        visible={isUploading} 
        title="Uploading Document" 
        message="Please wait while we securely upload your document..." 
      />
    </View>
  );
}