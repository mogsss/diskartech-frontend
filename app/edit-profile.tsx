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
import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import LocationPickerModal from '@/components/ui/modals/LocationPickerModal';
import CourseModal from '@/components/student/modals/CourseModal';
import YearLevelModal from '@/components/student/modals/YearLevelModal';
import BusinessTypeModal from '@/components/employer/modals/BusinessTypeModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;
  const fieldBackground = isDark ? colors.background : '#F8FAFC';

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
      <SafeStatusBar backgroundColor={role === 'student' ? colors.surface : colors.background} />

      {role !== 'student' ? (
        <View className="w-full max-w-2xl self-center px-6 pt-2 pb-3 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Go back to profile" accessibilityState={{ disabled: saving }} className="w-12 h-12 rounded-2xl border items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border, opacity: saving ? 0.5 : 1 }}><MaterialIcons name="arrow-back" size={23} color={isDark ? colors.text : '#000000'} /></TouchableOpacity>
          <View className="flex-1"><Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>Edit profile</Text><Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>{role === 'employer' ? 'Business account' : 'Household account'}</Text></View>
        </View>
      ) : (
        <>
      {/* Top Header */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        }}
        className="flex-row items-center px-6 pt-3 pb-4 border-b"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: isDark ? '#334155' : '#F1F5F9' }}
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
        >
          <MaterialIcons name="arrow-back" size={24} color={isDark ? colors.text : '#000000'} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text style={{ color: colors.text }} className="text-xl font-bold">
            Edit Profile
          </Text>
          <Text style={{ color: colors.textSecondary }} className="text-xs mt-0.5">
            {role === 'student' ? 'Student Account' : role === 'employer' ? 'Business Account' : 'Household Account'}
          </Text>
        </View>
      </View>

        </>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={role === 'student' ? { padding: 20, paddingBottom: 60 } : undefined}
          contentContainerClassName={role !== 'student' ? 'w-full max-w-2xl self-center px-6 pt-2 pb-6' : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {role !== 'student' ? (
            <>
              <Text className="text-sm leading-6 mb-5" style={{ color: colors.textSecondary }}>Keep your {role === 'employer' ? 'business' : 'household'} name, contact details and location up to date.</Text>

              <View className="rounded-3xl border p-5 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row items-center gap-3 mb-5">
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={role === 'employer' ? 'business' : 'home-work'} size={21} color={accentText} /></View>
                  <View className="flex-1"><Text className="text-base font-bold" style={{ color: colors.text }}>{role === 'employer' ? 'Business information' : 'Household information'}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>How your account appears to students.</Text></View>
                </View>
                {role === 'employer' && <InputField iconColor={accentText} label="Business / company name *" placeholder="Enter your business name" value={companyName} onChangeText={setCompanyName} editable={!saving} icon="store" autoCapitalize="words" containerStyle={{ marginBottom: 18 }} />}
                <Text className="text-sm font-semibold mb-3" style={{ color: colors.text }}>{role === 'employer' ? 'Hirer name' : 'Household representative name'}</Text>
                <InputField iconColor={accentText} label="First name *" placeholder="Enter your first name" value={firstName} onChangeText={setFirstName} editable={!saving} icon="person-outline" autoCapitalize="words" maxLength={255} />
                <InputField iconColor={accentText} label="Middle name (optional)" placeholder="Enter your middle name" value={middleName} onChangeText={setMiddleName} editable={!saving} icon="person-outline" autoCapitalize="words" maxLength={255} />
                <InputField iconColor={accentText} label="Last name *" placeholder="Enter your last name" value={lastName} onChangeText={setLastName} editable={!saving} icon="person-outline" autoCapitalize="words" maxLength={255} containerStyle={{ marginBottom: role === 'employer' ? 16 : 0 }} />
                {role === 'employer' && <View>
                  <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Business type</Text>
                  <TouchableOpacity onPress={() => setBusinessTypeModalVisible(true)} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Select business type" accessibilityState={{ disabled: saving, expanded: businessTypeModalVisible }} className="min-h-14 flex-row items-center gap-3 rounded-xl border px-4 py-3" style={{ backgroundColor: fieldBackground, borderColor: colors.border }}>
                    <MaterialIcons name="category" size={20} color={accentText} /><Text className="flex-1 text-sm leading-5" style={{ color: businessType ? colors.text : colors.textSecondary }}>{businessType || 'Select business type'}</Text><MaterialIcons name="expand-more" size={23} color={accentText} />
                  </TouchableOpacity>
                </View>}
              </View>

              <View className="rounded-3xl border p-5 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row items-center gap-3 mb-5">
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="contact-phone" size={21} color={accentText} /></View>
                  <View className="flex-1"><Text className="text-base font-bold" style={{ color: colors.text }}>Contact details</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Your contact number and registered email.</Text></View>
                </View>
                <InputField iconColor={accentText} label="Contact number" placeholder="+63 9XX XXX XXXX" value={phone} onChangeText={setPhone} editable={!saving} keyboardType="phone-pad" icon="phone" />
                <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Registered emails</Text>
                <View className="min-h-14 flex-row items-center gap-3 rounded-xl border px-4 py-3" style={{ backgroundColor: fieldBackground, borderColor: colors.border }}>
                  <MaterialIcons name="mail-outline" size={20} color={accentText} /><Text className="flex-1 text-sm leading-5" style={{ color: colors.textSecondary }}>{email || 'No email registered'}</Text><MaterialIcons name="lock-outline" size={17} color={accentText} accessibilityLabel="Email is read only" />
                </View>
              </View>

              <View className="rounded-3xl border p-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row items-center gap-3 mb-5">
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="location-on" size={21} color={accentText} /></View>
                  <View className="flex-1"><Text className="text-base font-bold" style={{ color: colors.text }}>{role === 'employer' ? 'Business location' : 'Home address'}</Text><Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>Help nearby students find your job posts.</Text></View>
                </View>
                <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Pinned location</Text>
                <TouchableOpacity onPress={() => setLocationPickerVisible(true)} disabled={saving} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Choose location on map" accessibilityState={{ disabled: saving }} className="flex-row items-center gap-3 rounded-2xl border p-4 mb-5" style={{ backgroundColor: fieldBackground, borderColor: colors.border }}>
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name="map" size={21} color={accentText} /></View>
                  <View className="flex-1"><Text className="text-sm font-medium leading-5" style={{ color: location ? colors.text : colors.textSecondary }}>{location || 'Choose your location'}</Text><Text className="text-[11px] leading-4 mt-1" style={{ color: accentText }}>{location ? 'Change map pin' : 'Tap to open the map'}</Text></View>
                  <MaterialIcons name="chevron-right" size={22} color={accentText} />
                </TouchableOpacity>
                <InputField iconColor={accentText} label="Street address / landmark" placeholder="House number, street or nearby landmark" value={detailedAddress} onChangeText={setDetailedAddress} editable={!saving} icon="home" containerStyle={{ marginBottom: 0 }} />
              </View>
            </>
          ) : (
            <>
          {/* Section: Personal / Business Information */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 20,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <MaterialIcons name="person" size={20} color={accentText} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
                {role === 'student' ? 'Personal Information' : role === 'employer' ? 'Business Information' : 'Household Information'}
              </Text>
            </View>

            {/* If Student: Separate First, Middle, and Last Name */}
            {role === 'student' ? (
              <View>
                <InputField iconColor={accentText}
                  label="First Name"
                  placeholder="Enter your first name"
                  value={firstName}
                  onChangeText={setFirstName}
                  icon="person"
                />
                <InputField iconColor={accentText}
                  label="Middle Name (Optional)"
                  placeholder="Enter your middle name"
                  value={middleName}
                  onChangeText={setMiddleName}
                  icon="person-outline"
                />
                <InputField iconColor={accentText}
                  label="Last Name"
                  placeholder="Enter your last name"
                  value={lastName}
                  onChangeText={setLastName}
                  icon="person"
                />
              </View>
            ) : (
              <InputField iconColor={accentText}
                label={role === 'employer' ? 'Business / Company Name' : 'Household Representative Name'}
                placeholder="Enter name"
                value={companyName}
                onChangeText={setCompanyName}
                icon="badge"
              />
            )}

            {/* Read-only Email with Lock indicator */}
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                  Registered Email
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="lock" size={12} color={accentText} />
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Linked</Text>
                </View>
              </View>
              <View
                style={{
                  backgroundColor: isDark ? colors.background : '#F8FAFC',
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <MaterialIcons name="email" size={18} color={accentText} style={{ marginRight: 10 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{email || 'No email registered'}</Text>
              </View>
            </View>

            <InputField iconColor={accentText}
              label="Contact Number"
              placeholder="+63 9XX XXX XXXX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon="phone"
            />
          </View>

          {/* Section: Academic Information (Student Only) */}
          {role === 'student' && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 20,
                padding: 18,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
                <MaterialIcons name="school" size={20} color={accentText} />
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
                  Academic Information
                </Text>
              </View>

              <InputField iconColor={accentText}
                label="College / University"
                placeholder="e.g. Pamantasan ng Lungsod..."
                value={school}
                onChangeText={setSchool}
                icon="account-balance"
              />

              {/* Course Selector */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                  Course / Program
                </Text>
                <TouchableOpacity
                  onPress={() => setCourseModalVisible(true)}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                    <MaterialIcons name="menu-book" size={18} color={accentText} style={{ marginRight: 10 }} />
                    <Text
                      style={{
                        color: course ? colors.text : colors.textSecondary,
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {course || 'Select course'}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-drop-down" size={22} color={accentText} />
                </TouchableOpacity>
              </View>

              {/* Year Level Selector */}
              <View style={{ marginBottom: 6 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                  Year Level
                </Text>
                <TouchableOpacity
                  onPress={() => setYearModalVisible(true)}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                    <MaterialIcons name="format-list-numbered" size={18} color={accentText} style={{ marginRight: 10 }} />
                    <Text
                      style={{
                        color: yearLevel ? colors.text : colors.textSecondary,
                        fontSize: 14,
                      }}
                    >
                      {yearLevel || 'Select year level'}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-drop-down" size={22} color={accentText} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Section: Location & Address with LocationPickerModal */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 20,
              padding: 18,
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <MaterialIcons name="location-on" size={20} color={accentText} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold' }}>
                Address & Location
              </Text>
            </View>

            {/* Interactive Location Picker Button */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>
                Pinned Location (Map)
              </Text>
              <TouchableOpacity
                onPress={() => setLocationPickerVisible(true)}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <MaterialIcons name="map" size={20} color={accentText} style={{ marginRight: 10 }} />
                  <Text
                    style={{
                      color: location ? colors.text : colors.textSecondary,
                      fontSize: 14,
                    }}
                    numberOfLines={2}
                  >
                    {location || 'Tap to pin your location on the map'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={accentText} />
              </TouchableOpacity>
            </View>

            <InputField iconColor={accentText}
              label="Detailed Street Address / Landmark"
              placeholder="e.g. Zone 1, Brgy. Marfrancisco near Town Plaza"
              value={detailedAddress}
              onChangeText={setDetailedAddress}
              icon="home"
            />
          </View>

          {/* Save Button */}
          <PrimaryButton
            title={saving ? 'Saving Changes...' : 'Save Profile Changes'}
            onPress={handleSave}
            disabled={saving}
            size="large"
          />
            </>
          )}
        </ScrollView>
        {role !== 'student' && <View className="border-t" style={{ backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="w-full max-w-2xl self-center px-6 pt-3">
            <PrimaryButton title={saving ? 'Saving changes...' : 'Save changes'} onPress={handleSave} disabled={saving} loading={saving} size="medium" icon={<MaterialIcons name="check" size={18} color="#FFFFFF" />} />
          </View>
        </View>}
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
