import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ApplicationRejectedCard() {
  return (
    <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex-row items-start gap-3">
      <MaterialIcons name="highlight-off" size={24} color="#dc2626" style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-sm font-bold text-red-900">Application Closed</Text>
        <Text className="text-xs text-red-700 mt-1 leading-relaxed">
          This position was filled or your application was not chosen. You can remove this record from your applications history anytime.
        </Text>
      </View>
    </View>
  );
}
