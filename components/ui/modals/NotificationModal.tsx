import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDarkMode } from '@/hooks/useDarkMode';

interface NotificationModalProps {
  visible: boolean;
  title: string;
  message: string | React.ReactNode;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  primaryButtonText?: string;
  onPrimaryPress: () => void;
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
  onRequestClose?: () => void;
  onBackdropPress?: () => void;
  buttonLayout?: 'stacked' | 'row';
  hideActions?: boolean;
}

export default function NotificationModal({
  visible,
  title,
  message,
  iconName = 'info', // Default icon
  iconColor = '#DC2626', // Default color (Red)
  iconBgColor = 'bg-red-50', // Default background
  primaryButtonText = 'OK',
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  onRequestClose,
  onBackdropPress,
  buttonLayout = 'stacked',
  hideActions = false,
}: NotificationModalProps) {
  const { colors, isDark } = useDarkMode();
  const displayedIconColor = isDark && ['#DC2626', '#D32F2F', '#B91C1C'].includes(iconColor.toUpperCase())
    ? colors.accent
    : iconColor;
  const hasSecondaryAction = Boolean(secondaryButtonText && onSecondaryPress);
  const useButtonRow = buttonLayout === 'row' && hasSecondaryAction;
  const secondaryAction = hasSecondaryAction ? (
    <TouchableOpacity
      onPress={onSecondaryPress}
      accessibilityRole="button"
      activeOpacity={0.7}
      className={useButtonRow
        ? 'flex-1 min-h-12 px-3 py-3.5 rounded-xl border items-center justify-center'
        : 'w-full py-3 items-center'}
      style={useButtonRow ? { borderColor: colors.border } : undefined}
    >
      <Text
        style={{ color: colors.textSecondary }}
        className={useButtonRow ? 'font-bold text-base text-center' : 'font-semibold text-sm'}
      >
        {secondaryButtonText}
      </Text>
    </TouchableOpacity>
  ) : null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onRequestClose || onSecondaryPress || onPrimaryPress}>
      <View className="flex-1 justify-center items-center bg-black/60 px-6">
        {onBackdropPress && <Pressable
          onPress={onBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />}
        
        <View
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="w-full rounded-3xl p-6 items-center shadow-lg border"
        >
          
          {/* Dynamic Icon */}
          <View
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : undefined,
            }}
            className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${isDark ? '' : iconBgColor}`}
          >
            <MaterialIcons name={iconName} size={32} color={displayedIconColor} />
          </View>
          
          {/* Dynamic Text */}
          <Text style={{ color: colors.text }} className="text-xl font-bold mb-2 text-center">{title}</Text>
          <Text style={{ color: colors.textSecondary }} className="text-center mb-6 leading-relaxed">
            {message}
          </Text>

          {!hideActions && <View className={useButtonRow ? 'w-full flex-row items-stretch gap-3' : 'w-full'}>
            {useButtonRow && secondaryAction}
            <TouchableOpacity
              onPress={onPrimaryPress}
              accessibilityRole="button"
              activeOpacity={0.7}
              className={useButtonRow
                ? 'flex-1 min-h-12 bg-red-600 px-3 py-3.5 rounded-xl items-center justify-center'
                : 'w-full bg-red-600 py-3.5 rounded-xl items-center mb-3'}
              style={iconColor !== '#DC2626' ? { backgroundColor: iconColor } : undefined}
            >
              <Text className="text-white font-bold text-base text-center">{primaryButtonText}</Text>
            </TouchableOpacity>
            {!useButtonRow && secondaryAction}
          </View>}
        </View>
        
      </View>
    </Modal>
  );
}
