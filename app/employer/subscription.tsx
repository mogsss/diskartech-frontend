import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';

const plans = [
  { id: 'free', name: 'Free Plan', price: '₱0', period: 'Lifetime', description: 'Limited job postings and applicant review.' },
  { 
    id: 'pro', 
    name: 'Employer Pro', 
    monthlyPrice: '₱149', 
    annualPrice: '₱1,490', 
    monthlyPeriod: 'per month', 
    annualPeriod: 'per year (Save 16%)', 
    description: 'Featured jobs, unlimited applicants, priority support.' 
  },
];

const paymentChannels = [
  { id: 'gcash', name: 'GCash', icon: 'account-balance-wallet' },
  { id: 'maya', name: 'Maya', icon: 'credit-card' },
  { id: 'card', name: 'Credit / Debit Card', icon: 'payment' },
];

// Mahalaga na may "export default" dito
export default function SubscriptionScreen() {
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [selectedChannel, setSelectedChannel] = useState('gcash');

  const handleSubscribe = () => {
    const priceDisplay = selectedPlan === 'free' ? '₱0' : billingCycle === 'monthly' ? '₱149/mo' : '₱1,490/yr';
    Alert.alert(
      "Success!", 
      `You have successfully subscribed to the ${selectedPlan.toUpperCase()} plan (${billingCycle}) for ${priceDisplay} via ${selectedChannel.toUpperCase()}.`,
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="flex-row items-center px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-slate-900">Manage Subscription</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-6 pb-10" showsVerticalScrollIndicator={false}>
        <Text className="text-base font-bold text-slate-900 mb-3">Choose Your Plan</Text>
        
        {/* Plan Cards */}
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const displayPrice = plan.id === 'free' 
            ? plan.price 
            : billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
          
          const displayPeriod = plan.id === 'free' 
            ? plan.period 
            : billingCycle === 'monthly' ? plan.monthlyPeriod : plan.annualPeriod;

          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              className={`bg-white rounded-2xl p-5 mb-3 border-2 ${
                isSelected ? 'border-red-600 bg-red-50/20' : 'border-gray-100'
              }`}
            >
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-bold text-slate-900">{plan.name}</Text>
                  {plan.id === 'pro' && (
                    <View className="bg-red-100 px-2 py-0.5 rounded-full">
                      <Text className="text-[10px] font-bold text-red-600 uppercase">Popular</Text>
                    </View>
                  )}
                </View>
                <Text className="text-base font-extrabold text-red-600">
                  {displayPrice} <Text className="text-xs text-slate-500 font-normal">{displayPeriod}</Text>
                </Text>
              </View>
              <Text className="text-xs text-slate-500">{plan.description}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Billing Cycle Choices (Monthly / Annually) para sa Pro Plan */}
        {selectedPlan === 'pro' && (
          <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Billing Cycle</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setBillingCycle('monthly')}
                className={`flex-1 py-3 rounded-xl items-center justify-center border ${
                  billingCycle === 'monthly' ? 'bg-red-600 border-red-600' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className={`text-xs font-bold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-700'}`}>
                  Monthly (₱149)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setBillingCycle('annually')}
                className={`flex-1 py-3 rounded-xl items-center justify-center border ${
                  billingCycle === 'annually' ? 'bg-red-600 border-red-600' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text className={`text-xs font-bold ${billingCycle === 'annually' ? 'text-white' : 'text-slate-700'}`}>
                  Annually (₱1,490) 
                </Text>
              </TouchableOpacity>
            </View>
            {billingCycle === 'annually' && (
              <Text className="text-[11px] text-emerald-600 font-semibold text-center mt-2">🎉 You save ₱298 with annual billing!</Text>
            )}
          </View>
        )}

        {/* Payment Channels */}
        {selectedPlan === 'pro' && (
          <>
            <Text className="text-base font-bold text-slate-900 mb-3 mt-2">Select Payment Channel</Text>
            {paymentChannels.map((channel) => (
              <TouchableOpacity
                key={channel.id}
                onPress={() => setSelectedChannel(channel.id)}
                className={`flex-row items-center bg-white rounded-xl p-4 mb-2.5 border ${
                  selectedChannel === channel.id ? 'border-red-600 bg-red-50/10' : 'border-gray-100'
                }`}
              >
                <MaterialIcons name={channel.icon as any} size={22} color={selectedChannel === channel.id ? '#D32F2F' : Colors.text} />
                <Text className={`text-sm font-semibold ml-3 flex-1 ${selectedChannel === channel.id ? 'text-red-600 font-bold' : 'text-slate-900'}`}>
                  {channel.name}
                </Text>
                {selectedChannel === channel.id && (
                  <MaterialIcons name="check-circle" size={20} color="#D32F2F" />
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          onPress={handleSubscribe}
          className="bg-red-600 py-4 rounded-2xl items-center justify-center mt-6 shadow-sm"
        >
          <Text className="text-sm font-bold text-white">Confirm & Subscribe</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}