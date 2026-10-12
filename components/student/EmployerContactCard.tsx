import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getInitials } from '@/utils/helpers';
import { useDarkMode } from '@/hooks/useDarkMode';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';

interface EmployerContactCardProps {
  companyName: string;
  employerAvatar?: string;
  isHousehold?: boolean;
  fullAddress: string;
  onMessage: () => void;
  onOpenMap: () => void;
}

export default function EmployerContactCard({ companyName, employerAvatar, isHousehold, fullAddress, onMessage, onOpenMap }: EmployerContactCardProps) {
  const { isDark, colors } = useDarkMode();
  const accent = isDark ? colors.accent : '#B91C1C';
  return (
    <ApplicationSection title={isHousehold ? 'Household information' : 'Employer information'} icon={isHousehold ? 'home' : 'business'}>
      <View className="flex-row items-center gap-3 mb-4">
        <View className="w-12 h-12 rounded-xl border overflow-hidden items-center justify-center" style={{ backgroundColor: isDark ? colors.background : '#FEF2F2', borderColor: colors.border }}>
          {employerAvatar ? <Image source={{ uri: employerAvatar }} className="w-full h-full" resizeMode="cover" /> : <Text className="text-base font-bold" style={{ color: accent }}>{getInitials(companyName)}</Text>}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold leading-5" style={{ color: colors.text }}>{companyName}</Text>
          <Text className="text-[11px] mt-1" style={{ color: colors.textSecondary }}>{isHousehold ? 'Household employer' : 'Business employer'}</Text>
        </View>
        <TouchableOpacity
          onPress={onMessage}
          accessibilityRole="button"
          accessibilityLabel={isHousehold ? 'Message household' : 'Message employer'}
          activeOpacity={0.7}
          className="w-11 h-11 rounded-xl border items-center justify-center"
          style={{ borderColor: colors.border }}
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color={accent} accessible={false} />
        </TouchableOpacity>
      </View>
      <View className="border-t pt-3" style={{ borderTopColor: colors.border }}>
        <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Workplace address</Text>
        <Text className="text-sm leading-5 mb-3" style={{ color: colors.text }}>{fullAddress}</Text>
        <TouchableOpacity onPress={onOpenMap} accessibilityRole="button" accessibilityLabel="View workplace directions" activeOpacity={0.7} className="flex-row items-center justify-center gap-2 rounded-xl border px-3 py-2.5" style={{ minHeight: 44, borderColor: colors.border }}>
          <MaterialIcons name="directions" size={17} color={accent} />
          <Text className="text-xs font-semibold" style={{ color: accent }}>View directions</Text>
        </TouchableOpacity>
      </View>
    </ApplicationSection>
  );
}
