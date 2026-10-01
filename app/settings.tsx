import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sendTestNotification,
  scheduleDelayedSimulationNotification,
  sendTestCloudPushNotification,
  getPushDiagnosticInfo,
} from '@/utils/notifications';

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('notifications_enabled').then((val) => {
      if (val !== null) {
        setNotifications(val === 'true');
      }
    });
  }, []);

  // Function para sa Logout
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // 1. Kunin ang nakaimbak na token (Palitan kung iba ang ginamit mong storage o variable name)
              // const token = await AsyncStorage.getItem('user_token');

              // 2. Tawagin ang Laravel Logout API (Palitan ang IP kung kinakailangan)
              // await axios.post('http://192.168.1.2:8000/api/logout', {}, {
              //   headers: { Authorization: `Bearer ${token}` }
              // });

              // 3. Burahin ang token sa device storage
              // await AsyncStorage.removeItem('user_token');

              // 4. Dalhin pabalik sa Welcome o Login screen
              router.replace('/auth/welcome'); // O kaya ay '/auth/login'
            } catch (error) {
              console.error(error);
              // Kahit magka-error sa network, i-force pa rin ang pag-redirect sa welcome screen
              router.replace('/auth/welcome');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-slate-900">Settings</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2 px-1">Account</Text>
        <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingItem icon="person" label="Edit Profile" />
          <SettingItem icon="verified-user" label="Verification Status" badge="Verified" badgeColor="success" />
          <SettingItem icon="lock" label="Change Password" />
        </View>

        {/* Preferences */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2 px-1">Preferences</Text>
        <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingToggle icon="dark-mode" label="Dark Mode" value={darkMode} onValueChange={setDarkMode} />
          <SettingToggle 
            icon="notifications" 
            label="Push Notifications" 
            value={notifications} 
            onValueChange={async (val) => {
              setNotifications(val);
              await AsyncStorage.setItem('notifications_enabled', String(val));
            }} 
          />
          <SettingItem 
            icon="notifications-active" 
            label="Test Notification" 
            value="Send Now" 
            onPress={async () => {
              try {
                await sendTestNotification();
              } catch (err: any) {
                Alert.alert('Permission Error', 'Please enable notifications in your device settings.');
              }
            }} 
          />
          <SettingItem 
            icon="schedule" 
            label="Test (Close App - 10s Delay)" 
            value="Try Now" 
            onPress={async () => {
              try {
                await scheduleDelayedSimulationNotification(10);
                Alert.alert(
                  'Test Scheduled',
                  'You have 10 seconds. Minimize or swipe away the app to close it completely to see the notification banner.'
                );
              } catch (err: any) {
                Alert.alert('Permission Error', 'Please enable notifications in your device settings.');
              }
            }} 
          />
          <SettingItem 
            icon="cloud-queue" 
            label="Test Cloud Push (5s Delay)" 
            value="Send" 
            onPress={async () => {
              try {
                await sendTestCloudPushNotification(5);
                Alert.alert(
                  'Cloud Push Scheduled',
                  'Close or minimize the app now. A cloud push notification will be sent via Expo in 5 seconds.'
                );
              } catch (err: any) {
                Alert.alert('Push Error', 'Could not send cloud push. Please check connection.');
              }
            }} 
          />
          <SettingItem 
            icon="info-outline" 
            label="Check Push Token Status" 
            value="Diagnose" 
            onPress={async () => {
              const info = await getPushDiagnosticInfo();
              if (info.status === 'ok') {
                Alert.alert(
                  'Push Token Active',
                  `Your phone is ready for remote push notifications!\n\nToken:\n${info.token}`
                );
              } else {
                Alert.alert(
                  'Push Diagnostic Result',
                  `Status: Failed to get push token\n\nReason:\n${info.error}`
                );
              }
            }} 
          />
          <SettingItem icon="language" label="Language" value="English" />
        </View>

        {/* Support */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2 px-1">Support</Text>
        <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingItem icon="help-outline" label="Help Center" />
          <SettingItem icon="chat" label="Contact Support" />
          <SettingItem icon="report-problem" label="Report a Problem" />
        </View>

        {/* About */}
        <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2 px-1">About</Text>
        <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <SettingItem icon="info-outline" label="About DiskarTech" />
          <SettingItem icon="description" label="Terms of Service" />
          <SettingItem icon="security" label="Privacy Policy" />
          <SettingItem icon="code" label="App Version" value="1.0.0" />
        </View>

        {/* Logout */}
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 bg-white rounded-2xl p-4 mt-6 shadow-sm"
          onPress={handleLogout}
          disabled={loading}
        >
          <MaterialIcons name="logout" size={22} color={Colors.error} />
          <Text className="text-base font-semibold text-red-600">
            {loading ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SettingItem({ icon, label, value, badge, badgeColor, onPress }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value?: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={!onPress} 
      activeOpacity={onPress ? 0.7 : 1}
      className="flex-row items-center p-4 border-b border-gray-100 gap-4"
    >
      <MaterialIcons name={icon} size={22} color={Colors.text} />
      <Text className="text-base text-slate-900 flex-1">{label}</Text>
      <View className="flex-row items-center gap-2">
        {badge && (
          <View style={{ backgroundColor: badgeColor === 'success' ? '#E8F5E9' : Colors.gray100 }} className="px-2 py-1 rounded-full">
            <Text style={{ color: badgeColor === 'success' ? '#2E7D32' : Colors.textSecondary }} className="text-xs font-semibold">
              {badge}
            </Text>
          </View>
        )}
        {value && <Text className="text-sm text-slate-500">{value}</Text>}
        <MaterialIcons name="chevron-right" size={20} color={Colors.gray400} />
      </View>
    </TouchableOpacity>
  );
}

function SettingToggle({ icon, label, value, onValueChange }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}) {
  return (
    <View className="flex-row items-center p-4 border-b border-gray-100 gap-4">
      <MaterialIcons name={icon} size={22} color={Colors.text} />
      <Text className="text-base text-slate-900 flex-1">{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.gray300, true: Colors.primary + '60' }}
        thumbColor={value ? Colors.primary : Colors.gray400}
      />
    </View>
  );
}