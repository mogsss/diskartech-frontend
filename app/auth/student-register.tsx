  import BaseRegisterScreen from '@/components/BaseRegisterScreen';
  import LocationPickerModal from '@/components/LocationPickerModal';
  import GenderModal from '@/components/GenderModal';
  import CourseModal from '@/components/modals/student/CourseModal';
  import YearLevelModal from '@/components/modals/student/YearLevelModal';
  import InputField from '@/components/ui/InputField';
  import PrimaryButton from '@/components/ui/PrimaryButton';
  import { Colors } from '@/constants/colors';
  import { MaterialIcons } from '@expo/vector-icons';
  import { router } from 'expo-router';
  import React, { useState } from 'react';
  import { Alert, Text, TouchableOpacity, View } from 'react-native';
  import axios from 'axios'; // Idagdag ang axios

  export default function RegisterStudentScreen() {
    const [step, setStep] = useState(1);

    // Personal Info States
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
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
    const [loading, setLoading] = useState(false);

    // Modals Visibility States
    const [genderModalVisible, setGenderModalVisible] = useState(false);
    const [courseModalVisible, setCourseModalVisible] = useState(false);
    const [yearModalVisible, setYearModalVisible] = useState(false);

    const handleNext = () => {
      if (step === 1) {
        if (!firstName || !lastName || !age || !gender || !phone || !selectedAddress) {
          Alert.alert('Error', 'Please fill in all personal information and pinpoint your location.');
          return;
        }
        setStep(2);
      } else if (step === 2) {
        if (!school || !course || !yearLevel) {
          Alert.alert('Error', 'Please complete your school information.');
          return;
        }
        setStep(3);
      }
    };

    // Konekta sa Laravel Backend gamit ang Axios
    const handleRegister = async () => {
      if (!email || !password || !confirmPassword) {
        Alert.alert('Error', 'Please fill in all account credentials.');
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match.');
        return;
      }

      setLoading(true);

      try {
        const response = await axios.post('http://192.168.1.2:8000/api/register', {
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
          email: email,
          password: password,
        });

        if (response.data.status === 'success') {
          Alert.alert('Success', 'Student account created successfully!');
          router.replace('/auth/login');
        }
      } catch (error: any) {
        console.error(error);
        // Ito ang magpapakita ng eksaktong error galing sa Laravel backend sa screen mo
        const errorMsg = error.response?.data?.message || error.message;
        Alert.alert('Registration Failed', errorMsg);
      }
    };

    const handleBack = () => {
      if (step > 1) setStep(step - 1);
      else router.back();
    };

    return (
      <BaseRegisterScreen
        activeTab="student"
        step={step}
        stepTitles={['Personal', 'School', 'Account']}
        title="Create Student Account"
        subtitle="Find the perfect part-time job for your studies"
        onBack={handleBack}
      >
        {/* STEP 1 */}
        {step === 1 && (
          <View>
            <InputField label="First Name" placeholder="Enter your first name" keyboardType="default" icon="person" value={firstName} onChangeText={setFirstName} />
            <InputField label="Middle Name (Optional)" placeholder="Enter your middle name" keyboardType="default" icon="person-outline" value={middleName} onChangeText={setMiddleName} />
            <InputField label="Last Name" placeholder="Enter your last name" keyboardType="default" icon="person" value={lastName} onChangeText={setLastName} />
            <InputField label="Age" placeholder="Enter your age" keyboardType="number-pad" maxLength={2} icon="cake" value={age} onChangeText={setAge} />

            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-700 mb-1.5">Gender</Text>
              <TouchableOpacity 
                onPress={() => setGenderModalVisible(true)}
                className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5"
              >
                <MaterialIcons name="wc" size={20} color={Colors.gray500} style={{ marginRight: 12 }} />
                <Text className={`flex-1 text-base ${gender ? 'text-slate-900' : 'text-slate-400'}`}>
                  {gender || 'Select Gender'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <InputField label="Phone Number" placeholder="Enter your phone number" keyboardType="phone-pad" icon="phone" value={phone} onChangeText={setPhone} />

            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-700 mb-1.5">Location</Text>
              <TouchableOpacity 
                onPress={() => setMapModalVisible(true)}
                className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5"
              >
                <MaterialIcons name="map" size={20} color={Colors.gray500} style={{ marginRight: 12 }} />
                <Text className={`flex-1 text-base ${selectedAddress ? 'text-slate-900' : 'text-slate-400'}`} numberOfLines={1}>
                  {selectedAddress || 'Drag the Pin to your location'}
                </Text>
                <MaterialIcons name="chevron-right" size={24} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <InputField 
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

        {/* STEP 2 */}
        {step === 2 && (
          <View>
            <InputField label="School Name" placeholder="Enter your school name" icon="school" value={school} onChangeText={setSchool} />
            
            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-700 mb-1.5">Course / Program</Text>
              <TouchableOpacity 
                onPress={() => setCourseModalVisible(true)}
                className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5"
              >
                <MaterialIcons name="menu-book" size={20} color={Colors.gray500} style={{ marginRight: 12 }} />
                <Text className={`flex-1 text-base ${course ? 'text-slate-900' : 'text-slate-400'}`}>
                  {course || 'Select your course'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-slate-700 mb-1.5">Year Level</Text>
              <TouchableOpacity 
                onPress={() => setYearModalVisible(true)}
                className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5"
              >
                <MaterialIcons name="format-list-numbered" size={20} color={Colors.gray500} style={{ marginRight: 12 }} />
                <Text className={`flex-1 text-base ${yearLevel ? 'text-slate-900' : 'text-slate-400'}`}>
                  {yearLevel || 'Select your year level'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              onPress={handleNext}
              className="bg-red-600 rounded-2xl py-4 items-center justify-center mt-6 shadow-sm"
            >
              <Text className="text-white font-bold text-base">NEXT</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <View>
            <InputField label="Email Address" placeholder="Enter your email" keyboardType="email-address" autoCapitalize="none" icon="email" value={email} onChangeText={setEmail} />
            <InputField label="Password" placeholder="Create a password" isPassword icon="lock" value={password} onChangeText={setPassword} />
            <InputField label="Confirm Password" placeholder="Confirm your password" isPassword icon="lock" value={confirmPassword} onChangeText={setConfirmPassword} />

            <PrimaryButton
              title={loading ? "Creating Account..." : "CREATE ACCOUNT"}
              onPress={handleRegister}
              size="large"
              style={{ marginTop: 24, backgroundColor: '#DC2626' }}
              disabled={loading}
            />
          </View>
        )}

        {/* EXTERNAL MODALS */}
        <LocationPickerModal
          visible={mapModalVisible}
          onClose={() => setMapModalVisible(false)}
          onSelectLocation={(data) => {
            setSelectedAddress(data.address);
            setLatitude(data.latitude);
            setLongitude(data.longitude);
          }}
        />

        <GenderModal
          visible={genderModalVisible}
          onClose={() => setGenderModalVisible(false)}
          onSelect={setGender}
          selectedGender={gender}
        />

        <CourseModal
          visible={courseModalVisible}
          onClose={() => setCourseModalVisible(false)}
          onSelect={setCourse}
          selectedCourse={course}
        />

        <YearLevelModal
          visible={yearModalVisible}
          onClose={() => setYearModalVisible(false)}
          onSelect={setYearLevel}
          selectedYear={yearLevel}
        />
      </BaseRegisterScreen>
    );
  }