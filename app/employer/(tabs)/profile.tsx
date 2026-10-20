import Avatar from '@/components/ui/Avatar';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useCallback, useRef } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api from '@/api/axios';
import { resolveMediaUrl, mediaFilename } from '@/utils/media';
import { getDocumentAnalysisStatus, normalizeAiResult } from '@/utils/documentAnalysis';
import { getUploadRateLimitNotice } from '@/utils/uploadRateLimit';
import { useFocusEffect } from '@react-navigation/native';
import { clearPushToken } from '@/utils/notifications';
import LoadingModal from '@/components/ui/modals/LoadingModal';
import DocumentViewerModal from '@/components/ui/modals/DocumentViewerModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import DrawerMenuButton from '@/components/ui/DrawerMenuButton';
import { useDarkMode } from '@/hooks/useDarkMode';
import { clearStorageForLogout } from '@/utils/logoutStorage';

const getFilename = (path?: string | null) => {
  if (!path || typeof path !== 'string') return null;
  return path.split(/[?#]/)[0].split('/').pop() || null;
};

const getEmployerPlan = (isSubscribed: unknown, expiresAt: unknown): 'Basic' | 'Premium' => {
  if (isSubscribed !== true && isSubscribed !== 1 && isSubscribed !== '1') return 'Basic';
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return 'Premium';
  if (typeof expiresAt !== 'string') return 'Basic';

  // Unzoned database timestamps use the backend's UTC timezone.
  const timestamp = expiresAt.trim().replace(' ', 'T');
  const expires = Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(timestamp) ? `${timestamp}Z` : timestamp);
  return Number.isFinite(expires) && expires > Date.now() ? 'Premium' : 'Basic';
};

export default function EmployerProfileScreen() {
  const { colors, isDark } = useDarkMode();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;
  const verifiedColor = isDark ? '#6EE7B7' : '#15803D';
  const pendingColor = isDark ? '#FCD34D' : '#92400E';
  const pendingSurface = isDark ? '#3B321D' : '#FFFBEB';
  const verificationRoute = `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}` as const;
  const [refreshing, setRefreshing] = useState(false);


  const [isVerified, setIsVerified] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5.0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'Basic' | 'Premium' | null>(null);

  const [uploadedDocs, setUploadedDocs] = useState<{
    valid_id_path?: string | null;
    valid_id_raw?: string | null;
    employer_certificate_path?: string | null;
    employer_certificate_raw?: string | null;
    ai_is_valid?: boolean | null;
    cert_ai_is_valid?: boolean | null;
  }>({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const avatarUploadBusy = useRef(false);

  const [viewerModalVisible, setViewerModalVisible] = useState(false);
  const [viewerConfig, setViewerConfig] = useState<{
    title: string;
    uri: string | null;
    filename?: string | null;
    field?: 'valid_id_path' | 'certificate_path';
  }>({ title: '', uri: null, filename: null });

  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertModalConfig, setAlertModalConfig] = useState<{
    title: string;
    message: string | React.ReactNode;
    iconName?: keyof typeof MaterialIcons.glyphMap;
    iconColor?: string;
    iconBgColor?: string;
    primaryButtonText?: string;
    onPrimaryPress?: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }>({
    title: '',
    message: '',
  });

  const showAlertModal = (config: {
    title: string;
    message: string | React.ReactNode;
    iconName?: keyof typeof MaterialIcons.glyphMap;
    iconColor?: string;
    iconBgColor?: string;
    primaryButtonText?: string;
    onPrimaryPress?: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
  }) => {
    setAlertModalConfig(config);
    setAlertModalVisible(true);
  };

  const [isLogoutModalVisible, setLogoutModalVisible] = useState(false);
  const [isDrawerVisible, setDrawerVisible] = useState(false);

  const [profileData, setProfileData] = useState({
    name: isHousehold ? 'Household' : 'Business',
    email: 'Loading...',
    avatarInitials: isHousehold ? 'HH' : 'BU',
    businessType: '',
    hirerName: '',
    locationValue: '',
    contactNumber: '',
  });

  const fetchEmployerProfile = useCallback(async () => {
    try {
      // 1. Kunin muna ang cached data sa AsyncStorage para agad mag-load ang tamang pangalan
      const storedUser = await AsyncStorage.getItem('userData');
      const storedProfile = await AsyncStorage.getItem('userProfile');

      const user = storedUser ? JSON.parse(storedUser) : {};
      if (user.email) {
        setProfileData(prev => ({ ...prev, email: user.email }));
      }

      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        setSubscriptionPlan(getEmployerPlan(profile.isSubscribed, profile.subscription_expires_at));
        if (profile.rating !== undefined) setRating(Number(profile.rating));
        if (profile.review_count !== undefined) setReviewCount(Number(profile.review_count));
        const verifiedStatus = profile.isVerified === 1 || profile.isVerified === true || profile.isVerified === '1';
        const reason = profile.rejection_reason || null;
        setIsVerified(verifiedStatus);
        setRejectionReason(reason);

        const actualName = isHousehold
          ? (profile.household_name || profile.name || 'Household')
          : (profile.employer_name || profile.business_name || profile.name || "Business Name");

        const nameParts = actualName.trim().split(' ');
        let initials = '';
        if (nameParts.length >= 2) {
          initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
          initials = nameParts[0].substring(0, 2).toUpperCase();
        } else {
          initials = isHousehold ? 'HH' : 'BU';
        }

        setAvatarUri(resolveMediaUrl(profile.avatar_url ?? profile.avatar ?? profile.profile_picture));

        setUploadedDocs({
          valid_id_path: getFilename(profile.valid_id_path),
          valid_id_raw: profile.valid_id_path,
          employer_certificate_path: getFilename(profile.employer_certificate_path),
          employer_certificate_raw: profile.employer_certificate_path,
          ai_is_valid: normalizeAiResult(profile.ai_is_valid),
          cert_ai_is_valid: normalizeAiResult(profile.cert_ai_is_valid),
        });

        setProfileData((prev) => ({
          ...prev,
          name: actualName,
          avatarInitials: initials,
          locationValue: profile.location || profile.detailed_address || prev.locationValue,
          contactNumber: profile.contact_number || profile.cp_number || prev.contactNumber,
          businessType: profile.business_type || '',
          hirerName: profile.hirer_name || '',
        }));
      }

      // 2. Pagkatapos ay i-sync sa API (/user/profile) para makuha ang pinakabagong update
      try {
        const response = await api.get('/user/profile');
        const profile = response.data.profile;
        const apiRating = response.data.rating !== undefined ? Number(response.data.rating) : 5.0;
        const apiReviewCount = response.data.review_count !== undefined ? Number(response.data.review_count) : 0;
        setRating(apiRating);
        setReviewCount(apiReviewCount);

        if (profile) {
          setSubscriptionPlan(getEmployerPlan(profile.isSubscribed, profile.subscription_expires_at));
          profile.rating = apiRating;
          profile.review_count = apiReviewCount;
          const verifiedStatus = profile.isVerified === 1 || profile.isVerified === true || profile.isVerified === '1';
          const reason = profile.rejection_reason || null;
          setIsVerified(verifiedStatus);
          setRejectionReason(reason);

          const actualName = isHousehold
            ? (profile.household_name || profile.name || 'Household')
            : (profile.employer_name || profile.business_name || profile.name || "Business Name");

          const nameParts = actualName.trim().split(' ');
          let initials = '';
          if (nameParts.length >= 2) {
            initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
          } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
            initials = nameParts[0].substring(0, 2).toUpperCase();
          } else {
            initials = isHousehold ? 'HH' : 'BU';
          }

          setAvatarUri(resolveMediaUrl(profile.avatar_url ?? profile.avatar ?? profile.profile_picture));

          setUploadedDocs({
            valid_id_path: getFilename(profile.valid_id_path),
            valid_id_raw: profile.valid_id_path,
            employer_certificate_path: getFilename(profile.employer_certificate_path),
            employer_certificate_raw: profile.employer_certificate_path,
            ai_is_valid: normalizeAiResult(profile.ai_is_valid),
            cert_ai_is_valid: normalizeAiResult(profile.cert_ai_is_valid),
          });

          setProfileData((prev) => ({
            ...prev,
            name: actualName,
            avatarInitials: initials,
            locationValue: profile.location || profile.detailed_address || '',
            contactNumber: profile.contact_number || profile.cp_number || '',
            businessType: profile.business_type || '',
            hirerName: profile.hirer_name || '',
          }));

          // I-update din ang AsyncStorage cache
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        }
      } catch (apiErr) {
        console.log('API profile sync failed, using cached storage:', apiErr);
      }

    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [isHousehold]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      fetchEmployerProfile();

      // Live auto-polling bawat 3 segundo para live na mag-update ang Verification badge at status
      const pollInterval = setInterval(() => {
        if (isMounted) {
          fetchEmployerProfile();
        }
      }, 3000);

      return () => {
        isMounted = false;
        clearInterval(pollInterval);
      };
    }, [fetchEmployerProfile])
  );

  const handlePickImage = async () => {
    if (avatarUploadBusy.current || uploadingDoc) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      showAlertModal({
        title: 'Permission Denied',
        message: 'You need to grant permission to access your photos.',
        iconName: 'photo-library',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      await uploadProfile(uri);
    }
  };

  const uploadProfile = async (uri: string) => {
    if (avatarUploadBusy.current) return;
    avatarUploadBusy.current = true;
    setUploadingProfilePicture(true);
    try {
      const formData = new FormData();

      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('profile_picture', {
        uri: uri,
        name: filename,
        type: type,
      } as any);

      const response = await api.post('/employer/add-profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
      });
      setUploadingProfilePicture(false);

      if (response.data.status === 'success') {
        showAlertModal({
          title: 'Upload Successful',
          message: 'Profile picture updated successfully!',
          iconName: 'check-circle',
          iconColor: '#059669',
          iconBgColor: 'bg-emerald-50',
          primaryButtonText: 'Great',
        });

        const rawPath = response.data.profile_picture || response.data.file_path;
        if (rawPath) {
          const fullUrl = resolveMediaUrl(response.data?.url || rawPath);
          setAvatarUri(fullUrl);
        }

        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profileObj = JSON.parse(storedProfile);
          profileObj.avatar = rawPath;
          profileObj.avatar_url = resolveMediaUrl(response.data?.url || rawPath);
          profileObj.profile_picture = rawPath;
          await AsyncStorage.setItem('userProfile', JSON.stringify(profileObj));
        }

        fetchEmployerProfile();
      }
    } catch (error: any) {
      setUploadingProfilePicture(false);
      showAlertModal({
        title: 'Upload Failed',
        message: error.response?.data?.message || 'Something went wrong.',
        iconName: 'error-outline',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        ...(getUploadRateLimitNotice(error) ?? {}),
      });
    } finally {
      avatarUploadBusy.current = false;
      setUploadingProfilePicture(false);
    }
  };

  const handleUploadDocument = async (documentField: 'valid_id_path' | 'certificate_path', title: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];

      console.log('Document picked:', {
        originalName: file.name,
        size: file.size,
        originalMime: file.mimeType,
        uri: file.uri,
      });

      if (file.size === 0) {
        showAlertModal({
          title: 'Empty / Corrupted File',
          message: `Ang napiling file ("${file.name}") ay 0 bytes (walang laman o corrupted download). Pakipili ang totoong may lamang larawan (JPG, PNG) o PDF document.`,
          iconName: 'warning',
          iconColor: '#EAB308',
          iconBgColor: 'bg-yellow-50',
        });
        return;
      }

      setUploadingDoc(true);

      // Sanitize extension and MIME type for reliable backend validation
      let fileName = file.name || `document_${Date.now()}`;
      const extMatch = fileName.match(/\.([0-9a-z]+)$/i);
      let ext = extMatch ? extMatch[1].toLowerCase() : '';

      let mimeType = file.mimeType;
      if (!ext) {
        if (mimeType?.includes('pdf')) ext = 'pdf';
        else if (mimeType?.includes('png')) ext = 'png';
        else if (mimeType?.includes('webp')) ext = 'webp';
        else ext = 'jpg';
        fileName = `${fileName}.${ext}`;
      }

      if (!mimeType || mimeType === 'application/octet-stream' || mimeType === '*/*') {
        if (ext === 'pdf') mimeType = 'application/pdf';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }
      const formData = new FormData();
      formData.append('type', isHousehold ? 'household' : 'employer');

      formData.append(documentField, {
        uri: file.uri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await api.post('/upload-verification-doc', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.status === 'success') {
        showAlertModal({
          title: 'Upload Successful',
          message: `${title} uploaded successfully!`,
          iconName: 'cloud-done',
          iconColor: '#059669',
          iconBgColor: 'bg-emerald-50',
          primaryButtonText: 'Great',
        });
        const updatedProfile = response.data.profile;
        if (updatedProfile) {
          setUploadedDocs({
            valid_id_path: getFilename(updatedProfile.valid_id_path),
            valid_id_raw: updatedProfile.valid_id_path,
            employer_certificate_path: getFilename(updatedProfile.employer_certificate_path),
            employer_certificate_raw: updatedProfile.employer_certificate_path,
            ai_is_valid: normalizeAiResult(updatedProfile.ai_is_valid),
            cert_ai_is_valid: normalizeAiResult(updatedProfile.cert_ai_is_valid),
          });
          await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        }
        fetchEmployerProfile();
      }
    } catch (error: any) {
      const validationErrors = error.response?.data?.errors;
      let detailedMsg = '';
      if (validationErrors && typeof validationErrors === 'object') {
        detailedMsg = Object.values(validationErrors).flat().join('\n');
      }
      showAlertModal({
        title: 'Upload Failed',
        message: detailedMsg || error.response?.data?.message || 'Unable to upload document at this time. Allowed formats: JPG, PNG, WEBP, PDF.',
        iconName: 'error-outline',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        ...(getUploadRateLimitNotice(error) ?? {}),
      });
    } finally {
      setUploadingDoc(false);
    }
  };

  const fetchDocumentUri = async (field: 'valid_id_path' | 'certificate_path') => {
    const response = await api.get('/user/profile');
    return resolveMediaUrl(response.data?.profile?.[field === 'certificate_path' ? 'employer_certificate_path' : field]);
  };

  const handleViewDocument = async (field: 'valid_id_path' | 'certificate_path', title: string, rawPath?: string | null) => {
    if (!rawPath) {
      showAlertModal({
        title: 'Notice',
        message: 'No document has been uploaded yet.',
        iconName: 'info',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
      });
      return;
    }
    try {
      const uri = await fetchDocumentUri(field);
      if (!uri) throw new Error('Document unavailable');
      setViewerConfig({ title, uri, filename: mediaFilename(uri), field });
      setViewerModalVisible(true);
    } catch {
      showAlertModal({ title: 'Document Unavailable', message: 'Unable to load this document. Please try again.', iconName: 'warning' });
    }
  };

  const menuItems = [
    { icon: isHousehold ? 'home-work' : 'business', label: isHousehold ? 'Household Details' : 'Business Details', route: '/edit-profile' },
    { icon: 'verified', label: 'Verification Status', route: `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}` },
    { icon: 'settings', label: 'Settings', route: '/settings' },
    { icon: 'help-outline', label: 'Help Center', route: '/help-center' },
    { icon: 'info-outline', label: 'About DiskarTech', route: '/about-diskartech' },
    { icon: 'logout', label: 'Logout', route: '/auth/welcome', danger: true },
  ];

  const handleLogout = async () => {
    setLogoutModalVisible(false);
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user?.id) await clearPushToken(user.id);
      }
      await clearStorageForLogout(AsyncStorage);
    } catch (error) {
      console.error('Error clearing storage on logout:', error);
    }
    router.replace('/auth/welcome' as any);
  };

  const handleMenuPress = (route: string) => {
    if (route === '/auth/welcome') {
      setLogoutModalVisible(true);
    } else if (route !== '#') {
      router.push(route as any);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchEmployerProfile(); } finally { setRefreshing(false); }
  };

  const hasDocuments = !!uploadedDocs.valid_id_raw && (isHousehold || !!uploadedDocs.employer_certificate_raw);
  const isRejected = !isVerified && !!rejectionReason;
  const verificationColor = isRejected ? accentText : pendingColor;
  const verificationFill = isRejected ? accentSurface : pendingSurface;
  const displayRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  const displayReviewCount = Number.isFinite(reviewCount) ? Math.max(0, Math.floor(reviewCount)) : 0;

  const renderDocument = (
    title: string, icon: keyof typeof MaterialIcons.glyphMap,
    rawPath: string | null | undefined, filename: string | null | undefined,
    field: 'valid_id_path' | 'certificate_path',
  ) => {
    const status = getDocumentAnalysisStatus(field, !!rawPath, field === 'valid_id_path' ? uploadedDocs.ai_is_valid : uploadedDocs.cert_ai_is_valid);
    const statusColor = status.verdict === 'valid' ? verifiedColor : status.verdict === 'invalid' ? accentText : rawPath ? pendingColor : colors.textSecondary;
    const statusIcon: keyof typeof MaterialIcons.glyphMap = status.verdict === 'valid' ? 'check-circle-outline' : status.verdict === 'invalid' ? 'error-outline' : rawPath ? 'hourglass-empty' : 'file-upload';
    return (
      <View key={field} className={field === 'valid_id_path' ? 'rounded-2xl border p-4' : 'rounded-2xl border p-4 mt-3'} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={icon} size={20} color={accentText} /></View>
          <View className="flex-1">
            <Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{title}</Text>
            <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }} numberOfLines={1}>{filename || 'No file uploaded'}</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2 mt-3">
          <View className="flex-row items-center gap-1.5 shrink">
            <MaterialIcons name={statusIcon} size={16} color={statusColor} />
            <Text className="text-xs font-medium leading-5 shrink" style={{ color: statusColor }}>{rawPath ? status.label : 'Required document'}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {rawPath && <TouchableOpacity onPress={() => handleViewDocument(field, title, rawPath)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`View ${title}`} className="w-12 h-12 rounded-xl border items-center justify-center" style={{ borderColor: colors.border }}><MaterialIcons name="visibility" size={19} color={accentText} /></TouchableOpacity>}
            {(!isVerified || !rawPath) && <TouchableOpacity onPress={() => handleUploadDocument(field, title)} disabled={uploadingDoc} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${rawPath ? 'Replace' : 'Upload'} ${title}`} accessibilityState={{ disabled: uploadingDoc }} className="min-h-12 flex-row items-center gap-1.5 rounded-xl px-3" style={{ backgroundColor: accentSurface, opacity: uploadingDoc ? 0.5 : 1 }}>
              <MaterialIcons name={rawPath ? 'refresh' : 'file-upload'} size={16} color={accentText} /><Text className="text-xs font-semibold" style={{ color: accentText }}>{rawPath ? 'Change' : 'Upload'}</Text>
            </TouchableOpacity>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center shrink-0 px-6 pt-2 pb-3 flex-row items-center gap-3">
        <DrawerMenuButton onPress={() => setDrawerVisible(true)} />
        <Text className="flex-1 text-xl font-bold tracking-tight" style={{ color: colors.text }}>{isHousehold ? 'Household profile' : 'Business profile'}</Text>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center pt-2 pb-6" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        <View className="mx-6 mb-4 rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          {!isHousehold && <View className="flex-row flex-wrap items-center justify-between gap-2 mb-3">
            <Text className="text-[10px] font-semibold tracking-wide" style={{ color: colors.textSecondary }}>EMPLOYER ACCOUNT</Text>
            {subscriptionPlan && <TouchableOpacity onPress={() => router.push('/employer/subscription')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${subscriptionPlan} plan. Manage subscription`} className="min-h-11 flex-row items-center gap-1.5 rounded-xl px-3 ml-auto" style={{ backgroundColor: subscriptionPlan === 'Premium' ? pendingSurface : isDark ? '#263449' : '#F1F5F9' }}>
              <MaterialIcons name={subscriptionPlan === 'Premium' ? 'workspace-premium' : 'layers'} size={16} color={subscriptionPlan === 'Premium' ? pendingColor : colors.textSecondary} />
              <Text className="text-xs font-semibold" style={{ color: subscriptionPlan === 'Premium' ? pendingColor : colors.textSecondary }}>{subscriptionPlan} plan</Text>
              <MaterialIcons name="chevron-right" size={16} color={subscriptionPlan === 'Premium' ? pendingColor : colors.textSecondary} />
            </TouchableOpacity>}
          </View>}
          <View className="flex-row items-center gap-4">
            <View className="relative">
              <Avatar uri={avatarUri || ''} name={profileData.avatarInitials} size={72} />
              <TouchableOpacity onPress={handlePickImage} disabled={uploadingProfilePicture || uploadingDoc} activeOpacity={0.75} hitSlop={6} accessibilityRole="button" accessibilityLabel="Change profile photo" accessibilityState={{ disabled: uploadingProfilePicture || uploadingDoc }} className="absolute bottom-0 right-0 w-9 h-9 rounded-full border-2 items-center justify-center" style={{ backgroundColor: colors.primary, borderColor: colors.surface }}><MaterialIcons name="camera-alt" size={17} color="#FFFFFF" /></TouchableOpacity>
            </View>
            <View className="flex-1">
              {isHousehold && <Text className="text-[10px] font-semibold tracking-wide mb-1" style={{ color: colors.textSecondary }}>HOUSEHOLD ACCOUNT</Text>}
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xl font-bold leading-7 tracking-tight shrink" style={{ color: colors.text }} numberOfLines={2}>{profileData.name}</Text>
                {isVerified && <MaterialIcons name="verified" size={20} color={verifiedColor} accessibilityLabel="Verified account" />}
              </View>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{profileData.email}</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap items-center gap-3 mt-5 pt-4 border-t" style={{ borderColor: colors.border }}>
            {!isVerified && <TouchableOpacity onPress={() => router.push(verificationRoute)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="View account verification status" className="min-h-12 flex-row items-center gap-1.5 px-3 rounded-xl" style={{ backgroundColor: verificationFill }}>
              <MaterialIcons name={isRejected ? 'error-outline' : 'shield'} size={17} color={verificationColor} /><Text className="text-xs font-semibold" style={{ color: verificationColor }}>{isRejected ? 'Update verification' : hasDocuments ? 'Waiting for approval' : 'Verification required'}</Text><MaterialIcons name="chevron-right" size={16} color={verificationColor} />
            </TouchableOpacity>}
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name={displayReviewCount > 0 ? 'star' : 'star-outline'} size={18} color={displayReviewCount > 0 ? '#F59E0B' : colors.textSecondary} />
              {displayReviewCount > 0 ? <Text className="text-xs" style={{ color: colors.textSecondary }}><Text className="font-semibold" style={{ color: colors.text }}>{displayRating.toFixed(1)}</Text>{` (${displayReviewCount} ${displayReviewCount === 1 ? 'review' : 'reviews'})`}</Text> : <Text className="text-xs" style={{ color: colors.textSecondary }}>No reviews yet</Text>}
            </View>
          </View>
        </View>

        <View className="mx-6 mb-5">
          <View className="flex-row items-center justify-between gap-3 mb-2 px-1">
            <View className="flex-1">
              <Text accessibilityRole="header" className="text-sm font-semibold leading-5" style={{ color: colors.text }}>Documents & verification</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{isVerified ? 'Your account documents.' : 'Upload your documents to verify your account and post jobs.'}</Text>
            </View>
            {!isVerified && <TouchableOpacity onPress={() => router.push(verificationRoute)} activeOpacity={0.75} hitSlop={4} accessibilityRole="button" accessibilityLabel="View document verification status" className="w-12 h-12 items-center justify-center"><MaterialIcons name="chevron-right" size={24} color={accentText} /></TouchableOpacity>}
          </View>
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {renderDocument('Valid ID', 'badge', uploadedDocs.valid_id_raw, uploadedDocs.valid_id_path, 'valid_id_path')}
            {!isHousehold && renderDocument('Business Permit / Certificate', 'insert-drive-file', uploadedDocs.employer_certificate_raw, uploadedDocs.employer_certificate_path, 'certificate_path')}
            {hasDocuments && <Text className="text-xs leading-5 mt-3" style={{ color: colors.textSecondary }}>AI checks help with review. Final account approval is by an admin.</Text>}
            {isRejected && <TouchableOpacity onPress={() => router.push(verificationRoute)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Review verification rejection" className="rounded-xl p-3 mt-1" style={{ backgroundColor: accentSurface }}>
              <View className="flex-row items-center gap-2 mb-1"><MaterialIcons name="error-outline" size={17} color={accentText} /><Text className="flex-1 text-xs font-semibold" style={{ color: accentText }}>Verification needs an update</Text><MaterialIcons name="chevron-right" size={18} color={accentText} /></View>
              <Text className="text-xs leading-5" style={{ color: accentText }}>{rejectionReason}</Text>
            </TouchableOpacity>}
          </View>
        </View>

        <View className="mx-6 mb-5">
          <View className="flex-row items-center justify-between gap-3 mb-2 px-1">
            <View className="flex-1"><Text accessibilityRole="header" className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{isHousehold ? 'Household information' : 'Business information'}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Your location and contact details.</Text></View>
            <TouchableOpacity onPress={() => router.push('/edit-profile')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Edit profile information" className="min-h-12 flex-row items-center gap-1.5 rounded-xl px-3" style={{ backgroundColor: accentSurface }}><MaterialIcons name="edit" size={16} color={accentText} /><Text className="text-xs font-semibold" style={{ color: accentText }}>Edit</Text></TouchableOpacity>
          </View>
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {!isHousehold && <>
              <InfoRow icon="person-outline" label="Hirer name" value={profileData.hirerName} />
              <InfoRow icon="store" label="Business type" value={profileData.businessType} />
            </>}
            <InfoRow icon="location-on" label={isHousehold ? 'Home address' : 'Business location'} value={profileData.locationValue} />
            <InfoRow icon="phone" label="Contact number" value={profileData.contactNumber} />
            <InfoRow icon="mail-outline" label="Email address" value={profileData.email} />
          </View>
        </View>

        {!isHousehold && <View className="mx-6 mb-5">
          <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>Subscription plans</Text>
          <TouchableOpacity onPress={() => router.push('/employer/subscription')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Manage subscription plans" className="rounded-3xl border p-5 flex-row items-center gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="workspace-premium" size={23} color={accentText} /></View>
            <View className="flex-1"><Text className="text-sm font-semibold" style={{ color: colors.text }}>View plans</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>View available plans and options.</Text></View>
            <MaterialIcons name="chevron-right" size={22} color={accentText} />
          </TouchableOpacity>
        </View>}

        <View className="mx-6">
          <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>Account & support</Text>
          <View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {menuItems.map((item, index) => <TouchableOpacity key={item.label} onPress={() => handleMenuPress(item.route)} activeOpacity={0.75} accessibilityRole="button" className={index === menuItems.length - 1 ? 'flex-row items-center gap-3 px-5 py-4' : 'flex-row items-center gap-3 px-5 py-4 border-b'} style={{ borderColor: colors.border }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={20} color={accentText} /></View>
              <Text className="flex-1 text-sm font-medium" style={{ color: item.danger ? accentText : colors.text }}>{item.label}</Text>
              <MaterialIcons name="chevron-right" size={20} color={accentText} />
            </TouchableOpacity>)}
          </View>
        </View>
      </ScrollView>

      <LoadingModal visible={uploadingDoc || uploadingProfilePicture} message={uploadingProfilePicture ? 'Uploading profile picture...' : 'Uploading verification document...'} />

      <DocumentViewerModal
        visible={viewerModalVisible}
        onClose={() => setViewerModalVisible(false)}
        title={viewerConfig.title}
        uri={viewerConfig.uri}
        filename={viewerConfig.filename}
        refreshUri={() => viewerConfig.field ? fetchDocumentUri(viewerConfig.field) : Promise.resolve(null)}
      />

      {/* Notification / Alert Modal */}
      <NotificationModal
        visible={alertModalVisible}
        title={alertModalConfig.title}
        message={alertModalConfig.message}
        iconName={alertModalConfig.iconName}
        iconColor={alertModalConfig.iconColor}
        iconBgColor={alertModalConfig.iconBgColor}
        primaryButtonText={alertModalConfig.primaryButtonText || 'OK'}
        onPrimaryPress={() => {
          setAlertModalVisible(false);
          if (alertModalConfig.onPrimaryPress) {
            alertModalConfig.onPrimaryPress();
          }
        }}
        secondaryButtonText={alertModalConfig.secondaryButtonText}
        onSecondaryPress={
          alertModalConfig.onSecondaryPress
            ? () => {
              setAlertModalVisible(false);
              alertModalConfig.onSecondaryPress!();
            }
            : undefined
        }
      />

      {/* Logout Confirmation Modal */}
      <NotificationModal
        visible={isLogoutModalVisible}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
        iconName="logout"
        iconColor="#DC2626"
        iconBgColor="bg-red-50"
        primaryButtonText="Yes, Log Out"
        onPrimaryPress={handleLogout}
        secondaryButtonText="Cancel"
        onSecondaryPress={() => setLogoutModalVisible(false)}
      />

      {/* Slide-out Burger Menu / Side Drawer */}
      <SideDrawerMenu
        visible={isDrawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={{
          name: profileData.name,
          role: isHousehold ? 'household' : 'business',
          avatarUri: avatarUri,
          avatarInitials: profileData.avatarInitials,
          isVerified: isVerified,
          rejectionReason: rejectionReason,
        }}
        onLogout={handleLogout}
      />
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  const { colors, isDark } = useDarkMode();
  return (
    <View className="flex-row items-start gap-3 py-3">
      <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2' }}><MaterialIcons name={icon} size={18} color={isDark ? colors.accent : colors.accent} /></View>
      <View className="flex-1">
        <Text className="text-[11px]" style={{ color: colors.textSecondary }}>{label}</Text>
        <Text className="text-sm font-medium leading-5 mt-1" style={{ color: colors.text }}>{value || 'Not provided'}</Text>
      </View>
    </View>
  );
}
