import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function VerificationStatusScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isHousehold = type === 'household';

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        <View className="flex-row items-center mb-6 pt-4">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-900">Verification Status</Text>
        </View>

        {/* Status Card */}
        <View className="bg-white rounded-2xl p-6 items-center shadow-md mb-4">
          <View 
            style={{ backgroundColor: Colors.warning + '15' }}
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
          >
            <MaterialIcons name="hourglass-empty" size={48} color={Colors.warning} />
          </View>
          <Text className="text-xl font-bold text-slate-900 mb-2">Verification Pending</Text>
          <Text className="text-base text-slate-500 text-center mb-6 leading-[22px]">
            {isHousehold
              ? 'Your valid ID is currently being reviewed. This usually takes 1-2 business days.'
              : 'Your account and business documents are currently being reviewed. This usually takes 1-2 business days.'}
          </Text>
          
          <View className="w-full items-center px-4">
            <View className="flex-row items-center w-full mb-1">
              <View className="w-7 h-7 rounded-full items-center justify-center bg-emerald-600 mr-4">
                <MaterialIcons name="check" size={16} color={Colors.white} />
              </View>
              <Text className="text-sm text-slate-500">Documents Submitted</Text>
            </View>
            <View className="w-[2px] h-5 bg-gray-200 ml-[13px] my-1" />
            <View className="flex-row items-center w-full mb-1">
              <View 
                style={{ backgroundColor: Colors.warning }}
                className="w-7 h-7 rounded-full items-center justify-center mr-4"
              >
                <MaterialIcons name="hourglass-empty" size={16} color={Colors.white} />
              </View>
              <Text style={{ color: Colors.warning }} className="text-sm font-semibold">Under Review</Text>
            </View>
            <View className="w-[2px] h-5 bg-gray-200 ml-[13px] my-1" />
            <View className="flex-row items-center w-full">
              <View className="w-7 h-7 rounded-full items-center justify-center bg-gray-200 mr-4">
                <MaterialIcons name="check" size={16} color={Colors.gray400} />
              </View>
              <Text className="text-sm text-slate-500">Verified</Text>
            </View>
          </View>
        </View>

        {/* Documents */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-900 mb-4">Uploaded Documents</Text>
          
          {/* Government ID - Laging present para sa pareho */}
          <View className="flex-row items-center gap-4 py-2 border-b border-gray-100">
            <MaterialIcons name="description" size={24} color={Colors.success} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-900">Government Valid ID</Text>
              <Text className="text-xs text-slate-500 mt-0.5">Verified</Text>
            </View>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
          </View>

          {/* Business Permit - Ipapakita lang kung Business Employer */}
          {!isHousehold && (
            <View className="flex-row items-center gap-4 py-2 border-b border-gray-100">
              <MaterialIcons name="description" size={24} color={Colors.warning} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">Business Permit</Text>
                <Text className="text-xs text-slate-500 mt-0.5">Pending Review</Text>
              </View>
              <MaterialIcons name="hourglass-empty" size={20} color={Colors.warning} />
            </View>
          )}

          <PrimaryButton
            title={isHousehold ? "Upload Valid ID Again" : "Upload Documents Again"}
            onPress={() => {}}
            variant="outline"
            size="large"
            icon={<MaterialIcons name="cloud-upload" size={20} color={Colors.primary} />}
            style={{ marginTop: 16 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}