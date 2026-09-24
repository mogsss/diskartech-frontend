import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import api from '@/api/axios';
import { useFocusEffect } from '@react-navigation/native';

export default function EmployerProfileScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const [isVerified, setIsVerified] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
    title: isHousehold ? 'Household Profile' : 'Business Profile',
    name: isHousehold ? 'Villa Family Residence' : "McDonald's SM North",
    email: 'Loading...',
    badgeText: isHousehold ? 'Verified Household' : 'Verified Business',
    avatarInitials: isHousehold ? 'VF' : 'MD',
    infoTypeLabel: isHousehold ? 'Household Type' : 'Business Type',
    infoTypeValue: isHousehold ? 'Residential / Family' : 'Food & Beverage / Fast Food',
    locationLabel: isHousehold ? 'Home Address' : 'Branch Location',
    locationValue: isHousehold ? 'Pinamalayan, Oriental Mindoro' : 'SM City North EDSA, Quezon City',
    contactNumber: '+63 912 345 6789',
    permitLabel: isHousehold ? 'Government ID' : 'Tax ID / Permit',
    permitValue: isHousehold ? 'Valid ID Verified' : 'Verified & Registered',
  });

  const fetchEmployerProfile = async () => {
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
        const verifiedStatus = profile.isVerified === 1 || profile.isVerified === true;
        setIsVerified(verifiedStatus);

        const actualName = isHousehold 
          ? (profile.household_name || profile.name || 'Villa Family Residence') 
          : (profile.employer_name || profile.business_name || profile.name || "Business Name");

        const nameParts = actualName.trim().split(' ');
        let initials = '';
        if (nameParts.length >= 2) {
          initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
          initials = nameParts[0].substring(0, 2).toUpperCase();
        } else {
          initials = isHousehold ? 'VF' : 'MD';
        }

        if (profile.profile_picture || profile.avatar) {
          const picPath = profile.profile_picture || profile.avatar;
          const fullUrl = picPath.startsWith('http') ? picPath : `http://192.168.1.2:8000/storage/${picPath}`;
          setAvatarUri(fullUrl);
        }

        setProfileData((prev) => ({
          ...prev,
          name: actualName,
          avatarInitials: initials,
          locationValue: profile.location || profile.detailed_address || prev.locationValue,
          contactNumber: profile.contact_number || profile.cp_number || prev.contactNumber,
          badgeText: verifiedStatus 
            ? (isHousehold ? 'Verified Household' : 'Verified Business') 
            : 'For Verification',
        }));
      }

      // 2. Pagkatapos ay i-sync sa API (/user/profile) para makuha ang pinakabagong update
      try {
        const response = await api.get('/user/profile');
        const profile = response.data.profile;

        if (profile) {
          const verifiedStatus = profile.isVerified === 1 || profile.isVerified === true;
          setIsVerified(verifiedStatus);

          const actualName = isHousehold 
            ? (profile.household_name || profile.name || 'Villa Family Residence') 
            : (profile.employer_name || profile.business_name || profile.name || "Business Name");

          const nameParts = actualName.trim().split(' ');
          let initials = '';
          if (nameParts.length >= 2) {
            initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
          } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
            initials = nameParts[0].substring(0, 2).toUpperCase();
          } else {
            initials = isHousehold ? 'VF' : 'MD';
          }

          if (profile.profile_picture || profile.avatar) {
            const picPath = profile.profile_picture || profile.avatar;
            const fullUrl = picPath.startsWith('http') ? picPath : `http://192.168.1.2:8000/storage/${picPath}`;
            setAvatarUri(fullUrl);
          }

          setProfileData((prev) => ({
            ...prev,
            name: actualName,
            avatarInitials: initials,
            locationValue: profile.location || profile.detailed_address || prev.locationValue,
            contactNumber: profile.contact_number || profile.cp_number || prev.contactNumber,
            badgeText: verifiedStatus 
              ? (isHousehold ? 'Verified Household' : 'Verified Business') 
              : 'For Verification',
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
  };

  useFocusEffect(
    useCallback(() => {
      fetchEmployerProfile();
    }, [isHousehold])
  );

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'You need to grant permission to access your photos.');
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
      });

      if (response.data.status === 'success') {
        Alert.alert('Success', 'Profile picture updated successfully!');
        
        const rawPath = response.data.profile_picture || response.data.file_path;
        if (rawPath) {
          const fullUrl = rawPath.startsWith('http') ? rawPath : `http://192.168.1.2:8000/storage/${rawPath}`;
          setAvatarUri(fullUrl);
        }

        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profileObj = JSON.parse(storedProfile);
          profileObj.profile_picture = rawPath;
          await AsyncStorage.setItem('userProfile', JSON.stringify(profileObj));
        }

        fetchEmployerProfile();
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Upload Failed', error.response?.data?.message || 'Something went wrong.');
    }
  };

  const menuItems = [
    { icon: 'business', label: isHousehold ? 'Household Details' : 'Business Details', route: '#' },
    { icon: 'verified', label: 'Verification Status', route: `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}` },
    { icon: 'settings', label: 'Settings', route: '/settings' },
    { icon: 'help-outline', label: 'Help Center', route: '#' },
    { icon: 'info-outline', label: 'About DiskarTech', route: '#' },
    { icon: 'logout', label: 'Logout', route: '/auth/welcome', danger: true },
  ];

  const handleMenuPress = async (route: string) => {
    if (route === '/auth/welcome') {
      try {
        await AsyncStorage.clear();
      } catch (error) {
        console.error('Error clearing storage on logout:', error);
      }
      router.replace(route as any);
    } else if (route !== '#') {
      router.push(route as any);
    }
  };

  return (
    <ScrollView className="flex-1 bg-[#F8FAFC]" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900">{profileData.title}</Text>
      </View>

      {/* Profile Card */}
      <View className="bg-white mx-6 rounded-2xl p-6 items-center shadow-md mb-4">
        <View className="relative mb-4">
          <Avatar
            uri={avatarUri || ''}
            name={profileData.avatarInitials}
            size={80}
            verified={isVerified}
          />
          <TouchableOpacity 
            onPress={handlePickImage}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-red-600 items-center justify-center border-2 border-white"
          >
            <MaterialIcons name="camera-alt" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <Text className="text-xl font-bold text-slate-900 text-center">{profileData.name}</Text>
        <Text className="text-xs text-slate-500 mt-[2px] text-center">{profileData.email}</Text>
        
        <Badge 
          text={profileData.badgeText} 
          variant={isVerified ? "success" : "warning"} 
          icon={isVerified ? "verified" : "hourglass-empty"} 
          style={{ marginTop: 8, alignSelf: 'center' }} 
        />
      </View>

      {/* Subscription Plan Card */}
      {!isHousehold && (
        <View className="bg-white mx-6 rounded-2xl p-5 shadow-sm mb-4 border border-red-100 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <View className="flex-row items-center gap-1.5 mb-1">
              <MaterialIcons name="star" size={18} color="#D32F2F" />
              <Text className="text-xs font-bold text-red-600 uppercase tracking-wider">Current Plan</Text>
            </View>
            <Text className="text-lg font-bold text-slate-900">Free Plan</Text>
            <Text className="text-xs text-slate-500 mt-0.5">Basic job postings and applicant review</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/employer/subscription')}
            className="bg-red-600 px-4 py-2.5 rounded-xl items-center justify-center shadow-sm"
          >
            <Text className="text-xs font-bold text-white">Manage Plan s</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Information Section */}
      <View className="bg-white mx-6 rounded-2xl p-6 shadow-sm mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-gray-100">
          {isHousehold ? 'Household Info' : 'Establishment Info'}
        </Text>
        <InfoRow icon="store" label={profileData.infoTypeLabel} value={profileData.infoTypeValue} />
        <InfoRow icon="location-on" label={profileData.locationLabel} value={profileData.locationValue} />
        <InfoRow icon="phone" label="Contact Number" value={profileData.contactNumber} />
        <InfoRow icon="badge" label={profileData.permitLabel} value={profileData.permitValue} />
      </View>

      {/* Menu / Settings */}
      <View className="bg-white mx-6 rounded-2xl shadow-sm mb-12 overflow-hidden">
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            className={`flex-row items-center p-4 border-b border-gray-100 gap-4 ${
              index === menuItems.length - 1 ? 'border-b-0' : ''
            }`}
            onPress={() => handleMenuPress(item.route)}
          >
            <MaterialIcons
              name={item.icon as any}
              size={22}
              color={item.danger ? Colors.error : Colors.text}
            />
            <Text className={`text-base text-slate-900 flex-1 ${item.danger ? 'text-red-600 font-semibold' : ''}`}>
              {item.label}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color={Colors.gray400} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-4 mb-4">
      <MaterialIcons name={icon} size={18} color={Colors.gray500} />
      <View className="flex-1">
        <Text className="text-xs text-slate-400">{label}</Text>
        <Text className="text-sm font-medium text-slate-900 mt-[2px]">{value}</Text>
      </View>
    </View>
  );
}