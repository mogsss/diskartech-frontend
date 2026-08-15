import NotificationCard from '@/components/ui/NotificationCard';
import { Colors } from '@/constants/colors';
import { notifications } from '@/data/notifications';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsScreen() {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-900">Notifications</Text>
          {unreadCount > 0 && (
            <Text className="text-xs text-blue-600 font-semibold mt-[2px]">{unreadCount} unread</Text>
          )}
        </View>
        <TouchableOpacity className="py-2 px-4">
          <Text className="text-sm text-blue-600 font-semibold">Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onPress={() => {}}
          />
        ))}
      </ScrollView>
    </View>
  );
}