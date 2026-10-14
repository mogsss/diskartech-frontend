import SafeStatusBar from '@/components/ui/SafeStatusBar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useEmployerSubscription } from '@/hooks/useEmployerSubscription';
import { BillingCycle } from '@/utils/employerSubscription';
import { JOB_LIMITS, jobQuotaAvailability, jobQuotaUsage } from '@/utils/jobQuota';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const pesos = (amount: number) => `₱${(amount / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export default function SubscriptionScreen() {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const { data, busy, notice, dismissNotice, refresh, checkPayment, checkout } = useEmployerSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('premium');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');
  const pending = data?.payment && ['creating', 'pending'].includes(data.payment.status) ? data.payment : null;
  const cycle = pending?.billing_cycle ?? selectedCycle;
  const active = data?.subscription.plan === 'premium';
  const amount = data?.subscription.prices[cycle];
  const accentText = isDark ? colors.accent : colors.primary;
  const accentSurface = isDark ? 'rgba(220,38,38,0.12)' : '#FFF1F2';
  const buttonDisabled = busy || !data;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center px-6 pt-2 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Back to profile" className="w-12 h-12 rounded-2xl border items-center justify-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <MaterialIcons name="arrow-back" size={23} color={colors.text} />
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold" style={{ color: colors.text }}>Subscription plans</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="w-full max-w-2xl self-center px-6 pt-2 pb-6">
        <View className="rounded-2xl px-4 py-3 mb-5 flex-row items-start gap-2" style={{ backgroundColor: isDark ? '#3B321D' : '#FFFBEB' }}>
          <MaterialIcons name="science" size={19} color={isDark ? '#FCD34D' : '#92400E'} />
          <Text className="flex-1 text-xs leading-5" style={{ color: isDark ? '#FCD34D' : '#92400E' }}>Test checkout. Payments are simulated and no real money is charged.</Text>
        </View>

        <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>Your current plan</Text>
        <View className="rounded-3xl border p-5 mb-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          {data ? <>
            <View className="flex-row items-center gap-3">
              <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={active ? 'workspace-premium' : 'layers'} size={22} color={accentText} /></View>
              <View className="flex-1">
                <Text className="text-base font-semibold" style={{ color: colors.text }}>{active ? 'Premium' : 'Basic'} plan</Text>
                <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{active && data.subscription.expires_at ? `Valid until ${new Date(data.subscription.expires_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}` : active ? 'Your Premium plan is active.' : 'Your standard employer account.'}</Text>
              </View>
            </View>
            {active && <Text className="text-xs leading-5 mt-3" style={{ color: colors.textSecondary }}>No automatic renewal. Renewing adds time to your current plan.</Text>}
            {data.subscription.job_quota && <View className="mt-4 pt-3 border-t" style={{ borderColor: colors.border }}>
              <Text className="text-sm font-semibold" style={{ color: colors.text }}>{jobQuotaUsage(data.subscription.job_quota)}</Text>
              <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{jobQuotaAvailability(data.subscription.job_quota)}</Text>
            </View>}
          </> : <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm" style={{ color: colors.textSecondary }}>{busy ? 'Loading subscription…' : 'Subscription details are unavailable.'}</Text>
            {busy ? <ActivityIndicator color={colors.primary} /> : <TouchableOpacity onPress={() => void refresh()} accessibilityRole="button" className="min-h-12 justify-center px-3"><Text className="text-sm font-semibold" style={{ color: accentText }}>Try again</Text></TouchableOpacity>}
          </View>}
        </View>

        {pending && <View className="rounded-2xl border p-4 mb-5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text className="text-sm font-semibold" style={{ color: colors.text }}>Payment pending</Text>
          <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>You have an unfinished {pending.billing_cycle === 'monthly' ? 'monthly' : 'annual'} checkout. Resume it or check whether your payment has completed.</Text>
          <View className="flex-row flex-wrap gap-2 mt-3">
            <TouchableOpacity onPress={() => void checkout(pending.billing_cycle)} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} className="min-h-12 rounded-xl px-3 justify-center" style={{ backgroundColor: accentSurface, opacity: busy ? 0.5 : 1 }}><Text className="text-xs font-semibold" style={{ color: accentText }}>Resume checkout</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => void checkPayment()} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} className="min-h-12 rounded-xl border px-3 justify-center" style={{ borderColor: colors.border, opacity: busy ? 0.5 : 1 }}><Text className="text-xs font-semibold" style={{ color: colors.text }}>Check payment</Text></TouchableOpacity>
          </View>
        </View>}

        <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>Choose your plan</Text>
        {(['basic', 'premium'] as const).map(plan => {
          const selected = selectedPlan === plan;
          return <TouchableOpacity key={plan} onPress={() => setSelectedPlan(plan)} disabled={busy} activeOpacity={0.75} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: busy }} className="rounded-3xl border p-5 mb-3" style={{ backgroundColor: selected ? accentSurface : colors.surface, borderColor: selected ? colors.primary : colors.border }}>
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className="text-base font-semibold" style={{ color: colors.text }}>{plan === 'basic' ? 'Basic' : 'Premium'}</Text>
              <Text className="text-sm font-semibold" style={{ color: accentText }}>{plan === 'basic' ? 'Free' : amount ? `${pesos(amount)} / ${cycle === 'monthly' ? 'month' : 'year'}` : 'Loading price…'}</Text>
            </View>
            <Text className="text-sm font-medium mt-2" style={{ color: colors.text }}>{plan === 'premium' ? 'Unlimited active job posts' : `Up to ${JOB_LIMITS.basic} active job posts`}</Text>
            <Text className="text-xs leading-5 mt-1" style={{ color: colors.textSecondary }}>{plan === 'basic' ? 'Post up to 3 openings at a time. Closing a post frees a slot.' : 'Post as many openings as you need while your Premium plan is active.'}</Text>
          </TouchableOpacity>;
        })}

        {selectedPlan === 'premium' && <View className="mt-2">
          <Text accessibilityRole="header" className="text-sm font-semibold mb-2 px-1" style={{ color: colors.text }}>Plan duration</Text>
          <View className="rounded-3xl border p-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-row gap-2">
              {(['monthly', 'annually'] as const).map(option => <TouchableOpacity key={option} onPress={() => setSelectedCycle(option)} disabled={busy || !!pending} activeOpacity={0.75} accessibilityRole="radio" accessibilityState={{ checked: cycle === option, disabled: busy || !!pending }} className="flex-1 min-h-12 rounded-xl border px-3 py-3 items-center justify-center" style={{ backgroundColor: cycle === option ? colors.primary : colors.surface, borderColor: cycle === option ? colors.primary : colors.border, opacity: busy ? 0.5 : 1 }}>
                <Text className="text-sm font-semibold" style={{ color: cycle === option ? '#FFFFFF' : colors.text }}>{option === 'monthly' ? 'Monthly' : 'Annually'}</Text>
                <Text className="text-xs mt-1" style={{ color: cycle === option ? '#FFFFFF' : colors.textSecondary }}>{data ? pesos(data.subscription.prices[option]) : '…'}</Text>
              </TouchableOpacity>)}
            </View>
            <Text className="text-xs leading-5 mt-3" style={{ color: colors.textSecondary }}>One-time payment. Choose from the available payment methods on the PayMongo checkout page.</Text>
          </View>
        </View>}

        {selectedPlan === 'basic' && active && <Text className="text-xs leading-5 mt-2 px-1" style={{ color: colors.textSecondary }}>Your Premium plan remains active until it expires. Selecting Basic does not cancel the time you already paid for.</Text>}
      </ScrollView>

      <View className="border-t" style={{ backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="w-full max-w-2xl self-center px-6 pt-4">
          <TouchableOpacity onPress={() => selectedPlan === 'basic' ? router.back() : void checkout(cycle)} disabled={buttonDisabled} accessibilityRole="button" accessibilityState={{ disabled: buttonDisabled, busy }} activeOpacity={0.75} className="min-h-12 rounded-2xl py-4 px-4 items-center justify-center" style={{ backgroundColor: colors.primary, opacity: buttonDisabled ? 0.5 : 1 }}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-sm font-semibold text-white text-center">{selectedPlan === 'basic' ? 'Back to profile' : pending ? 'Resume checkout' : active ? 'Renew Premium' : 'Continue to checkout'}</Text>}
          </TouchableOpacity>
          <Text className="text-xs text-center leading-5 mt-2" style={{ color: colors.textSecondary }}>Premium activates after payment is confirmed.</Text>
        </View>
      </View>

      <NotificationModal visible={!!notice} title={notice?.title ?? ''} message={notice?.message ?? ''} iconName={notice?.title === 'Payment confirmed' ? 'check-circle-outline' : 'info-outline'} onPrimaryPress={dismissNotice} />
    </View>
  );
}
