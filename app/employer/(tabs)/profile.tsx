import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function EmployerProfileScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  // Dynamic values para sa Business vs Household
  const profileData = {
    title: isHousehold ? 'Household Profile' : 'Business Profile',
    name: isHousehold ? 'Villa Family Residence' : "McDonald's SM North",
    email: isHousehold ? 'villa.family@example.com' : 'mcdonalds.smnorth@example.com',
    badgeText: isHousehold ? 'Verified Household' : 'Verified Business',
    avatarInitials: isHousehold ? 'VF' : "McDonald's SM North",
    infoTypeLabel: isHousehold ? 'Household Type' : 'Business Type',
    infoTypeValue: isHousehold ? 'Residential / Family' : 'Food & Beverage / Fast Food',
    locationLabel: isHousehold ? 'Home Address' : 'Branch Location',
    locationValue: isHousehold ? 'Pinamalayan, Oriental Mindoro' : 'SM City North EDSA, Quezon City',
    contactNumber: '+63 912 345 6789',
    permitLabel: isHousehold ? 'Government ID' : 'Tax ID / Permit',
    permitValue: isHousehold ? 'Valid ID Verified' : 'Verified & Registered',
  };

  const menuItems = [
    { icon: 'business', label: isHousehold ? 'Household Details' : 'Business Details', route: '#' },
    { icon: 'verified', label: 'Verification Status', route: `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}` },
    { icon: 'settings', label: 'Settings', route: '/settings' },
    { icon: 'help-outline', label: 'Help Center', route: '#' },
    { icon: 'info-outline', label: 'About DiskarTech', route: '#' },
    { icon: 'logout', label: 'Logout', route: '/auth/welcome', danger: true },
  ];

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
            uri=""
            name={profileData.avatarInitials}
            size={80}
            verified={true}
          />
          <TouchableOpacity className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-red-600 items-center justify-center border-2 border-white">
            <MaterialIcons name="camera-alt" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <Text className="text-xl font-bold text-slate-900 text-center">{profileData.name}</Text>
        <Text className="text-xs text-slate-500 mt-[2px] text-center">{profileData.email}</Text>
        
        <Badge 
          text={profileData.badgeText} 
          variant="success" 
          icon="verified" 
          style={{ marginTop: 8, alignSelf: 'center' }} 
        />
      </View>

      {/* Subscription Plan Card - Ipapakita lang kung Business Employer, Itatago kung Household */}
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
            <Text className="text-xs font-bold text-white">Manage Plan</Text>
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
            onPress={() => {
              if (item.route === '/auth/welcome') {
                router.replace(item.route as any);
              } else if (item.route !== '#') {
                router.push(item.route as any);
              }
            }}
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