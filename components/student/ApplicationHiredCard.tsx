import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDate } from '@/utils/helpers';

interface ApplicationHiredCardProps {
  applicationId: string | number;
  acceptedAt?: string;
}

export default function ApplicationHiredCard({
  applicationId,
  acceptedAt,
}: ApplicationHiredCardProps) {
  return (
    <View className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-emerald-200">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <MaterialIcons name="verified" size={15} color="#059669" />
          <Text className="text-emerald-700 text-xs font-bold uppercase tracking-wider">
            Hired
          </Text>
        </View>
        <Text className="text-slate-400 text-xs font-semibold">
          ID: #{applicationId}
        </Text>
      </View>

      <Text className="text-2xl font-extrabold text-slate-900 mb-1">
        Congratulations!
      </Text>
      <Text className="text-slate-600 text-xs leading-5">
        You have been officially hired for this role. Review the job details below and connect with your employer to coordinate your start date.
      </Text>

      <View className="mt-4 pt-3 border-t border-slate-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <MaterialIcons name="event-available" size={15} color="#059669" />
          <Text className="text-slate-500 text-xs font-medium">
            Accepted: {formatDate(acceptedAt || new Date().toISOString())}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          <View className="w-2 h-2 rounded-full bg-emerald-500" />
          <Text className="text-emerald-700 text-xs font-bold">Active Contract</Text>
        </View>
      </View>
    </View>
  );
}
