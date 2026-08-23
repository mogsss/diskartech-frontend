import React, { useState, useCallback, useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { Colors } from '@/constants/colors';
import { formatDate, getStatusColor, getStatusIcon } from '@/utils/helpers';
import api from '@/api/axios';
import ApplicationDetailsModal from '@/components/modals/student/ApplicationDetailsModal';

const tabs = ['Pending', 'Viewed', 'Shortlisted', 'Interview', 'Accepted', 'Rejected', 'Completed', 'Cancelled'] as const;

export default function ApplicationsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Pending');
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States para sa modal visibility at selected application data
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchApplications = async () => {
    try {
      const response = await api.get('/student/applications');
      if (response.data && response.data.status === 'success') {
        setApplications(response.data.applications);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchApplications();
    }, [])
  );

  // Awtomatikong binabasa ang ID mula sa notification at binubuksan ang modal
  useEffect(() => {
    const checkSelectedApp = async () => {
      try {
        const savedId = await AsyncStorage.getItem('selected_application_id');
        if (savedId && applications.length > 0) {
          const found = applications.find((a) => a.id.toString() === savedId.toString());
          if (found) {
            const targetStatus = found.status ? found.status.charAt(0).toUpperCase() + found.status.slice(1) : '';
            if (tabs.includes(targetStatus as any)) {
              setActiveTab(targetStatus as any);
            }
            setSelectedApp(found);
            setModalVisible(true);
          }
          await AsyncStorage.removeItem('selected_application_id');
        }
      } catch (e) {
        console.error('Error opening selected app modal:', e);
      }
    };
    checkSelectedApp();
  }, [applications]);

  const filteredApplications = applications.filter((app) => {
    const status = app.status ? app.status.toLowerCase() : '';
    return status === activeTab.toLowerCase();
  });

  const handleCardPress = (app: any) => {
    setSelectedApp(app);
    setModalVisible(true);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900">Applications</Text>
        <Text className="text-xs text-slate-500 mt-[2px]">Track your job applications</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-h-[44px] mb-2" contentContainerClassName="px-6 gap-2 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const count = applications.filter((a) => a.status?.toLowerCase() === tab.toLowerCase()).length;
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
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView className="flex-1" contentContainerClassName="p-6 pb-10" showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#dc2626" style={{ marginVertical: 40 }} />
        ) : filteredApplications.length === 0 ? (
          <EmptyState icon="inbox" title={`No ${activeTab} Applications`} message={`You don't have any ${activeTab.toLowerCase()} applications yet.`} />
        ) : (
          filteredApplications.map((app) => (
            <TouchableOpacity 
              key={app.id} 
              activeOpacity={0.7}
              onPress={() => handleCardPress(app)}
              className="bg-white rounded-2xl p-4 mb-4 shadow-sm"
            >
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full overflow-hidden mr-4 bg-gray-100 items-center justify-center">
                  <MaterialIcons name="work" size={20} color="#64748b" />
                </View>
                <View 
                  style={{ backgroundColor: app.status === 'interview' ? '#f59e0b' : getStatusColor(app.status) }} 
                  className="w-3 h-3 rounded-full mr-3" 
                />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{app.job?.title || 'Job Opening'}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5">{app.job?.category || 'General'}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
              </View>
              
              <View className="flex-row gap-6 mb-3 ml-[52px]">
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="attach-money" size={14} color={Colors.textLight} />
                  <Text className="text-xs text-slate-500">₱{app.job?.salary || '0.00'}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <MaterialIcons name="calendar-today" size={14} color={Colors.textLight} />
                  <Text className="text-xs text-slate-500">{formatDate(app.created_at)}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <MaterialIcons 
                    name={app.status === 'interview' ? 'event-available' : (getStatusIcon(app.status) as any)} 
                    size={14} 
                    color={app.status === 'interview' ? '#f59e0b' : getStatusColor(app.status)} 
                  />
                  <Text 
                    style={{ color: app.status === 'interview' ? '#f59e0b' : getStatusColor(app.status) }} 
                    className="text-xs font-semibold"
                  >
                    {app.status === 'interview' ? 'For Interview' : app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : ''}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between border-t border-gray-100 pt-3">
                <Badge 
                  text={app.status === 'interview' ? 'For Interview' : app.status ? app.status.charAt(0).toUpperCase() + app.status.slice(1) : ''} 
                  variant={
                    app.status === 'rejected' || app.status === 'cancelled' 
                      ? 'error' 
                      : app.status === 'accepted' || app.status === 'completed' 
                      ? 'success' 
                      : app.status === 'interview'
                      ? 'warning'
                      : app.status === 'pending' 
                      ? 'warning' 
                      : 'info'
                  } 
                  size="small" 
                />
                <Text className="text-xs text-slate-400">ID: {app.job_id}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <ApplicationDetailsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        application={selectedApp}
        onApplicationCancelled={() => {
          fetchApplications();
        }}
      />
    </View>
  );
}