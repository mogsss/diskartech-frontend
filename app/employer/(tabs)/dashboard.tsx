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

  // Bagong states para sa totoong stats at posted jobs mula sa API
  const [postedJobs, setPostedJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile && isMounted) {
          const profile = JSON.parse(storedProfile);
          setProfileData(profile);
          setIsVerified(profile.isVerified === 1 || profile.isVerified === true);
          
          let resolvedName = isHousehold ? (profile.household_name || profile.name || '') : (profile.employer_name || profile.business_name || profile.name || '');
          if (resolvedName) setDisplayName(resolvedName);
          
          const nameParts = resolvedName.trim().split(' ');
          let initials = nameParts.length >= 2 ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase() : (isHousehold ? 'VF' : 'MD');
          setAvatarInitials(initials);

          setLoadingProfile(false);
        }

        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;

        // 1. Fetch Dashboard Profile Data
        const response = await fetch('http://192.168.1.2:8000/api/dashboard-data', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        const data = await response.json();
        if (data.status === 'success' && isMounted) {
          const freshProfile = data.profile;
          setProfileData(freshProfile);
          await AsyncStorage.setItem('userProfile', JSON.stringify(freshProfile));
          
          const verifiedStatus = freshProfile.isVerified === 1 || freshProfile.isVerified === true;
          setIsVerified(verifiedStatus);
        }

        // 2. Fetch Totoong Posted Jobs ng Employer/Household
        const jobsResponse = await fetch('http://192.168.1.2:8000/api/employer/my-jobs', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        const jobsData = await jobsResponse.json();
        if (jobsData.status === 'success' && isMounted) {
          setPostedJobs(jobsData.jobs || []);
        }

      } catch (error) {
        console.log('Background API fetch note:', error);
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
          setLoadingJobs(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [type]);

  const headerInfo = {
    greeting: isHousehold ? 'Magandang Araw! 👋' : 'Good Morning! 👋',
    name: displayName,
    badgeText: isVerified 
      ? (isHousehold ? 'Verified Household' : 'Verified Business') 
      : 'For Verification',
    avatarInitials: avatarInitials,
  };

  // Dynamic stats na gumagamit na ng postedJobs.length para sa Posted Openings
  const stats = [
    { icon: 'work', label: 'Posted Openings', value: postedJobs.length.toString(), color: '#2196F3' },
    { icon: 'people', label: 'Applicants', value: '0', color: '#4CAF50' },
    { icon: 'rate-review', label: 'Pending Reviews', value: '0', color: '#FF9800' },
    { icon: 'check-circle', label: 'Hired Help', value: '0', color: '#D32F2F' },
  ];

  const quickActions = [
    { icon: 'add-circle', label: isHousehold ? 'Post Opening' : 'Post a Job', color: '#D32F2F', route: '/employer/job-posting' as const },
    { icon: 'people', label: 'Applicants', color: '#2196F3', route: '/employer/applicants-list' as const },
    { icon: 'chat', label: 'Messages', color: '#4CAF50', route: '/employer/(tabs)/messages' as const },
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

        {/* Posted Jobs / Openings (Dynamic galing sa API) */}
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

          {loadingJobs ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
          ) : postedJobs.length === 0 ? (
            <Text className="text-slate-500 text-center py-6 text-sm italic">No posted jobs yet.</Text>
          ) : (
            postedJobs.map((job) => (
              <TouchableOpacity key={job.id} className="flex-row items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center">
                    <MaterialIcons name="work" size={20} color={Colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-900">{job.title}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">₱{job.salary}</Text>
                  </View>
                </View>
                <View className="items-end gap-1">
                  <Badge
                    text={job.status === 'active' ? 'Active' : 'Closed'}
                    variant={job.status === 'active' ? 'success' : 'error'}
                  />
                  <Text className="text-xs text-slate-500">0 applicants</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Performance Overview */}
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