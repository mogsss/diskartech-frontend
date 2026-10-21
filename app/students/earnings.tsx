import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

const earningsData = [
  { id: '1', jobTitle: 'Service Crew', companyName: "McDonald's", amount: 4500, status: 'completed' as const, date: '2024-01-15' },
  { id: '2', jobTitle: 'Service Crew', companyName: "McDonald's", amount: 3800, status: 'completed' as const, date: '2024-01-08' },
  { id: '3', jobTitle: 'Online Tutor', companyName: 'TutorPro PH', amount: 2400, status: 'pending' as const, date: '2024-01-10' },
  { id: '4', jobTitle: 'Delivery Partner', companyName: 'Grab', amount: 3200, status: 'completed' as const, date: '2024-01-05' },
];

export default function EarningsScreen() {
  const { colors, isDark } = useDarkMode();
  const [period, setPeriod] = useState('This Month');
  const totalEarnings = earningsData.filter(e => e.status === 'completed').reduce((sum, e) => sum + e.amount, 0);
  const pendingEarnings = earningsData.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <View 
        className="flex-row items-center px-6 pt-12 pb-4 border-b"
        style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 items-center justify-center mr-4"
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold flex-1" style={{ color: colors.text }}>Earnings</Text>
        <TouchableOpacity 
          className="flex-row items-center px-4 py-2 rounded-full"
          style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
        >
          <Text className="text-sm font-medium mr-1" style={{ color: colors.text }}>{period}</Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View 
        className="m-6 rounded-2xl p-6 shadow-md border"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <View className="flex-row items-center">
          <View className="flex-1 items-center">
            <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Total Earned</Text>
            <Text className="text-2xl font-bold text-red-600">₱{totalEarnings.toLocaleString()}</Text>
          </View>
          <View className="w-[1px] h-[50px] mx-6" style={{ backgroundColor: colors.border }} />
          <View className="flex-1 items-center">
            <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>Pending</Text>
            <Text className="text-2xl font-bold text-amber-500">₱{pendingEarnings.toLocaleString()}</Text>
          </View>
        </View>
        <View 
          className="flex-row items-center justify-center gap-1 mt-4 pt-4 border-t"
          style={{ borderTopColor: colors.border }}
        >
          <MaterialIcons name="verified" size={16} color={Colors.primary} />
          <Text className="text-xs font-medium text-red-600">Available for withdrawal</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        {earningsData.map((earning) => (
          <View 
            key={earning.id} 
            className="flex-row items-center justify-between rounded-2xl p-4 mb-3 shadow-sm border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="flex-row items-center flex-1">
              <View 
                style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : Colors.primary + '15' }}
                className="w-10 h-10 rounded-full items-center justify-center mr-4"
              >
                <Text className="text-base font-bold text-red-600">{earning.companyName[0]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>{earning.jobTitle}</Text>
                <Text className="text-xs" style={{ color: colors.textSecondary }}>{earning.companyName}</Text>
                <Text className="text-[11px] mt-[2px]" style={{ color: colors.textSecondary }}>{earning.date}</Text>
              </View>
            </View>
            <View className="items-end gap-1">
              <Text className="text-lg font-bold text-red-600">₱{earning.amount.toLocaleString()}</Text>
              <View 
                style={{ backgroundColor: earning.status === 'completed' ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#E8F5E9') : (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFF3E0') }}
                className="px-2 py-[2px] rounded-full"
              >
                <Text 
                  style={{ color: earning.status === 'completed' ? '#10B981' : '#F59E0B' }}
                  className="text-[10px] font-semibold"
                >
                  {earning.status === 'completed' ? 'Completed' : 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}