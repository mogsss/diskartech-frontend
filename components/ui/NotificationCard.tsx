import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';

interface NotificationCardProps {
  notification: {
    type?: string;
    title?: string;
    message?: React.ReactNode;
    timestamp?: string;
    read?: boolean;
  };
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];
const typeConfig: Record<string, { icon: IconName; label: string }> = {
  new_job: { icon: 'location-on', label: 'Job alert' },
  job_recommendation: { icon: 'work-outline', label: 'Job recommendation' },
  application_accepted: { icon: 'check-circle-outline', label: 'Application' },
  interview_reminder: { icon: 'event-available', label: 'Interview' },
  message: { icon: 'chat-bubble-outline', label: 'Message' },
  verification: { icon: 'verified-user', label: 'Verification' },
  application: { icon: 'assignment-ind', label: 'Application' },
  application_status: { icon: 'assignment', label: 'Application update' },
  general: { icon: 'notifications-none', label: 'Update' },
};

export default function NotificationCard({ notification, onPress, onLongPress, selectionMode = false, selected = false, disabled = false }: NotificationCardProps) {
  const { colors, isDark } = useDarkMode();
  const title = notification.title || 'Notification';
  const normalizedTitle = title.toLowerCase();
  let config = typeConfig[notification.type || 'general'] || typeConfig.general;
  let iconColor = colors.accent;
  if (notification.type === 'verification') {
    if (normalizedTitle.includes('verified')) {
      config = { icon: 'verified', label: 'Verification' };
      iconColor = isDark ? '#4ADE80' : '#16A34A';
    } else if (normalizedTitle.includes('rejected')) {
      config = { icon: 'error-outline', label: 'Verification' };
      iconColor = isDark ? '#F87171' : '#DC2626';
    } else if (normalizedTitle.includes('pending') || normalizedTitle.includes('review')) {
      config = { icon: 'hourglass-empty', label: 'Verification' };
      iconColor = isDark ? '#FBBF24' : '#B45309';
    }
  } else if (notification.type !== 'message' && normalizedTitle.includes('interview')) {
    config = { icon: 'event-available', label: 'Interview' };
  }
  const unread = !notification.read;
  const hasDestination = ['message', 'new_job', 'application', 'application_status', 'verification'].includes(notification.type || '');

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityState={selectionMode ? { checked: selected, disabled } : { disabled }}
      accessibilityLabel={title + (unread ? ', unread' : '')}
      accessibilityHint={selectionMode ? 'Tap to change selection.' : 'Long press to select this notification.'}
      accessibilityActions={onLongPress && !selectionMode ? [{ name: 'select', label: 'Select notification' }] : undefined}
      onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'select') onLongPress?.(); }}
      className="mb-3 flex-row items-start gap-3 rounded-2xl border p-4"
      style={{ backgroundColor: colors.surface, borderColor: selected ? colors.accent : unread ? colors.accent + '40' : colors.border }}
    >
      <View className="h-10 w-10 items-center justify-center">
        <MaterialIcons name={selectionMode ? selected ? 'check-box' : 'check-box-outline-blank' : config.icon} size={selectionMode ? 24 : 21} color={selectionMode ? selected ? colors.accent : colors.textSecondary : iconColor} accessible={false} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="mb-1.5 flex-row items-center justify-between gap-2">
          <Text className="text-[10px] font-medium" style={{ color: colors.textSecondary }}>{config.label}</Text>
          {unread && <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />}
        </View>
        <Text className="text-sm font-semibold leading-5" style={{ color: colors.text }} numberOfLines={2}>{title}</Text>
        <Text className="mt-1.5 text-xs leading-5" style={{ color: colors.textSecondary }} numberOfLines={3}>
          {notification.message}
        </Text>
        <View className="mt-3 flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-1">
            <MaterialIcons name="access-time" size={12} color={colors.textSecondary} />
            <Text className="flex-1 text-[10px]" style={{ color: colors.textSecondary }}>{notification.timestamp || 'Recent'}</Text>
          </View>
          {hasDestination && !selectionMode && <MaterialIcons name="chevron-right" size={18} color={colors.textSecondary} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}
