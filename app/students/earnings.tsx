import { Colors } from '@/constants/colors';
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
  const [period, setPeriod] = useState('This Month');
  const totalEarnings = earningsData.filter(e => e.status === 'completed').reduce((sum, e) => sum + e.amount, 0);
  const pendingEarnings = earningsData.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 pt-12 pb-4 bg-white">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-slate-900 flex-1">Earnings</Text>
        <TouchableOpacity className="flex-row items-center bg-gray-100 px-4 py-2 rounded-full">
          <Text className="text-sm font-medium text-slate-900 mr-1">{period}</Text>
          <MaterialIcons name="arrow-drop-down" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View className="bg-white m-6 rounded-2xl p-6 shadow-md">
        <View className="flex-row items-center">
          <View className="flex-1 items-center">
            <Text className="text-xs text-slate-400 mb-1">Total Earned</Text>
            <Text className="text-2xl font-bold text-red-600">₱{totalEarnings.toLocaleString()}</Text>
          </View>
          <View className="w-[1px] h-[50px] bg-gray-200 mx-6" />
          <View className="flex-1 items-center">
            <Text className="text-xs text-slate-400 mb-1">Pending</Text>
            <Text className="text-2xl font-bold text-amber-500">₱{pendingEarnings.toLocaleString()}</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-center gap-1 mt-4 pt-4 border-t border-gray-100">
          <MaterialIcons name="verified" size={16} color={Colors.primary} />
          <Text className="text-xs font-medium text-red-600">Available for withdrawal</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        {earningsData.map((earning) => (
          <View key={earning.id} className="flex-row items-center justify-between bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-center flex-1">
              <View 
                style={{ backgroundColor: Colors.primary + '15' }}
                className="w-10 h-10 rounded-full items-center justify-center mr-4"
              >
                <Text className="text-base font-bold text-red-600">{earning.companyName[0]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">{earning.jobTitle}</Text>
                <Text className="text-xs text-slate-500">{earning.companyName}</Text>
                <Text className="text-[11px] text-slate-400 mt-[2px]">{earning.date}</Text>
              </View>
            </View>
            <View className="items-end gap-1">
              <Text className="text-lg font-bold text-red-600">₱{earning.amount.toLocaleString()}</Text>
              <View 
                style={{ backgroundColor: earning.status === 'completed' ? '#E8F5E9' : '#FFF3E0' }}
                className="px-2 py-[2px] rounded-full"
              >
                <Text 
                  style={{ color: earning.status === 'completed' ? '#4CAF50' : '#FF9800' }}
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