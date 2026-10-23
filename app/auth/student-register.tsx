import BaseRegisterScreen from '@/components/ui/BaseRegisterScreen';
import LocationPickerModal from '@/components/ui/modals/LocationPickerModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import GenderModal from '@/components/ui/modals/GenderModal';
import CourseModal from '@/components/student/modals/CourseModal';
import YearLevelModal from '@/components/student/modals/YearLevelModal';
import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import GoogleRegisterButton from '@/components/auth/GoogleRegisterButton';
import { GoogleAuthProfile } from '@/utils/googleAuth';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useToast } from '@/hooks/useToast';
import { useRegistrationKeyboard } from '@/hooks/useRegistrationKeyboard';
import { isValidMobileNumber, MOBILE_NUMBER_ERROR } from '@/utils/phoneNumber';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import api from '@/api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getAgeError = (value: string) => {
  if (!value.trim()) return 'Age is required.';
  if (!/^\d+$/.test(value)) return 'Please enter a valid age in whole years.';
  if (Number(value) < 18) return 'You must be at least 18 years old to register.';
  return '';
};

type RegistrationField = 'firstName' | 'lastName' | 'age' | 'gender' | 'phone' | 'location'
  | 'school' | 'course' | 'yearLevel' | 'email' | 'password' | 'confirmPassword';
type RegistrationInput = Exclude<RegistrationField, 'gender' | 'location' | 'course' | 'yearLevel'>
  | 'middleName' | 'detailedAddress';

