import BaseRegisterScreen from '@/components/BaseRegisterScreen';
import LocationPickerModal from '@/components/LocationPickerModal';
import BusinessTypeModal from '@/components/modals/employer/BusinessTypeModal';
import InputField from '@/components/ui/InputField';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import axios from 'axios'; // <--- Idinagdag ang axios

export default function RegisterEmployerScreen() {
  const [step, setStep] = useState(1);
  
  // Step 1: Business Info & Owner/Contact Person Name
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');

  // Step 2: Contact & Location Info
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [detailedAddress, setDetailedAddress] = useState(''); 
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);

  // Step 3: Account Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal Visibility
  const [businessTypeModalVisible, setBusinessTypeModalVisible] = useState(false);

  const handleNext = () => {
    if (step === 1) {
      if (!businessName || !businessType || !firstName || !lastName) {
        Alert.alert('Error', 'Please fill in all required business and personal name fields.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!phone || !address) {
        Alert.alert('Error', 'Please complete your phone number and business location.');
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
        role: 'employer',
        business_name: businessName,
        business_type: businessType,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        phone: phone, // Mapupunta sa contact_number sa database
        address: address,
        detailed_address: detailedAddress,
        latitude: latitude,
        longitude: longitude,
        email: email,
        password: password,
      });

      if (response.data.status === 'success') {
        Alert.alert('Success', 'Employer account created successfully!');
        router.replace('/employer/dashboard');
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
      activeTab="employer"
      step={step}
      stepTitles={['Business', 'Location', 'Security']}
      title="Create Employer Account"
      subtitle="Provide your company or business details"
      onBack={handleBack}
    >
      {/* --- STEP 1: BUSINESS & OWNER DETAILS --- */}
      {step === 1 && (
        <View>
          <InputField label="Business Name" placeholder="Enter business name" icon="business" value={businessName} onChangeText={setBusinessName} />

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-700 mb-1.5">Business Type</Text>
            <TouchableOpacity 
              onPress={() => setBusinessTypeModalVisible(true)}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5"
            >
              <MaterialIcons name="category" size={20} color={Colors.gray500} style={{ marginRight: 12 }} />
              <Text className={`flex-1 text-base ${businessType ? 'text-slate-900' : 'text-slate-400'}`}>
                {businessType || 'Select business type'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={Colors.gray500} />
            </TouchableOpacity>
          </View>
          
          <Text className="text-base font-bold text-slate-900 mt-5 mb-3">Contact Person / HR</Text>
          <InputField label="First Name" placeholder="Contact person first name" keyboardType="default" icon="person" value={firstName} onChangeText={setFirstName} />
          <InputField label="Middle Name (Optional)" placeholder="Contact person middle name" keyboardType="default" icon="person-outline" value={middleName} onChangeText={setMiddleName} />
          <InputField label="Last Name" placeholder="Contact person last name" keyboardType="default" icon="person" value={lastName} onChangeText={setLastName} />

          <TouchableOpacity onPress={handleNext} className="bg-red-600 rounded-2xl py-4 items-center justify-center mt-6 shadow-sm">
            <Text className="text-white font-bold text-base">NEXT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- STEP 2: CONTACT & LOCATION DETAILS --- */}
      {step === 2 && (
        <View>
          <InputField label="Phone Number" placeholder="Enter mobile number" keyboardType="phone-pad" icon="phone" value={phone} onChangeText={setPhone} />

          <View className="mb-4">
            <Text className="text-sm font-semibold text-slate-700 mb-1.5">Business Location</Text>
            <TouchableOpacity 
              onPress={() => setMapModalVisible(true)}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5"
            >
              <MaterialIcons name="map" size={20} color={Colors.gray500} style={{ marginRight: 12 }} />
              <Text className={`flex-1 text-base ${address ? 'text-slate-900' : 'text-slate-400'}`} numberOfLines={1}>
                {address || 'Pinpoint business location on map'}
              </Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.gray500} />
            </TouchableOpacity>
          </View>

          <InputField 
            label="House No., Street, Landmark (Optional)" 
            placeholder="e.g., Bldg 2, Quezon St., near plaza" 
            icon="home" 
            value={detailedAddress} 
            onChangeText={setDetailedAddress} 
          />

          <TouchableOpacity onPress={handleNext} className="bg-red-600 rounded-2xl py-4 items-center justify-center mt-6 shadow-sm">
            <Text className="text-white font-bold text-base">NEXT</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- STEP 3: SECURITY --- */}
      {step === 3 && (
        <View>
          <InputField label="Email Address" placeholder="Enter business email" keyboardType="email-address" autoCapitalize="none" icon="email" value={email} onChangeText={setEmail} />
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

      {/* MODALS */}
      <BusinessTypeModal
        visible={businessTypeModalVisible}
        onClose={() => setBusinessTypeModalVisible(false)}
        onSelect={setBusinessType}
        selectedType={businessType}
      />

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