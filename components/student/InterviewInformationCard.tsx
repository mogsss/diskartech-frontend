import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import ApplicationSection from '@/components/student/application-details/ApplicationSection';
import { useInterviewCallAvailability } from '@/hooks/useInterviewCallAvailability';

interface InterviewInformationCardProps {
  applicationId: string | number;
  interviewDetails: { date?: string; time?: string; location?: string; type?: string } | null;
  companyName: string;
  fallbackLocation?: string;
  latitude?: number;
  longitude?: number;
  onAddToCalendar: () => void;
  onJoinInterview: () => void;
  onOpenMap: (address: string) => void;
}

export default function InterviewInformationCard({ applicationId, interviewDetails, fallbackLocation, onAddToCalendar, onJoinInterview, onOpenMap }: InterviewInformationCardProps) {
  const { isDark, colors } = useDarkMode();
  const accent = isDark ? colors.accent : '#B91C1C';
  const isOnline = interviewDetails?.type === 'online';
  const availability = useInterviewCallAvailability(applicationId, true);
  const venueAddress = interviewDetails?.location || fallbackLocation || 'Workplace venue';
  return (
    <ApplicationSection title="Interview details" icon="event-available" badge={
      <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: isDark ? colors.background : '#F1F5F9' }}>
        <Text className="text-[10px] font-semibold" style={{ color: colors.textSecondary }}>{isOnline ? 'Online' : 'Walk-in'}</Text>
      </View>
    }>
      <View className="gap-3">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Date</Text>
            <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{interviewDetails?.date || 'To be scheduled in chat'}</Text>
          </View>
          <View className="flex-1 pl-3 border-l" style={{ borderLeftColor: colors.border }}>
            <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>Time</Text>
            <Text className="text-sm font-medium leading-5" style={{ color: colors.text }}>{interviewDetails?.time || 'To be scheduled in chat'}</Text>
          </View>
        </View>
        <View className="border-t pt-3" style={{ borderTopColor: colors.border }}>
          <Text className="text-[11px] mb-1" style={{ color: colors.textSecondary }}>{isOnline ? 'Interview method' : 'Venue address'}</Text>
          <TouchableOpacity disabled={isOnline} onPress={() => onOpenMap(venueAddress)} accessibilityLabel={isOnline ? undefined : 'View interview venue on map'} activeOpacity={0.7}>
            <Text className="text-sm leading-5" style={{ color: colors.text }}>{isOnline ? 'DiskarTech video call' : venueAddress}</Text>
          </TouchableOpacity>
        </View>
        {!isOnline && (
          <TouchableOpacity onPress={() => onOpenMap(venueAddress)} accessibilityRole="button" accessibilityLabel="View interview directions" activeOpacity={0.7} className="flex-row items-center justify-center gap-2 rounded-xl border px-3 py-2.5" style={{ minHeight: 44, borderColor: colors.border }}>
            <MaterialIcons name="directions" size={17} color={accent} />
            <Text className="text-xs font-semibold" style={{ color: accent }}>View directions</Text>
          </TouchableOpacity>
        )}
        {isOnline && <TouchableOpacity onPress={onJoinInterview} disabled={!availability.canJoin} accessibilityState={{ disabled: !availability.canJoin }} accessibilityRole="button" className="flex-row items-center justify-center gap-2 rounded-xl px-3 py-3" style={{ minHeight: 44, backgroundColor: colors.primary, opacity: availability.canJoin ? 1 : 0.45 }}>
          <MaterialIcons name="videocam" size={19} color="#FFFFFF" /><Text className="text-xs font-semibold text-white">Enter Interview Room</Text>
        </TouchableOpacity>}
        {isOnline && <Text className="text-[11px] text-center leading-5" style={{ color: colors.textSecondary }}>{availability.message}</Text>}
        {availability.canAddToCalendar && <TouchableOpacity onPress={onAddToCalendar} accessibilityRole="button" accessibilityLabel="Add interview to calendar" activeOpacity={0.8} className="flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3" style={{ minHeight: 44, borderColor: colors.border }}>
          <MaterialIcons name="event" size={17} color={accent} />
          <Text className="text-xs font-semibold" style={{ color: accent }}>Add to calendar</Text>
        </TouchableOpacity>}
      </View>
    </ApplicationSection>
  );
}
