import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { Colors } from '@/constants/colors';
import { applications } from '@/data/applications';
import { formatDate, getStatusColor, getStatusIcon } from '@/utils/helpers';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const tabs = ['Pending', 'Viewed', 'Shortlisted', 'Interview', 'Accepted', 'Rejected', 'Completed', 'Cancelled'] as const;

export default function ApplicationsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Pending');

  const filteredApplications = applications.filter((app) => {
    if (activeTab === 'Pending') return app.status === 'pending';
    if (activeTab === 'Viewed') return app.status === 'viewed';
    if (activeTab === 'Shortlisted') return app.status === 'shortlisted';
    if (activeTab === 'Interview') return app.status === 'interview';
    if (activeTab === 'Accepted') return app.status === 'accepted';
    if (activeTab === 'Rejected') return app.status === 'rejected';
    if (activeTab === 'Completed') return app.status === 'completed';
    if (activeTab === 'Cancelled') return app.status === 'cancelled';
    return true;
  });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900">Applications</Text>
        <Text className="text-xs text-slate-500 mt-[2px]">Track your job applications</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-[44px] mb-2" contentContainerClassName="px-6 gap-2 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity 
              key={tab} 
              className={`flex-row items-center px-4 py-2 rounded-full border border-gray-100 gap-1.5 ${
                isActive ? 'bg-red-600 border-red-600' : 'bg-white'
              }`} 
              onPress={() => setActiveTab(tab)}
            >
              <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                {tab}
              </Text>
              {tab === 'Pending' && (
                <View className={`rounded-full px-1.5 py-0.5 ${isActive ? 'bg-white/30' : 'bg-gray-100'}`}>
                  <Text className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                    {applications.filter((a) => a.status === 'pending').length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <ScrollView className="flex-1" contentContainerClassName="p-6 pb-10" showsVerticalScrollIndicator={false}>
        {filteredApplications.length === 0 ? (
          <EmptyState icon="inbox" title={`No ${activeTab} Applications`} message={`You don't have any ${activeTab.toLowerCase()} applications yet.`} />
        ) : (
          filteredApplications.map((app) => (
            <View key={app.id} className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full overflow-hidden mr-4">
                  <Image source={{ uri: app.companyLogo }} className="w-10 h-10 rounded-full" />
                </View>
                <View style={{ backgroundColor: getStatusColor(app.status) }} className="w-3 h-3 rounded-full mr-3" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{app.jobTitle}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5">{app.companyName}</Text>
                </View>
              </View>
              <View className="flex-row gap-6 mb-3 ml-[52px]">
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="attach-money" size={14} color={Colors.textLight} />
                  <Text className="text-xs text-slate-500">{app.salary}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="calendar-today" size={14} color={Colors.textLight} />
                  <Text className="text-xs text-slate-500">{formatDate(app.appliedDate)}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name={getStatusIcon(app.status) as any} size={14} color={getStatusColor(app.status)} />
                  <Text style={{ color: getStatusColor(app.status) }} className="text-xs font-semibold">{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between border-t border-gray-100 pt-3">
                <Badge text={app.status.charAt(0).toUpperCase() + app.status.slice(1)} variant={app.status === 'rejected' || app.status === 'cancelled' ? 'error' : app.status === 'accepted' || app.status === 'completed' ? 'success' : app.status === 'pending' ? 'warning' : 'info'} size="small" />
                <Text className="text-xs text-slate-400">{app.employerName}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}