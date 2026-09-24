import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useCallback } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import api from '@/api/axios';

export default function SharedDashboardScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  const [displayName, setDisplayName] = useState(isHousehold ? 'Villa Family Residence' : "Employer Dashboard");
  const [avatarInitials, setAvatarInitials] = useState(isHousehold ? 'VF' : 'MD');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // States para sa totoong stats at posted jobs mula sa API
  const [postedJobs, setPostedJobs] = useState<any[]>([]);
  const [recentApplicants, setRecentApplicants] = useState<any[]>([]);
  const [totalApplicantsCount, setTotalApplicantsCount] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        setIsVerified(profile.isVerified === 1 || profile.isVerified === true);

        if (profile.avatar) {
          const fullAvatarUrl = profile.avatar.startsWith('http') 
            ? profile.avatar 
            : `http://192.168.1.2:8000/storage/${profile.avatar}`;
          setAvatarUri(fullAvatarUrl);
        }

        let resolvedName = isHousehold ? (profile.household_name || profile.name || '') : (profile.employer_name || profile.business_name || profile.name || '');
        if (resolvedName) {
          setDisplayName(resolvedName);
          const nameParts = resolvedName.trim().split(' ');
          let initials = nameParts.length >= 2 ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase() : (isHousehold ? 'VF' : 'MD');
          setAvatarInitials(initials);
        }
        setLoadingProfile(false);
      }

      // 1. Fetch Dashboard Profile Data gamit ang axios api instance
      const profileRes = await api.get('/dashboard-data').catch(() => null);
      if (profileRes && profileRes.data && profileRes.data.status === 'success') {
        const freshProfile = profileRes.data.profile;
        await AsyncStorage.setItem('userProfile', JSON.stringify(freshProfile));
        const verifiedStatus = freshProfile.isVerified === 1 || freshProfile.isVerified === true;
        setIsVerified(verifiedStatus);
        if (freshProfile.avatar) {
          const fullAvatarUrl = freshProfile.avatar.startsWith('http') 
            ? freshProfile.avatar 
            : `http://192.168.1.2:8000/storage/${freshProfile.avatar}`;
          setAvatarUri(fullAvatarUrl);
        }
      }

      const getInitials = (name: string) => {
        if (!name) return 'ST';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
      }; 

      // 2. Fetch Posted Jobs ng Employer/Household kasama ang applications count
      const jobsRes = await api.get('/employer/jobs').catch(() => null);
      if (jobsRes && jobsRes.data && jobsRes.data.status === 'success') {
        const jobs = jobsRes.data.jobs || [];
        setPostedJobs(jobs);

        let totalApps = 0;
        let allApplicants: any[] = [];

        jobs.forEach((job: any) => {
          totalApps += job.applications_count || (job.applications ? job.applications.length : 0);
          if (job.applications && Array.isArray(job.applications)) {
            job.applications.forEach((app: any) => {
              const studentInfo = app.student || app.user || {};
              const studentName = studentInfo.student_name || studentInfo.name || studentInfo.fullname || 'Student Applicant';
              const studentAvatar = studentInfo.avatar || studentInfo.profile_picture || '';
              const initials = getInitials(studentName);
              allApplicants.push({
                id: app.id,
                name: studentName,
                position: job.title,
                status: app.status || 'pending',
                avatar: studentAvatar ? `http://192.168.1.2:8000/storage/${studentAvatar}` : '',
                initials: initials,
              });
            });
          }
        });

        setTotalApplicantsCount(totalApps);
        setRecentApplicants(allApplicants);
      }

    } catch (error) {
      console.log('Error fetching dashboard data:', error);
    } finally {
      setLoadingProfile(false);
      setLoadingJobs(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [type])
  );

  const headerInfo = {
    greeting: isHousehold ? 'Magandang Araw! 👋' : 'Good Morning! 👋',
    name: displayName,
    badgeText: isVerified
      ? (isHousehold ? 'Verified Household' : 'Verified Business')
      : 'For Verification',
    avatarInitials: avatarInitials,
    avatarUri: avatarUri,
  };

  const stats = [
    { icon: 'work', label: 'Posted Openings', value: postedJobs.length.toString(), color: '#2196F3' },
    { icon: 'people', label: 'Applicants', value: totalApplicantsCount.toString(), color: '#4CAF50' },
    { icon: 'rate-review', label: 'Pending Reviews', value: recentApplicants.filter(a => a.status === 'pending').length.toString(), color: '#FF9800' },
    { icon: 'check-circle', label: 'Hired Help', value: recentApplicants.filter(a => a.status === 'accepted').length.toString(), color: '#D32F2F' },
  ];

  const quickActions = [
    { icon: 'add-circle', label: isHousehold ? 'Post Opening' : 'Post a Job', color: '#D32F2F', route: '/employer/job-posting' as const },
    { icon: 'people', label: 'Applicants', color: '#2196F3', route: '/employer/applicants-list' as const },
    { icon: 'chat', label: 'Messages', color: '#4CAF50', route: '/employer/(tabs)/messages' as const },
    { icon: 'verified', label: 'Verification', color: '#FF9800', route: `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}` as const },
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

            <TouchableOpacity onPress={() => router.push(`/employer/(tabs)/profile?type=${type}`)}>
              <Avatar uri={headerInfo.avatarUri || ''} name={headerInfo.avatarInitials} size={44} />
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

        {/* Recent Applications / Applicants */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-lg font-bold text-slate-900">
              {isHousehold ? 'Recent Applicants' : 'Recent Applications'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/employer/applicants-list')}>
              <Text className="text-sm font-semibold text-red-600">See All</Text>
            </TouchableOpacity>
          </View>
          {recentApplicants.length === 0 ? (
            <Text className="text-slate-400 text-center py-4 text-xs italic">No applicants yet.</Text>
          ) : (
            recentApplicants.slice(0, 3).map((app, index) => (
              <TouchableOpacity
                key={index}
                className="flex-row items-center py-2 gap-4"
                onPress={() => router.push(`/employer/applicant-details?applicationId=${app.id}`)}
              >
                <Avatar uri={app.avatar} name={app.initials || app.name} size={44} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{app.name}</Text>
                  <Text className="text-xs text-slate-500">{app.position}</Text>
                </View>
                <Badge
                  text={app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  variant={
                    app.status === 'pending'
                      ? 'default'
                      : app.status === 'viewed'
                      ? 'info'
                      : app.status === 'accepted'
                      ? 'success'
                      : 'error'
                  }
                />
                <MaterialIcons name="chevron-right" size={20} color={Colors.gray400} />
              </TouchableOpacity>
            ))
          )}
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
                  <Text className="text-xs text-slate-500">
                    {job.applications_count ?? (job.applications ? job.applications.length : 0)} applicants
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}