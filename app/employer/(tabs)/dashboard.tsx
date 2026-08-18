import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';

export default function SharedDashboardScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const [displayName, setDisplayName] = useState(isHousehold ? 'Villa Family Residence' : "Employer Dashboard");
  const [avatarInitials, setAvatarInitials] = useState(isHousehold ? 'VF' : 'MD');
  const [profileData, setProfileData] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Kukunin natin ang data mula sa AsyncStorage at susuriin ang pangalan, initials, at verification status
  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const storedProfile = await AsyncStorage.getItem('userProfile');
        console.log('NAKUHA SA ASYNCSTORAGE SA DASHBOARD:', storedProfile);

        if (storedProfile && isMounted) {
          const profile = JSON.parse(storedProfile);
          setProfileData(profile);
          
          // Suriin ang totoong isVerified status galing sa database/storage
          const verifiedStatus = profile.isVerified === 1 || profile.isVerified === true;
          setIsVerified(verifiedStatus);

          let resolvedName = '';
          if (isHousehold) {
            resolvedName = profile.household_name || profile.name || '';
            if (resolvedName) {
              setDisplayName(resolvedName);
            }
          } else {
            resolvedName = profile.employer_name || profile.business_name || profile.name || '';
            if (resolvedName) {
              setDisplayName(resolvedName);
            }
          }

          // Kumuha ng unang letra ng First Name at unang letra ng Last Name para sa initials
          const nameParts = resolvedName.trim().split(' ');
          let initials = '';
          if (nameParts.length >= 2) {
            initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
          } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
            initials = nameParts[0].substring(0, 2).toUpperCase();
          } else {
            initials = isHousehold ? 'VF' : 'MD';
          }
          setAvatarInitials(initials);
        }
      } catch (error) {
        console.error('Error loading dashboard profile:', error);
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [type]);

  // Dynamic data batay sa kung anong uri ng hirer ang pumasok at verification status
  const headerInfo = {
    greeting: isHousehold ? 'Magandang Araw! 👋' : 'Good Morning! 👋',
    name: displayName,
    badgeText: isVerified 
      ? (isHousehold ? 'Verified Household' : 'Verified Business') 
      : 'For Verification',
    avatarInitials: avatarInitials,
  };

  const stats = isHousehold
    ? [
        { icon: 'work', label: 'Posted Openings', value: '2', color: '#2196F3' },
        { icon: 'people', label: 'Applicants', value: '5', color: '#4CAF50' },
        { icon: 'rate-review', label: 'Pending Reviews', value: '2', color: '#FF9800' },
        { icon: 'check-circle', label: 'Hired Help', value: '1', color: '#D32F2F' },
      ]
    : [
        { icon: 'work', label: 'Posted Jobs', value: '12', color: '#2196F3' },
        { icon: 'people', label: 'Applicants', value: '48', color: '#4CAF50' },
        { icon: 'rate-review', label: 'Pending Reviews', value: '6', color: '#FF9800' },
        { icon: 'check-circle', label: 'Hired', value: '8', color: '#D32F2F' },
      ];

  const quickActions = [
    { icon: 'add-circle', label: isHousehold ? 'Post Opening' : 'Post a Job', color: '#D32F2F', route: '/employer/job-posting' as const },
    { icon: 'people', label: 'Applicants', color: '#2196F3', route: '/employer/applicants-list' as const },
    { icon: 'chat', label: 'Messages', color: '#4CAF50', route: '/chat' as const },
    { icon: 'verified', label: 'Verification', color: '#FF9800', route: `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}` as const },
  ];

  const recentList = isHousehold
    ? [
        { name: 'Maria Santos', position: 'Household Kasambahay', status: 'pending' as const, avatar: '' },
        { name: 'Juan Dela Cruz', position: 'Family Driver', status: 'accepted' as const, avatar: '' },
      ]
    : [
        { name: 'Junnyl Mabini', position: 'Service Crew', status: 'pending' as const, avatar: '' },
        { name: 'Ana Santos', position: 'Barista', status: 'accepted' as const, avatar: '' },
        { name: 'Carlos Reyes', position: 'Sales Associate', status: 'pending' as const, avatar: '' },
        { name: 'Maria Santos', position: 'Cashier', status: 'rejected' as const, avatar: '' },
      ];

  const postedList = isHousehold
    ? [
        { title: 'Household Kasambahay', applicants: 3, status: 'active' as const, salary: '₱8,000 - ₱10,000/mo', icon: 'home' },
        { title: 'Family Driver', applicants: 2, status: 'active' as const, salary: '₱12,000 - ₱15,000/mo', icon: 'home' },
      ]
    : [
        { title: 'Service Crew', applicants: 15, status: 'active' as const, salary: '₱75 - ₱95/hr', icon: 'work' },
        { title: 'Barista', applicants: 28, status: 'active' as const, salary: '₱80 - ₱100/hr', icon: 'work' },
        { title: 'Cashier', applicants: 12, status: 'active' as const, salary: '₱70 - ₱85/hr', icon: 'work' },
        { title: 'Service Crew (Night)', applicants: 8, status: 'closed' as const, salary: '₱85 - ₱110/hr', icon: 'work' },
      ];

  if (loadingProfile) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F8FAFC]">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        
        {/* Header */}
        <View className="flex-row justify-between items-center pt-4 mb-6">
          <View>
            <Text className="text-xl font-bold text-slate-900">{headerInfo.greeting}</Text>
            <Text className="text-sm text-slate-500 mt-0.5">{headerInfo.name}</Text>
            <View className="flex-row items-center gap-1 mt-1">
              <MaterialIcons 
                name={isVerified ? "verified" : "hourglass-empty"} 
                size={14} 
                color={isVerified ? Colors.verified : '#FF9800'} 
              />
              <Text className={`text-xs font-semibold ${isVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                {headerInfo.badgeText}
              </Text>
            </View>
          </View>
          
          <View className="flex-row items-center gap-3">
            <TouchableOpacity 
              onPress={() => router.push('/notifications')}
              className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm border border-gray-100 relative"
            >
              <MaterialIcons name="notifications-none" size={22} color={Colors.text} />
              <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-600" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/employer/(tabs)/profile')}>
              <Avatar uri="" name={headerInfo.avatarInitials} size={44} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          {stats.map((stat, index) => (
            <View key={index} className="w-[48%] bg-white rounded-2xl p-4 shadow-sm mb-1 items-center justify-center">
              <View style={{ backgroundColor: stat.color + '15' }} className="w-11 h-11 rounded-full items-center justify-center mb-2">
                <MaterialIcons name={stat.icon as any} size={24} color={stat.color} />
              </View>
              <Text className="text-2xl font-bold text-slate-900 text-center">{stat.value}</Text>
              <Text className="text-xs text-slate-500 mt-0.5 text-center">{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text className="text-lg font-bold text-slate-900 mb-4">Quick Actions</Text>
        <View className="flex-row gap-3 mb-6">
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm"
              onPress={() => router.push(action.route)}
            >
              <View style={{ backgroundColor: action.color + '15' }} className="w-12 h-12 rounded-full items-center justify-center mb-3">
                <MaterialIcons name={action.icon as any} size={28} color={action.color} />
              </View>
              <Text className="text-xs font-semibold text-slate-900 text-center">{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Applications */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-lg font-bold text-slate-900">
              {isHousehold ? 'Recent Applicants' : 'Recent Applications'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/employer/applicants-list')}>
              <Text className="text-sm font-semibold text-red-600">See All</Text>
            </TouchableOpacity>
          </View>
          {recentList.map((app, index) => (
            <TouchableOpacity
              key={index}
              className="flex-row items-center py-2 gap-4"
              onPress={() => router.push(`/employer/applicant-details?name=${encodeURIComponent(app.name)}&position=${encodeURIComponent(app.position)}`)}
            >
              <Avatar uri={app.avatar} name={app.name} size={44} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">{app.name}</Text>
                <Text className="text-xs text-slate-500">{app.position}</Text>
              </View>
              <Badge
                text={app.status === 'pending' ? 'Pending' : app.status === 'accepted' ? 'Accepted' : 'Rejected'}
                variant={app.status === 'pending' ? 'warning' : app.status === 'accepted' ? 'success' : 'error'}
              />
              <MaterialIcons name="chevron-right" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Posted Jobs / Openings */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <View>
              <Text className="text-lg font-bold text-slate-900">
                {isHousehold ? 'Household Openings' : 'Posted Jobs'}
              </Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                {isHousehold ? 'Manage your home service requests' : 'Manage your job listings'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/employer/job-posting')}>
              <View className="flex-row items-center gap-1 bg-red-600 px-4 py-2 rounded-full">
                <MaterialIcons name="add" size={18} color={Colors.white} />
                <Text className="text-xs font-semibold text-white">New</Text>
              </View>
            </TouchableOpacity>
          </View>
          {postedList.map((job, index) => (
            <TouchableOpacity key={index} className="flex-row items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center">
                  <MaterialIcons name={job.icon as any} size={20} color={Colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{job.title}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5">{job.salary}</Text>
                </View>
              </View>
              <View className="items-end gap-1">
                <Badge
                  text={job.status === 'active' ? 'Active' : 'Closed'}
                  variant={job.status === 'active' ? 'success' : 'error'}
                />
                <Text className="text-xs text-slate-500">{job.applicants} applicants</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Performance Overview (Para sa Business lang) */}
        {!isHousehold && (
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
              <Text className="text-lg font-bold text-slate-900">Performance Overview</Text>
              <TouchableOpacity>
                <Text className="text-sm font-semibold text-red-600">View Report</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row items-center py-2">
              <View className="flex-1 items-center justify-center">
                <Text className="text-xl font-bold text-red-600 text-center">85%</Text>
                <Text className="text-xs text-slate-500 mt-1 text-center">Application Rate</Text>
              </View>
              <View className="w-[1px] h-10 bg-gray-200" />
              <View className="flex-1 items-center justify-center">
                <Text className="text-xl font-bold text-red-600 text-center">3.2</Text>
                <Text className="text-xs text-slate-500 mt-1 text-center">Avg. Rating</Text>
              </View>
              <View className="w-[1px] h-10 bg-gray-200" />
              <View className="flex-1 items-center justify-center">
                <Text className="text-xl font-bold text-red-600 text-center">7</Text>
                <Text className="text-xs text-slate-500 mt-1 text-center">Hired This Month</Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}