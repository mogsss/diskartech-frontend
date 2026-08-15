import BaseRegisterScreen from '@/components/BaseRegisterScreen';
import LocationPickerModal from '@/components/LocationPickerModal';
import GenderModal from '@/components/GenderModal';
import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import axios from 'axios';

export default function RegisterHouseholdScreen() {
  const [step, setStep] = useState(1); // 1: Personal Info, 2: Address & Contact, 3: Account Security

  // Personal Info States
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  // Address & Location States
  const [address, setAddress] = useState('');
  const [detailedAddress, setDetailedAddress] = useState(''); // House No., Street, Landmark
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [mapModalVisible, setMapModalVisible] = useState(false);

  // Account States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal Visibility
  const [genderModalVisible, setGenderModalVisible] = useState(false);

  // Validation per step
  const handleNext = () => {
    if (step === 1) {
      if (!firstName || !lastName || !age || !gender) {
        Alert.alert('Error', 'Please fill in all personal information fields.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!address || !phone) {
        Alert.alert('Error', 'Please complete your home address location and phone number.');
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
        role: 'household',
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        age: age,
        gender: gender,
        phone: phone,
        address: address,
        detailed_address: detailedAddress,
        latitude: latitude,
        longitude: longitude,
        email: email,
        password: password,
      });

      if (response.data.status === 'success') {
        Alert.alert('Success', 'Household account created successfully!');
        router.replace('/employer/dashboard?type=household'); // <--- Itinuro sa tamang shared dashboard
      }
    } catch (error: any) {
      console.error('FULL AXIOS ERROR:', error.response?.data || error);
      
      const serverMsg = error.response?.data?.message 
        || (error.response?.data?.errors ? Object.values(error.response.data.errors).flat().join('\n') : null)
        || error.message 
        || 'Something went wrong during registration.';
        
      Alert.alert('Registration Failed', serverMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else router.back();
  };

  return (
    <BaseRegisterScreen
      activeTab="household"
      step={step}
      stepTitles={['Personal', 'Address', 'Security']}
      title="Create Household Account"
      subtitle="Register your home to hire kasambahay, drivers, or helpers"
      onBack={handleBack}
    >
      {/* --- STEP 1: PERSONAL INFORMATION --- */}
      {step === 1 && (
        <View>
          <InputField label="First Name" placeholder="Enter your first name" keyboardType="default" icon="person" value={firstName} onChangeText={setFirstName} />
          <InputField label="Middle Name (Optional)" placeholder="Enter your middle name" keyboardType="default" icon="person-outline" value={middleName} onChangeText={setMiddleName} />
          <InputField label="Last Name" placeholder="Enter your last name" keyboardType="default" icon="person" value={lastName} onChangeText={setLastName} />
          <InputField label="Age" placeholder="Enter your age" keyboardType="number-pad" maxLength={2} icon="cake" value={age} onChangeText={setAge} />

          {/* GENDER DROPDOWN */}
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

          <TouchableOpacity 
            onPress={handleNext}
            className="bg-red-600 rounded-2xl py-4 items-center justify-center mt-6 shadow-sm"
          >
            <Text className="text-white font-bold text-base">NEXT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- STEP 2: ADDRESS & CONTACT --- */}
      {step === 2 && (
        <View>
          {/* MAP LOCATION PICKER FIELD */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-700 mb-1.5">Home Location</Text>
            <TouchableOpacity 
              onPress={() => setMapModalVisible(true)}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5"
            >
              <MaterialIcons name="map" size={20} color={Colors.gray500} style={{ marginRight: 12 }} />
              <Text className={`flex-1 text-base ${address ? 'text-slate-900' : 'text-slate-400'}`} numberOfLines={1}>
                {address || 'Pinpoint home location on map'}
              </Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.gray500} />
            </TouchableOpacity>
          </View>

          {/* DETAILED ADDRESS FIELD (House No., Street, Landmark) */}
          <InputField 
            label="House No., Street, Landmark (Optional)" 
            placeholder="e.g., Blk 4 Lot 2, Mabini St., near school" 
            icon="home" 
            value={detailedAddress} 
            onChangeText={setDetailedAddress} 
          />

          <InputField label="Phone Number" placeholder="Enter your phone number" keyboardType="phone-pad" icon="phone" value={phone} onChangeText={setPhone} />

          <TouchableOpacity 
            onPress={handleNext}
            className="bg-red-600 rounded-2xl py-4 items-center justify-center mt-6 shadow-sm"
          >
            <Text className="text-white font-bold text-base">NEXT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- STEP 3: ACCOUNT SECURITY --- */}
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

      {/* GENDER MODAL */}
      <GenderModal
        visible={genderModalVisible}
        onClose={() => setGenderModalVisible(false)}
        onSelect={setGender}
        selectedGender={gender}
      />

      {/* MAP LOCATION PICKER MODAL */}
      <LocationPickerModal
        visible={mapModalVisible}
        onClose={() => setMapModalVisible(false)}
        onSelectLocation={(data) => {
          setAddress(data.address);
          setLatitude(data.latitude);
          setLongitude(data.longitude);
        }}
      />
    </BaseRegisterScreen>
  );
}