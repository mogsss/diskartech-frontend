import { Notification } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface NotificationCardProps {
  notification: any; // Pinalitan pansamantala para maging flexible sa JSX message
  onPress: () => void;
}

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  job_recommendation: { icon: 'work', color: '#2196F3', bg: '#E3F2FD' },
  application_accepted: { icon: 'check-circle', color: '#4CAF50', bg: '#E8F5E9' },
  interview_reminder: { icon: 'event', color: '#FF9800', bg: '#FFF3E0' },
  message: { icon: 'message', color: '#D32F2F', bg: '#FFEBEE' },
  verification_verified: { icon: 'verified', color: '#10B981', bg: '#10B98115' },
  verification_rejected: { icon: 'error-outline', color: '#EF4444', bg: '#EF444415' },
  verification_pending: { icon: 'hourglass-empty', color: '#F59E0B', bg: '#F59E0B15' },
  verification_required: { icon: 'assignment-late', color: '#64748B', bg: '#64748B15' },
  verification: { icon: 'verified-user', color: '#9C27B0', bg: '#F3E5F5' },
};

export default function NotificationCard({ notification, onPress }: NotificationCardProps) {
  let configKey: string = notification.type;

  if (notification.type === 'verification') {
    if (notification.title.includes('Verified')) configKey = 'verification_verified';
    else if (notification.title.includes('Rejected')) configKey = 'verification_rejected';
    else if (notification.title.includes('Pending')) configKey = 'verification_pending';
    else if (notification.title.includes('Required')) configKey = 'verification_required';
  }

  const config = typeConfig[configKey] || typeConfig.job_recommendation;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row bg-white rounded-2xl p-4 mb-3 shadow-sm items-center ${
        !notification.read ? 'border-l-[3px] border-l-red-600' : ''
      }`}
    >
      {/* Icon Container */}
      <View
        style={{ backgroundColor: config.bg }}
        className="w-12 h-12 rounded-xl items-center justify-center mr-4"
      >
        <MaterialIcons name={config.icon as any} size={24} color={config.color} />
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-sm font-semibold text-slate-900 flex-1 mr-2" numberOfLines={1}>
            {notification.title}
          </Text>
          <Text className="text-xs text-slate-400">{notification.timestamp}</Text>
        </View>
        {/* Dito natin pinapayagang mag-render ng JSX (gaya ng bold text) ang message */}
        <Text className="text-xs text-slate-500 leading-4" numberOfLines={3}>
          {notification.message}
        </Text>
      </View>

      {!notification.read && (
        <View className="w-2 h-2 rounded-full bg-red-600 ml-2 self-start mt-1" />
      )}
    </TouchableOpacity>
  );
}