export default function RegisterStudentScreen() {
  const { showToast } = useToast();
  const { colors } = useDarkMode();
  const [step, setStep] = useState(1);
  const { formScrollRef, formScrollProps, inputNavigation, resetKeyboard } = useRegistrationKeyboard<RegistrationInput>();

  // Google OAuth Link State
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  // Personal Info States
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [ageError, setAgeError] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);

  // School Info States
  const [school, setSchool] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  // Account States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [touched, setTouched] = useState<Partial<Record<RegistrationField, boolean>>>({});

  const touchFields = (...fields: RegistrationField[]) => {
    setTouched(previous => ({ ...previous, ...Object.fromEntries(fields.map(field => [field, true])) }));
  };

  const handleGoogleProfile = (profile: GoogleAuthProfile) => {
    setFirstName(profile.firstName);
    setMiddleName('');
    setLastName(profile.lastName);
    setEmail(profile.email);
    setAvatarUrl(profile.photoUrl || '');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setRegistrationError('');
    // Secure random password meeting requirements: Uppercase, Lowercase, Number, Special char, 8+ chars
    const generatedPwd = `G_${Math.random().toString(36).slice(-5).toUpperCase()}${Math.floor(100 + Math.random() * 900)}!x`;
    setPassword(generatedPwd);
    setConfirmPassword(generatedPwd);
    setIsGoogleLinked(true);
  };

  // Live Password Checkers
  const hasUpper = /[A-Z]/.test(password);
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const fieldErrors: Record<RegistrationField, string> = {
    firstName: firstName.trim() ? '' : 'First name is required.',
    lastName: lastName.trim() ? '' : 'Last name is required.',
    age: ageError || getAgeError(age),
    gender: gender ? '' : 'Please select your gender.',
    phone: isValidMobileNumber(phone) ? '' : MOBILE_NUMBER_ERROR,
    location: selectedAddress ? '' : 'Please pinpoint your location on the map.',
    school: school.trim() ? '' : 'School name is required.',
    course: course ? '' : 'Please select your course or program.',
    yearLevel: yearLevel ? '' : 'Please select your year level.',
    email: emailError || (!email.trim() ? 'Email address is required.'
      : email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Enter a valid email address.' : ''),
    password: passwordError || (!password ? 'Password is required.'
      : !hasMinLength || !hasNumber || !hasUpper || !hasSpecialChar ? 'Please meet all password requirements.' : ''),
    confirmPassword: confirmPasswordError || (!confirmPassword ? 'Please confirm your password.'
      : password !== confirmPassword ? 'Passwords do not match.' : ''),
  };
  const visibleError = (field: RegistrationField) => touched[field] ? fieldErrors[field] : undefined;

  // Modals Visibility States
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [yearModalVisible, setYearModalVisible] = useState(false);

  const validateAge = () => {
    const error = getAgeError(age);
    setAgeError(error);
    return !error;
  };

  const validatePhone = () => {
    if (isValidMobileNumber(phone)) return true;
    showToast({ type: 'error', message: MOBILE_NUMBER_ERROR });
    return false;
  };

  const handleNext = () => {
    if (step === 1) {
      touchFields('firstName', 'lastName', 'age', 'gender', 'phone', 'location');
      if (!validateAge()) return;
      if (!firstName.trim() || !lastName.trim() || !age || !gender || !phone || !selectedAddress) {
        showToast({ type: 'error', message: 'Please fill in all personal information and pinpoint your location.' });
        return;
      }
      if (!validatePhone()) return;
      resetKeyboard();
      setStep(2);
    } else if (step === 2) {
      touchFields('school', 'course', 'yearLevel');
      if (!school.trim() || !course || !yearLevel) {
        showToast({ type: 'error', message: 'Please complete your school information.' });
        return;
      }
      resetKeyboard();
      setStep(3);
    }
  };

  const handleRegister = async () => {
    touchFields('age', 'phone', 'email', 'password', 'confirmPassword');
    if (!validateAge()) {
      setStep(1);
      return;
    }
    if (!validatePhone()) {
      setStep(1);
      return;
    }
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    let hasError = false;

    if (!email.trim() || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(!email.trim() ? 'Email address is required.' : 'Enter a valid email address.');
      hasError = true;
    }

    if (!isGoogleLinked) {
      if (!hasMinLength || !hasNumber || !hasUpper || !hasSpecialChar) {
        setPasswordError('Please meet all password requirements.');
        hasError = true;
      }

      if (password !== confirmPassword) {
        setConfirmPasswordError('Passwords do not match.');
        hasError = true;
      }
    }

    if (hasError) return;

    setLoading(true);

    try {
      const response = await api.post('/register/student', {
        registered_with_google: isGoogleLinked,
        role: 'student',
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        age: age,
        gender: gender,
        phone: phone,
        address: selectedAddress,
        detailed_address: detailedAddress,
        latitude: latitude,
        longitude: longitude,
        school_name: school,
        course: course,
        year_level: yearLevel,
        email: email.trim(),
        password: password,
        avatar: avatarUrl || null,
      });

      if (response.data.status === 'success') {
        const { token, user, student_profile } = response.data;

        if (token) {
          await AsyncStorage.setItem('userToken', token);
        }
        const userDataToSave = user || {
          email: email,
          role: 'student',
          isEmailVerified: false,
        };
        await AsyncStorage.setItem('userData', JSON.stringify({ ...userDataToSave, registered_with_google: isGoogleLinked, authentication_method: isGoogleLinked ? 'google' : 'password' }));

        if (student_profile) {
          await AsyncStorage.setItem('userProfile', JSON.stringify(student_profile));
        }

        // Diretsong pumunta sa Verify Email screen habang ipinapasa ang email at role
        router.replace({
          pathname: '/auth/verify-email',
          params: { email: email, role: 'student' },
        });
      }
    } catch (error: any) {
      if (error.response && error.response.status === 422) {
        const errors: Record<string, string[]> = error.response.data?.errors ?? {};
        if (errors.age) {
          setAgeError(errors.age[0]);
          setStep(1);
        }
        if (errors.email) setEmailError(errors.email[0]);
        if (errors.password) setPasswordError(errors.password[0]);
        setRegistrationError(
          Object.values(errors).flat().join('\n')
          || error.response.data?.message
          || 'Please review your information and try again.'
        );
      } else {
        console.error(error);
        const errorMsg = error.response?.data?.message || error.message;
        Alert.alert('Registration Failed', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    resetKeyboard();
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  return (
    <BaseRegisterScreen
      activeTab="student"
      hasUnsavedChanges={step > 1 || isGoogleLinked || latitude !== null || longitude !== null || [firstName, middleName, lastName, age, gender, phone, selectedAddress, detailedAddress, school, course, yearLevel, email, password, confirmPassword].some(Boolean)}
      submitting={loading}
      step={step}
      stepTitles={['Personal', 'School', 'Account']}
      title="Create Student Account"
      subtitle="Find the perfect part-time job for your studies"
      onBack={handleBack}
      scrollViewRef={formScrollRef}
      scrollViewProps={formScrollProps}
    >
      {/* --- STEP 1: PERSONAL INFO --- */}
      {step === 1 && (
        <View>
          <GoogleRegisterButton
            onGoogleProfileLoaded={handleGoogleProfile}
            linkedEmail={isGoogleLinked ? email : undefined}
            disabled={loading}
            linkedName={isGoogleLinked ? `${firstName} ${lastName}`.trim() : undefined}
            linkedPhoto={isGoogleLinked ? avatarUrl : undefined}
            onUnlink={() => {
              setIsGoogleLinked(false);
              setAvatarUrl('');
              setPassword('');
              setConfirmPassword('');
            }}
          />

          {!isGoogleLinked && (
            <>
              <InputField {...inputNavigation('firstName', 'middleName')} label="First Name" placeholder="Juan" keyboardType="default" icon="person" value={firstName} error={visibleError('firstName')} onBlur={() => touchFields('firstName')} onChangeText={(value) => { setFirstName(value); touchFields('firstName'); }} />
              <InputField {...inputNavigation('middleName', 'lastName')} label="Middle Name (Optional)" placeholder="Cruz" keyboardType="default" icon="person-outline" value={middleName} onChangeText={setMiddleName} />
              <InputField {...inputNavigation('lastName', 'age')} label="Last Name" placeholder="Santos" keyboardType="default" icon="person" value={lastName} error={visibleError('lastName')} onBlur={() => touchFields('lastName')} onChangeText={(value) => { setLastName(value); touchFields('lastName'); }} />
            </>
          )}

          <InputField
            {...inputNavigation('age', 'phone')}
            label="Age"
            placeholder="Enter your age (18 or older)"
            keyboardType="number-pad"
            maxLength={2}
            icon="cake"
            value={age}
            error={visibleError('age')}
            onBlur={() => touchFields('age')}
            onChangeText={(value) => {
              setAge(value);
              setAgeError('');
              touchFields('age');
            }}
          />

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1.5" style={{ color: colors.text }}>Gender</Text>
            <TouchableOpacity
              onPress={() => setGenderModalVisible(true)}
              className="flex-row items-center border rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: colors.surface, borderColor: visibleError('gender') ? '#EF4444' : colors.border }}
            >
              <MaterialIcons name="wc" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <Text className="flex-1 text-base" style={{ color: gender ? colors.text : colors.textSecondary }}>
                {gender || 'Select Gender'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            {!!visibleError('gender') && <Text className="text-xs text-red-500 mt-1">{visibleError('gender')}</Text>}
          </View>

          <InputField {...inputNavigation('phone', 'detailedAddress')} label="Phone Number" placeholder="09123456789" keyboardType="number-pad" maxLength={11} icon="phone" value={phone} error={visibleError('phone')} onBlur={() => touchFields('phone')} onChangeText={(value) => { setPhone(value.replace(/[^0-9]/g, '').slice(0, 11)); touchFields('phone'); }} />

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1.5" style={{ color: colors.text }}>Location</Text>
            <TouchableOpacity
              onPress={() => setMapModalVisible(true)}
              className="flex-row items-center border rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: colors.surface, borderColor: visibleError('location') ? '#EF4444' : colors.border }}
            >
              <MaterialIcons name="map" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <Text className="flex-1 text-base" style={{ color: selectedAddress ? colors.text : colors.textSecondary }} numberOfLines={1}>
                {selectedAddress || 'Drag the Pin to your location'}
              </Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            {!!visibleError('location') && <Text className="text-xs text-red-500 mt-1">{visibleError('location')}</Text>}
          </View>

          <InputField
            {...inputNavigation('detailedAddress', handleNext)}
            label="Street, Barangay"
            placeholder="e.g., Manrique St., Brgy. Zone III"
            icon="home"
            value={detailedAddress}
            onChangeText={setDetailedAddress}
          />

          <TouchableOpacity
            onPress={handleNext}
            className="bg-red-600 rounded-2xl py-4 items-center justify-center mt-6 shadow-sm"
          >
            <Text className="text-white font-bold text-base">NEXT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- STEP 2: SCHOOL INFO --- */}
      {step === 2 && (
        <View>
          <InputField {...inputNavigation('school', () => setCourseModalVisible(true))} label="School Name" placeholder="Enter your school name" icon="school" value={school} error={visibleError('school')} onBlur={() => touchFields('school')} onChangeText={(value) => { setSchool(value); touchFields('school'); }} />

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1.5" style={{ color: colors.text }}>Course / Program</Text>
            <TouchableOpacity
              onPress={() => setCourseModalVisible(true)}
              className="flex-row items-center border rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: colors.surface, borderColor: visibleError('course') ? '#EF4444' : colors.border }}
            >
              <MaterialIcons name="menu-book" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <Text className="flex-1 text-base" style={{ color: course ? colors.text : colors.textSecondary }}>
                {course || 'Select your course'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            {!!visibleError('course') && <Text className="text-xs text-red-500 mt-1">{visibleError('course')}</Text>}
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold mb-1.5" style={{ color: colors.text }}>Year Level</Text>
            <TouchableOpacity
              onPress={() => setYearModalVisible(true)}
              className="flex-row items-center border rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: colors.surface, borderColor: visibleError('yearLevel') ? '#EF4444' : colors.border }}
            >
              <MaterialIcons name="format-list-numbered" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <Text className="flex-1 text-base" style={{ color: yearLevel ? colors.text : colors.textSecondary }}>
                {yearLevel || 'Select your year level'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            {!!visibleError('yearLevel') && <Text className="text-xs text-red-500 mt-1">{visibleError('yearLevel')}</Text>}
          </View>

          <TouchableOpacity
            onPress={handleNext}
            className="bg-red-600 rounded-2xl py-4 items-center justify-center mt-6 shadow-sm"
          >
            <Text className="text-white font-bold text-base">NEXT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- STEP 3: ACCOUNT CREDENTIALS & SECURITY --- */}
      {step === 3 && (
        <View>
          {isGoogleLinked ? (
            <GoogleRegisterButton
              onGoogleProfileLoaded={handleGoogleProfile}
              linkedEmail={email}
              disabled={loading}
              linkedName={`${firstName} ${lastName}`.trim()}
              linkedPhoto={avatarUrl}
            />
          ) : (
            <>
              <InputField
                {...inputNavigation('email', 'password')}
                label="Email Address"
                placeholder="example@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                icon="email"
                value={email}
                onChangeText={(text) => { setEmail(text); setEmailError(''); touchFields('email'); }}
                onBlur={() => touchFields('email')}
                error={visibleError('email')}
              />

              <InputField
                {...inputNavigation('password', 'confirmPassword')}
                label="Password"
                placeholder="********"
                isPassword
                icon="lock"
                value={password}
                onChangeText={(text) => { setPassword(text); setPasswordError(''); setConfirmPasswordError(''); touchFields('password'); }}
                onBlur={() => touchFields('password')}
                error={visibleError('password')}
              />

              {/* Live requirement checklist */}
              <View className="mb-4 px-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name={hasMinLength ? "check-circle" : "radio-button-unchecked"}
                    size={16}
                    color={hasMinLength ? "#16a34a" : "#9ca3af"}
                  />
                  <Text className={`text-xs ${hasMinLength ? "text-green-600 font-medium" : "text-slate-500"}`}>
                    At least 8 characters long
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name={hasNumber ? "check-circle" : "radio-button-unchecked"}
                    size={16}
                    color={hasNumber ? "#16a34a" : "#9ca3af"}
                  />
                  <Text className={`text-xs ${hasNumber ? "text-green-600 font-medium" : "text-slate-500"}`}>
                    Contains at least one number (0-9)
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name={hasUpper ? "check-circle" : "radio-button-unchecked"}
                    size={16}
                    color={hasUpper ? "#16a34a" : "#9ca3af"}
                  />
                  <Text className={`text-xs ${hasUpper ? "text-green-600 font-medium" : "text-slate-500"}`}>
                    Contains an Uppercase Letter
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <MaterialIcons
                    name={hasSpecialChar ? "check-circle" : "radio-button-unchecked"}
                    size={16}
                    color={hasSpecialChar ? "#16a34a" : "#9ca3af"}
                  />
                  <Text className={`text-xs ${hasSpecialChar ? "text-green-600 font-medium" : "text-slate-500"}`}>
                    Contains a special character (e.g., @, #, $)
                  </Text>
                </View>
              </View>

              <InputField
                {...inputNavigation('confirmPassword')}
                label="Confirm Password"
                placeholder="Confirm your password"
                isPassword
                icon="lock"
                value={confirmPassword}
                onChangeText={(text) => { setConfirmPassword(text); setConfirmPasswordError(''); touchFields('confirmPassword'); }}
                onBlur={() => touchFields('confirmPassword')}
                error={visibleError('confirmPassword')}
              />
            </>
          )}

          <PrimaryButton
            title={loading ? "Creating Account..." : isGoogleLinked ? "Verify Email" : "CREATE ACCOUNT"}
            onPress={handleRegister}
            size={isGoogleLinked ? 'medium' : 'large'}
            style={{ marginTop: isGoogleLinked ? 8 : 24, backgroundColor: '#DC2626' }}
            disabled={loading}
          />
        </View>
      )}

      {/* EXTERNAL MODALS */}
      <LocationPickerModal
        visible={mapModalVisible}
        onClose={() => { setMapModalVisible(false); touchFields('location'); }}
        onSelectLocation={(data) => {
          setSelectedAddress(data.address);
          setLatitude(data.latitude);
          setLongitude(data.longitude);
        }}
      />

      <GenderModal
        visible={genderModalVisible}
        onClose={() => { setGenderModalVisible(false); touchFields('gender'); }}
        onSelect={setGender}
        selectedGender={gender}
      />

      <CourseModal
        visible={courseModalVisible}
        onClose={() => { setCourseModalVisible(false); touchFields('course'); }}
        onSelect={setCourse}
        selectedCourse={course}
      />

      <YearLevelModal
        visible={yearModalVisible}
        onClose={() => { setYearModalVisible(false); touchFields('yearLevel'); }}
        onSelect={setYearLevel}
        selectedYear={yearLevel}
      />
      <NotificationModal
        visible={!!registrationError}
        title="Registration Failed"
        message={registrationError}
        iconName="error-outline"
        onPrimaryPress={() => setRegistrationError('')}
      />
    </BaseRegisterScreen>
  );
}
