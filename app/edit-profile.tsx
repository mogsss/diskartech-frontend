import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import LocationPickerModal from '@/components/ui/modals/LocationPickerModal';
import CourseModal from '@/components/student/modals/CourseModal';
import YearLevelModal from '@/components/student/modals/YearLevelModal';
import BusinessTypeModal from '@/components/employer/modals/BusinessTypeModal';
import HirerProfileForm from '@/components/employer/profile/HirerProfileForm';
import StudentProfileForm from '@/components/student/StudentProfileForm';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<'student' | 'employer' | 'household'>('student');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Personal name fields for students and hirers
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');

  // Employer business name stays separate from the hirer's personal name
  const [companyName, setCompanyName] = useState('');
  const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');

  // Common Fields
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Student Specific Fields
  const [school, setSchool] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  // Employer Specific Fields
  const [businessType, setBusinessType] = useState('');

  // Modals
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [yearModalVisible, setYearModalVisible] = useState(false);
  const [businessTypeModalVisible, setBusinessTypeModalVisible] = useState(false);

  // Notification Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    iconName: keyof typeof MaterialIcons.glyphMap;
    iconColor: string;
    iconBgColor: string;
    primaryButtonText: string;
    onPrimaryPress: () => void;
  }>({
    title: '',
    message: '',
    iconName: 'check-circle',
    iconColor: '#059669',
    iconBgColor: 'bg-emerald-50',
    primaryButtonText: 'OK',
    onPrimaryPress: () => {},
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const storedUser = await AsyncStorage.getItem('userData');
      const storedProfile = await AsyncStorage.getItem('userProfile');

      let currentRole: 'student' | 'employer' | 'household' = 'student';
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role) {
          currentRole = parsedUser.role;
        } else if (parsedUser.household_name) {
          currentRole = 'household';
        } else if (parsedUser.employer_name || parsedUser.business_name) {
          currentRole = 'employer';
        }
        setEmail(parsedUser.email || '');
      }
      setRole(currentRole);

      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        populateFields(currentRole, parsed);
      }

      // Sync fresh from backend
      try {
        const endpoint = currentRole === 'student' ? '/student/profile' : '/user/profile';
        const res = await api.get(endpoint);
        const freshProfile = res.data.profile || res.data;
        if (freshProfile) {
          populateFields(currentRole, freshProfile);
          await AsyncStorage.setItem('userProfile', JSON.stringify(freshProfile));
        }
      } catch (err) {
        console.log('Online sync failed, relying on storage:', err);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const populateFields = (userRole: string, profile: any) => {
    const populateHirerName = (name: string) => {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      setFirstName(parts[0] || '');
      setMiddleName(parts.length > 2 ? parts.slice(1, -1).join(' ') : '');
      setLastName(parts.length > 1 ? parts[parts.length - 1] : '');
    };

    if (userRole === 'student') {
      if (profile.first_name || profile.last_name) {
        setFirstName(profile.first_name || '');
        setMiddleName(profile.middle_name || '');
        setLastName(profile.last_name || '');
      } else {
        const rawName = (profile.student_name || profile.name || '').trim();
        const parts = rawName.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          setFirstName(parts[0]);
          setMiddleName('');
          setLastName('');
        } else if (parts.length === 2) {
          setFirstName(parts[0]);
          setMiddleName('');
          setLastName(parts[1]);
        } else if (parts.length >= 3) {
          setFirstName(parts[0]);
          setMiddleName(parts.slice(1, -1).join(' '));
          setLastName(parts[parts.length - 1]);
        }
      }
      setSchool(profile.student_school_name || profile.school || '');
      setCourse(profile.course || '');
      setYearLevel(profile.year_level || '');
      setPhone(profile.contact_number || profile.phone_number || '');
      setLocation(profile.location || '');
      setDetailedAddress(profile.detailed_address || '');
      if (profile.latitude) setLatitude(Number(profile.latitude));
      if (profile.longitude) setLongitude(Number(profile.longitude));
    } else if (userRole === 'employer') {
      setCompanyName(profile.employer_name || profile.business_name || profile.name || '');
      populateHirerName(profile.hirer_name || '');
      setBusinessType(profile.business_type || '');
      setPhone(profile.contact_number || profile.phone_number || '');
      setLocation(profile.location || '');
      setDetailedAddress(profile.detailed_address || '');
      if (profile.latitude) setLatitude(Number(profile.latitude));
      if (profile.longitude) setLongitude(Number(profile.longitude));
    } else if (userRole === 'household') {
      populateHirerName(profile.household_name || profile.name || '');
      setPhone(profile.cp_number || profile.contact_number || '');
      setLocation(profile.location || '');
      setDetailedAddress(profile.detailed_address || '');
      if (profile.latitude) setLatitude(Number(profile.latitude));
      if (profile.longitude) setLongitude(Number(profile.longitude));
    }
  };

  const handleSave = async () => {
    if (role === 'student') {
      if (!firstName.trim() || !lastName.trim()) {
        showNotice('Missing Information', 'Please provide both your First Name and Last Name.', 'error-outline', '#DC2626', 'bg-red-50');
        return;
      }
    } else {
      if (!firstName.trim() || !lastName.trim() || (role === 'employer' && !companyName.trim())) {
        showNotice('Missing Information', role === 'employer'
          ? 'Please provide your business name and the hirer\'s first and last name.'
          : 'Please provide the household representative\'s first and last name.', 'error-outline', '#DC2626', 'bg-red-50');
        return;
      }
      if (fullName.length > 255) {
        showNotice('Invalid Name', 'Please keep the complete name within 255 characters.', 'error-outline', '#DC2626', 'bg-red-50');
        return;
      }
    }

    try {
      setSaving(true);
      const payload: any = {
        location: location.trim(),
        detailed_address: detailedAddress.trim(),
        contact_number: phone.trim(),
      };

      if (latitude) payload.latitude = latitude;
      if (longitude) payload.longitude = longitude;

      if (role === 'student') {
        payload.first_name = firstName.trim();
        payload.middle_name = middleName.trim();
        payload.last_name = lastName.trim();
        payload.student_name = fullName;
        payload.name = fullName;
        payload.school = school.trim();
        payload.student_school_name = school.trim();
        payload.course = course.trim();
        payload.year_level = yearLevel.trim();
        payload.phone_number = phone.trim();
      } else if (role === 'employer') {
        payload.name = companyName.trim();
        payload.employer_name = companyName.trim();
        payload.hirer_name = fullName;
        payload.business_type = businessType.trim();
      } else if (role === 'household') {
        payload.name = fullName;
        payload.household_name = fullName;
        payload.cp_number = phone.trim();
      }

      const response = await api.post('/user/update-profile', payload);

      if (response.data.status === 'success') {
        const updatedProfile = response.data.profile;
        if (updatedProfile) {
          await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        }

        // Update local user data name if available
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          if (role === 'student') {
            userObj.student_name = fullName;
          } else if (role === 'employer') {
            userObj.employer_name = companyName.trim();
            userObj.hirer_name = fullName;
          } else if (role === 'household') {
            userObj.household_name = fullName;
          }
          await AsyncStorage.setItem('userData', JSON.stringify(userObj));
        }

        setModalConfig({
          title: 'Profile Updated!',
          message: 'Your profile details have been successfully saved.',
          iconName: 'check-circle',
          iconColor: '#059669',
          iconBgColor: 'bg-emerald-50',
          primaryButtonText: 'Done',
          onPrimaryPress: () => {
            setModalVisible(false);
            router.back();
          },
        });
        setModalVisible(true);
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      const msg = err.response?.data?.message || 'Failed to update profile. Please check your connection.';
      showNotice('Save Failed', msg, 'error-outline', '#DC2626', 'bg-red-50');
    } finally {
      setSaving(false);
    }
  };

  const showNotice = (title: string, message: string, iconName: keyof typeof MaterialIcons.glyphMap, iconColor: string, iconBgColor: string) => {
    setModalConfig({
      title,
      message,
      iconName,
      iconColor,
      iconBgColor,
      primaryButtonText: 'OK',
      onPrimaryPress: () => setModalVisible(false),
    });
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <SafeStatusBar />
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }} className="text-sm font-medium">
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeStatusBar backgroundColor={colors.surface} />

      <View className="border-b" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <View className="w-full max-w-2xl self-center px-5 pt-1 pb-3 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Go back to profile" accessibilityState={{ disabled: saving }} className="w-11 h-11 items-center justify-center" style={{ opacity: saving ? 0.5 : 1 }}><MaterialIcons name="arrow-back" size={23} color={isDark ? colors.text : '#000000'} /></TouchableOpacity>
          <View className="flex-1"><Text className="text-lg font-bold leading-7" style={{ color: colors.text }}>Edit profile</Text><Text className="text-xs leading-5" style={{ color: colors.textSecondary }}>{role === 'student' ? 'Student account' : role === 'employer' ? 'Business account' : 'Household account'}</Text></View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="w-full max-w-2xl self-center px-5 pt-5 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {role === 'student' ? (
            <StudentProfileForm
              values={{ firstName, middleName, lastName, school, course, yearLevel, phone, email, location, detailedAddress }}
              saving={saving}
              onChange={(field, value) => ({
                firstName: setFirstName,
                middleName: setMiddleName,
                lastName: setLastName,
                school: setSchool,
                phone: setPhone,
                detailedAddress: setDetailedAddress,
              })[field](value)}
              onChooseCourse={() => setCourseModalVisible(true)}
              onChooseYearLevel={() => setYearModalVisible(true)}
              onChooseLocation={() => setLocationPickerVisible(true)}
            />
          ) : (
            <HirerProfileForm
              role={role}
              values={{ companyName, firstName, middleName, lastName, phone, email, businessType, location, detailedAddress }}
              saving={saving}
              onChange={(field, value) => ({
                companyName: setCompanyName,
                firstName: setFirstName,
                middleName: setMiddleName,
                lastName: setLastName,
                phone: setPhone,
                detailedAddress: setDetailedAddress,
              })[field](value)}
              onChooseBusinessType={() => setBusinessTypeModalVisible(true)}
              onChooseLocation={() => setLocationPickerVisible(true)}
            />
          )}
        </ScrollView>
        <View className="border-t" style={{ backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="w-full max-w-2xl self-center px-5 pt-3 flex-row items-stretch gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={saving}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel="Cancel profile changes"
              accessibilityState={{ disabled: saving }}
              className="rounded-xl px-4 items-center justify-center"
              style={{ minHeight: 52, minWidth: 84, opacity: saving ? 0.5 : 1 }}
            >
              <Text className="text-sm font-semibold leading-5" style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={saving ? 'Saving profile changes' : 'Save profile changes'}
              accessibilityState={{ disabled: saving, busy: saving }}
              className="flex-1 min-w-0 rounded-xl px-4 py-3 flex-row items-center justify-center gap-2"
              style={{ minHeight: 52, backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }}
            >
              {saving && <ActivityIndicator size="small" color="#FFFFFF" />}
              <Text className="text-sm font-semibold leading-5 text-center" style={{ color: '#FFFFFF', flexShrink: 1 }}>
                {saving ? 'Saving…' : 'Save changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        initialLatitude={latitude || undefined}
        initialLongitude={longitude || undefined}
        onSelectLocation={(loc) => {
          setLocation(loc.address);
          setLatitude(loc.latitude);
          setLongitude(loc.longitude);
          setLocationPickerVisible(false);
        }}
      />

      {/* Select Modals */}
      <CourseModal
        visible={courseModalVisible}
        onClose={() => setCourseModalVisible(false)}
        onSelect={(selected) => setCourse(selected)}
        selectedCourse={course}
      />

      <YearLevelModal
        visible={yearModalVisible}
        onClose={() => setYearModalVisible(false)}
        onSelect={(selected) => setYearLevel(selected)}
        selectedYear={yearLevel}
      />

      <BusinessTypeModal
        visible={businessTypeModalVisible}
        onClose={() => setBusinessTypeModalVisible(false)}
        onSelect={(selected) => setBusinessType(selected)}
        selectedType={businessType}
      />

      {/* Notification Modal */}
      <NotificationModal
        visible={modalVisible}
        title={modalConfig.title}
        message={modalConfig.message}
        iconName={modalConfig.iconName}
        iconColor={modalConfig.iconColor}
        iconBgColor={modalConfig.iconBgColor}
        primaryButtonText={modalConfig.primaryButtonText}
        onPrimaryPress={modalConfig.onPrimaryPress}
      />
    </View>
  );
}
