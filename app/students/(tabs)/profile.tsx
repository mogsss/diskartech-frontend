import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import Avatar from '@/components/ui/Avatar';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import AddSkillModal from '@/components/student/modals/AddSkillModal';
import EditAvailabilityModal from '@/components/student/modals/EditAvailabilityModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import LoadingModal from '@/components/ui/modals/LoadingModal';
import DocumentViewerModal from '@/components/ui/modals/DocumentViewerModal';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import api from '@/api/axios';
import { resolveMediaUrl, mediaFilename } from '@/utils/media';
import { getDocumentAnalysisStatus } from '@/utils/documentAnalysis';

// Custom Hook natin!
import { useStudentProfile } from '@/hooks/useStudentProfile';
import { useDarkMode } from '@/hooks/useDarkMode';

const menuItems = [
  { icon: 'verified', label: 'Verification Status', route: '/students/verification-status' },
  { icon: 'settings', label: 'Settings', route: '/settings' },
  { icon: 'help-outline', label: 'Help Center', route: '/help-center' },
  { icon: 'info-outline', label: 'About DiskarTech', route: '/about-diskartech' },
  { icon: 'logout', label: 'Logout', route: '/auth/welcome', danger: true },
];

export default function ProfileScreen() {
  const { colors, isDark } = useDarkMode();
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerVisible, setDrawerVisible] = useState(false);

  // Hinatak natin palabas lahat ng data at functions galing sa Custom Hook
  const {
    studentName, studentEmail, school, course, yearLevel, location, isVerified, rejectionReason, rating, reviewCount, profilePicUri, uploadedDocs,
    skills, isAddSkillModalVisible, setAddSkillModalVisible, handleSaveSkills,
    selectedDays, selectedTimeSlot, scheduleSlots, isAvailabilityModalVisible, setAvailabilityModalVisible, handleSaveAvailability, formatScheduleText,
    isLogoutModalVisible, setLogoutModalVisible, handleLogout,
    alertModalVisible, setAlertModalVisible, alertModalConfig, showAlertModal,
    handleUploadDocument, handleUploadProfilePic, fetchStudentProfile, uploadingDocument, uploadingProfilePicture
  } = useStudentProfile();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchStudentProfile();
    } finally {
      setRefreshing(false);
    }
  };

  const isRejected = !isVerified && !!rejectionReason;

  const [viewerModalVisible, setViewerModalVisible] = useState(false);
  const [viewerConfig, setViewerConfig] = useState<{
    title: string;
    uri: string | null;
    filename?: string | null;
    field?: 'student_resume' | 'school_id' | 'coe';
  }>({ title: '', uri: null, filename: null });

  const fetchDocumentUri = async (field: 'student_resume' | 'school_id' | 'coe') => {
    const response = await api.get('/user/profile');
    return resolveMediaUrl(response.data?.profile?.[field]);
  };

  const handleViewDocument = async (type: 'student_resume' | 'school_id' | 'coe', title: string, rawPath?: string | null) => {
    if (!rawPath) {
      showAlertModal({
        title: 'Document Unavailable',
        message: 'No document path available to preview.',
        iconName: 'warning',
        iconColor: '#F59E0B',
        iconBgColor: 'bg-amber-50',
      });
      return;
    }
    try {
      // Cached profile links may have expired; request a fresh authorized link.
      const uri = await fetchDocumentUri(type);
      if (!uri) throw new Error('Document unavailable');
      setViewerConfig({ title, uri, filename: mediaFilename(uri), field: type });
      setViewerModalVisible(true);
    } catch {
      showAlertModal({ title: 'Document Unavailable', message: 'Unable to load this document. Please try again.', iconName: 'warning' });
    }
  };

  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;
  const subtle = isDark ? '#263449' : '#F1F5F9';
  const verificationColor = isRejected ? accentText : colors.textSecondary;
  const verificationFill = isRejected ? accentSurface : subtle;
  const validSkills = skills.filter((skill) => typeof skill === 'string' && skill.trim());
  const displayRating = Number.isFinite(rating) ? Math.max(0, Math.min(rating, 5)) : 0;

  const handleAddSkill = () => {
    if (skills.length >= 5) {
      showAlertModal({
        title: 'Limit Reached', message: 'You can only add up to 5 skills.', iconName: 'warning',
        iconColor: '#f59e0b', iconBgColor: 'bg-amber-50', primaryButtonText: 'OK', onPrimaryPress: () => setAlertModalVisible(false),
      });
      return;
    }
    setAddSkillModalVisible(true);
  };

  const renderSectionHeader = (title: string, description: string, action: string, onPress: () => void, icon: keyof typeof MaterialIcons.glyphMap = 'edit') => (
    <View className="flex-row items-center justify-between gap-3 mb-2 px-1">
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{title}</Text>
        <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{description}</Text>
      </View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${action} ${title}`} className="min-h-12 flex-row items-center gap-1.5 rounded-xl px-3" style={{ backgroundColor: accentSurface }}>
        <MaterialIcons name={icon} size={16} color={accentText} />
        <Text className="text-xs font-semibold" style={{ color: accentText }}>{action}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderInfoRow = (icon: keyof typeof MaterialIcons.glyphMap, label: string, value: string) => (
    <View className="flex-row items-start gap-3 py-3">
      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={icon} size={19} color={accentText} /></View>
      <View className="flex-1">
        <Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>{label}</Text>
        <Text className="text-sm font-medium leading-6 mt-0.5" style={{ color: colors.text }}>{String(value || 'Not specified')}</Text>
      </View>
    </View>
  );

  const renderDocument = (type: 'student_resume' | 'school_id' | 'coe', title: string, icon: keyof typeof MaterialIcons.glyphMap, forVerification = false) => {
    const filename = uploadedDocs[type];
    const rawPath = uploadedDocs[`${type}_raw`];
    const uploaded = Boolean(rawPath);
    const verified = forVerification && isVerified && uploaded;
    const status = type === 'student_resume' ? null : getDocumentAnalysisStatus(type, uploaded, uploadedDocs[`${type}_ai_is_valid`]);
    const documentColor = status?.verdict === 'invalid' ? accentText : status?.verdict === 'pending' ? (isDark ? '#FCD34D' : '#B45309') : uploaded ? (isDark ? '#6EE7B7' : '#047857') : colors.textSecondary;
    const documentIcon: keyof typeof MaterialIcons.glyphMap = status?.verdict === 'invalid' ? 'error-outline' : status?.verdict === 'pending' ? 'hourglass-empty' : uploaded ? 'check-circle-outline' : 'upload-file';
    return (
      <View className={type === 'student_resume' ? 'rounded-2xl border p-4' : 'rounded-2xl border p-4 mt-3'} style={{ borderColor: colors.border }}>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={icon} size={20} color={accentText} /></View>
          <View className="flex-1">
            <Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{title}</Text>
            <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }} numberOfLines={1}>{filename || 'No file uploaded'}</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2 mt-3">
          <View className="flex-row items-center gap-1.5 shrink">
            <MaterialIcons name={documentIcon} size={16} color={documentColor} />
            <Text className="text-xs font-medium leading-5 shrink" style={{ color: documentColor }}>{status?.label ?? (uploaded ? 'Uploaded' : 'Not uploaded')}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {uploaded && <TouchableOpacity onPress={() => handleViewDocument(type, title, rawPath)} accessibilityRole="button" accessibilityLabel={`View ${title}`} activeOpacity={0.75} className="w-12 h-12 rounded-xl border items-center justify-center" style={{ borderColor: colors.border }}><MaterialIcons name="visibility" size={19} color={accentText} /></TouchableOpacity>}
            {!verified && <TouchableOpacity onPress={() => handleUploadDocument(type, type === 'coe' ? 'COR/COE' : title)} disabled={uploadingDocument !== null} accessibilityRole="button" accessibilityLabel={`${uploaded ? 'Replace' : 'Upload'} ${title}`} accessibilityState={{ disabled: uploadingDocument !== null }} activeOpacity={0.75} className="min-h-12 flex-row items-center gap-1.5 rounded-xl px-3" style={{ backgroundColor: accentSurface, opacity: uploadingDocument !== null ? 0.5 : 1 }}><MaterialIcons name={uploaded ? 'sync' : 'file-upload'} size={16} color={accentText} /><Text className="text-xs font-semibold" style={{ color: accentText }}>{uploaded ? 'Replace' : 'Upload'}</Text></TouchableOpacity>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center shrink-0 px-6 pt-2 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => setDrawerVisible(true)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open navigation menu" className="w-12 h-12 items-center justify-center"><MaterialIcons name="menu" size={23} color={colors.text} /></TouchableOpacity>
        <View className="flex-1"><Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>Profile</Text></View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="w-full max-w-2xl self-center pt-2 pb-6" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        <View className="mx-6 mb-4 rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View className="flex-row items-center gap-4">
            <View className="relative">
              <Avatar uri={profilePicUri} name={String(studentName || 'Student')} size={72} />
              <TouchableOpacity onPress={handleUploadProfilePic} disabled={uploadingProfilePicture || uploadingDocument !== null} activeOpacity={0.75} hitSlop={6} accessibilityRole="button" accessibilityLabel="Change profile photo" accessibilityState={{ disabled: uploadingProfilePicture || uploadingDocument !== null }} className="absolute bottom-0 right-0 w-9 h-9 rounded-full border-2 items-center justify-center" style={{ backgroundColor: colors.primary, borderColor: colors.surface }}><MaterialIcons name="camera-alt" size={17} color="#FFFFFF" /></TouchableOpacity>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xl font-bold leading-7 tracking-tight shrink" style={{ color: colors.text }} numberOfLines={2}>{String(studentName || 'Student')}</Text>
                {isVerified && <MaterialIcons name="verified" size={20} color={isDark ? '#6EE7B7' : '#15803D'} accessibilityLabel="Verified account" />}
              </View>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{String(studentEmail || '')}</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap items-center gap-3 mt-5 pt-4 border-t" style={{ borderColor: colors.border }}>
            {!isVerified && <TouchableOpacity onPress={() => router.push('/students/verification-status')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="View account verification status" className="min-h-12 flex-row items-center gap-1.5 px-3 rounded-xl" style={{ backgroundColor: verificationFill }}><MaterialIcons name={isRejected ? 'error-outline' : 'shield'} size={17} color={verificationColor} /><Text className="text-xs font-semibold" style={{ color: verificationColor }}>{isRejected ? 'Needs verification update' : 'Not verified'}</Text><MaterialIcons name="chevron-right" size={16} color={verificationColor} /></TouchableOpacity>}
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name={reviewCount > 0 ? 'star' : 'star-outline'} size={18} color={reviewCount > 0 ? '#F59E0B' : colors.textSecondary} />
              {reviewCount > 0 ? <Text className="text-xs" style={{ color: colors.textSecondary }}><Text className="font-semibold" style={{ color: colors.text }}>{displayRating.toFixed(1)}</Text>{` (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`}</Text> : <Text className="text-xs" style={{ color: colors.textSecondary }}>No reviews yet</Text>}
            </View>
          </View>
        </View>

        <View className="mx-6 mb-5">
          <View className="flex-row items-center justify-between gap-3 mb-2 px-1">
            <View className="flex-1">
              <Text accessibilityRole="header" className="text-sm font-semibold leading-5" style={{ color: colors.text }}>Documents & verification</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{isVerified ? 'Keep your documents ready.' : 'Keep your documents ready. Verify your account to apply for jobs.'}</Text>
            </View>
            {!isVerified && (
              <TouchableOpacity onPress={() => router.push('/students/verification-status')} activeOpacity={0.75} hitSlop={4} accessibilityRole="button" accessibilityLabel="View document verification status" className="w-12 h-12 items-center justify-center">
                <MaterialIcons name="chevron-right" size={24} color={accentText} />
              </TouchableOpacity>
            )}
          </View>
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {renderDocument('student_resume', 'Resume', 'description')}
            {renderDocument('school_id', 'School ID', 'badge', true)}
            {renderDocument('coe', 'COR/COE (Certificate of Enrolment/Registration)', 'insert-drive-file', true)}
            {(uploadedDocs.school_id_raw || uploadedDocs.coe_raw) && <Text className="text-xs leading-5 mt-3" style={{ color: colors.textSecondary }}>AI checks help with review. Final account approval is by an admin.</Text>}
            {isRejected && <View className="rounded-xl p-3 mt-4" style={{ backgroundColor: accentSurface }}><View className="flex-row items-center gap-2 mb-1"><Text className="text-xs font-semibold" style={{ color: accentText }}>Reason:</Text></View><Text className="text-xs leading-5" style={{ color: accentText }}>{rejectionReason}</Text></View>}
          </View>
        </View>

        <View className="mx-6 mb-5">
          {renderSectionHeader('Student information', 'Your school and contact details.', 'Edit', () => router.push('/edit-profile'))}
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {renderInfoRow('school', 'School', school)}
            {renderInfoRow('menu-book', 'Course', course)}
            {renderInfoRow('format-list-numbered', 'Year level', yearLevel)}
            {renderInfoRow('location-on', 'Location', location)}
          </View>
        </View>

        <View className="mx-6 mb-5">
          {renderSectionHeader('Skills', 'Add up to 5 skills you want to be known for.', 'Add', handleAddSkill, 'add')}
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {validSkills.length > 0 ? <View className="flex-row flex-wrap gap-2">{skills.map((skill, index) => {
              if (typeof skill !== 'string' || !skill.trim()) return null;
              return <View key={`${skill}-${index}`} className="max-w-full flex-row items-center gap-1 rounded-xl pl-3 pr-1 py-1" style={{ backgroundColor: subtle }}><Text className="text-xs font-medium shrink" style={{ color: colors.text }}>{skill}</Text><TouchableOpacity onPress={() => handleSaveSkills(skills.filter((_, i) => i !== index))} activeOpacity={0.75} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Remove ${skill} skill`} className="w-9 h-9 items-center justify-center rounded-lg"><MaterialIcons name="close" size={16} color={accentText} /></TouchableOpacity></View>;
            })}</View> : <View className="flex-row items-center gap-3 rounded-xl p-3" style={{ backgroundColor: subtle }}><MaterialIcons name="auto-awesome" size={20} color={accentText} /><Text className="flex-1 text-xs leading-5" style={{ color: colors.textSecondary }}>No skills yet. Add your strengths to help employers find you.</Text></View>}
          </View>
        </View>

        <View className="mx-6 mb-5">
          {renderSectionHeader('Availability', 'Let employers know when you can work.', 'Edit', () => setAvailabilityModalVisible(true))}
          <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {renderInfoRow('schedule', 'Available schedule', formatScheduleText())}
            {renderInfoRow('work-outline', 'Preferred job type', 'Part-time')}
          </View>
        </View>

        <View className="mx-6">
          <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>Account & support</Text>
          <View className="rounded-3xl border overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {menuItems.map((item, index) => (
              <TouchableOpacity key={item.label} onPress={() => { if (item.danger) setLogoutModalVisible(true); else router.push(item.route as any); }} activeOpacity={0.75} accessibilityRole="button" className={index === menuItems.length - 1 ? 'flex-row items-center gap-3 px-5 py-4' : 'flex-row items-center gap-3 px-5 py-4 border-b'} style={{ borderColor: colors.border }}>
                <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={20} color={accentText} /></View>
                <Text className="flex-1 text-sm font-medium" style={{ color: item.danger ? accentText : colors.text }}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={accentText} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <LoadingModal visible={uploadingProfilePicture || uploadingDocument !== null} message={uploadingProfilePicture ? 'Uploading profile picture...' : uploadingDocument === 'student_resume' ? 'Uploading resume...' : 'Uploading verification document...'} />
      <AddSkillModal
        visible={isAddSkillModalVisible}
        existingSkills={skills}
        onClose={() => setAddSkillModalVisible(false)}
        onAddSkill={(newSkills) => {
          const incoming = Array.isArray(newSkills) ? newSkills : [newSkills];
          const combined = Array.from(new Set([...skills, ...incoming]));
          if (combined.length > 5) {
            showAlertModal({
              title: 'Skill Limit Reached',
              message: 'You can only have up to 5 skills. The first 5 skills have been saved.',
              iconName: 'warning',
              iconColor: '#f59e0b',
              iconBgColor: 'bg-amber-50',
              primaryButtonText: 'OK',
              onPrimaryPress: () => setAlertModalVisible(false),
            });
          }
          handleSaveSkills(combined.slice(0, 5));
        }}
      />

      <EditAvailabilityModal
        visible={isAvailabilityModalVisible}
        onClose={() => setAvailabilityModalVisible(false)}
        currentDays={selectedDays}
        currentTimeSlot={selectedTimeSlot}
        currentSlots={scheduleSlots}
        onSave={handleSaveAvailability}
      />

      <NotificationModal
        visible={alertModalVisible}
        title={alertModalConfig.title}
        message={alertModalConfig.message}
        iconName={alertModalConfig.iconName}
        iconColor={alertModalConfig.iconColor}
        iconBgColor={alertModalConfig.iconBgColor}
        primaryButtonText={alertModalConfig.primaryButtonText}
        onPrimaryPress={alertModalConfig.onPrimaryPress}
      />

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
        buttonLayout="row"
      />
      <DocumentViewerModal visible={viewerModalVisible} onClose={() => setViewerModalVisible(false)} title={viewerConfig.title} uri={viewerConfig.uri} filename={viewerConfig.filename} refreshUri={() => viewerConfig.field ? fetchDocumentUri(viewerConfig.field) : Promise.resolve(null)} />
      <SideDrawerMenu visible={isDrawerVisible} onClose={() => setDrawerVisible(false)} user={{ name: String(studentName || 'Student'), role: 'student', avatarUri: profilePicUri || undefined, avatarInitials: studentName ? studentName.trim().substring(0, 2).toUpperCase() : 'ST', isVerified: Boolean(isVerified), rejectionReason: rejectionReason || null }} onLogout={handleLogout} />
    </View>
  );
}
