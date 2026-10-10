import { Colors } from '@/constants/colors';
import { useDarkMode } from '@/hooks/useDarkMode';
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

export default function SubscriptionScreen() {
  const { colors, isDark } = useDarkMode();
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
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View 
        className="flex-row items-center px-6 pt-12 pb-4 border-b"
        style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full items-center justify-center mr-4"
          style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>Manage Subscription</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-6 pb-10" showsVerticalScrollIndicator={false}>
        <Text className="text-base font-bold mb-3" style={{ color: colors.text }}>Choose Your Plan</Text>
        
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
              className="rounded-2xl p-5 mb-3 border-2"
              style={{
                backgroundColor: isSelected 
                  ? (isDark ? 'rgba(220, 38, 38, 0.12)' : 'rgba(254, 242, 242, 0.7)') 
                  : colors.surface,
                borderColor: isSelected ? '#DC2626' : colors.border,
              }}
            >
              <View className="flex-row justify-between items-center mb-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-bold" style={{ color: colors.text }}>{plan.name}</Text>
                  {plan.id === 'pro' && (
                    <View 
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: isDark ? 'rgba(220, 38, 38, 0.25)' : '#FEE2E2' }}
                    >
                      <Text className="text-[10px] font-bold text-red-600 uppercase">Popular</Text>
                    </View>
                  )}
                </View>
                <Text className="text-base font-extrabold text-red-600">
                  {displayPrice} <Text className="text-xs font-normal" style={{ color: colors.textSecondary }}>{displayPeriod}</Text>
                </Text>
              </View>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>{plan.description}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Billing Cycle Choices (Monthly / Annually) para sa Pro Plan */}
        {selectedPlan === 'pro' && (
          <View 
            className="rounded-2xl p-4 mb-4 border shadow-sm"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Text className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.textSecondary }}>Billing Cycle</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setBillingCycle('monthly')}
                className="flex-1 py-3 rounded-xl items-center justify-center border"
                style={{
                  backgroundColor: billingCycle === 'monthly' ? '#DC2626' : (isDark ? colors.background : '#F8FAFC'),
                  borderColor: billingCycle === 'monthly' ? '#DC2626' : colors.border,
                }}
              >
                <Text 
                  className="text-xs font-bold"
                  style={{ color: billingCycle === 'monthly' ? '#FFFFFF' : colors.text }}
                >
                  Monthly (₱149)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setBillingCycle('annually')}
                className="flex-1 py-3 rounded-xl items-center justify-center border"
                style={{
                  backgroundColor: billingCycle === 'annually' ? '#DC2626' : (isDark ? colors.background : '#F8FAFC'),
                  borderColor: billingCycle === 'annually' ? '#DC2626' : colors.border,
                }}
              >
                <Text 
                  className="text-xs font-bold"
                  style={{ color: billingCycle === 'annually' ? '#FFFFFF' : colors.text }}
                >
                  Annually (₱1,490) 
                </Text>
              </TouchableOpacity>
            </View>
            {billingCycle === 'annually' && (
              <Text className="text-[11px] text-emerald-500 font-semibold text-center mt-2">🎉 You save ₱298 with annual billing!</Text>
            )}
          </View>
        )}

        {/* Payment Channels */}
        {selectedPlan === 'pro' && (
          <>
            <Text className="text-base font-bold mb-3 mt-2" style={{ color: colors.text }}>Select Payment Channel</Text>
            {paymentChannels.map((channel) => (
              <TouchableOpacity
                key={channel.id}
                onPress={() => setSelectedChannel(channel.id)}
                className="flex-row items-center rounded-xl p-4 mb-2.5 border"
                style={{
                  backgroundColor: selectedChannel === channel.id 
                    ? (isDark ? 'rgba(220, 38, 38, 0.12)' : 'rgba(254, 242, 242, 0.6)') 
                    : colors.surface,
                  borderColor: selectedChannel === channel.id ? '#DC2626' : colors.border,
                }}
              >
                <MaterialIcons name={channel.icon as any} size={22} color={selectedChannel === channel.id ? '#DC2626' : colors.textSecondary} />
                <Text 
                  className="text-sm font-semibold ml-3 flex-1"
                  style={{ color: selectedChannel === channel.id ? '#DC2626' : colors.text }}
                >
                  {channel.name}
                </Text>
                {selectedChannel === channel.id && (
                  <MaterialIcons name="check-circle" size={20} color={colors.accent} />
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