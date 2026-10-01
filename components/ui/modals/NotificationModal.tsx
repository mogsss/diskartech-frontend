import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
}: NotificationModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onSecondaryPress || onPrimaryPress}>
      <View className="flex-1 justify-center items-center bg-black/50 px-6">
        
        <View className="bg-white w-full rounded-3xl p-6 items-center shadow-lg">
          
          {/* Dynamic Icon */}
          <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${iconBgColor}`}>
            <MaterialIcons name={iconName} size={32} color={iconColor} />
          </View>
          
          {/* Dynamic Text */}
          <Text className="text-xl font-bold text-slate-900 mb-2 text-center">{title}</Text>
          <Text className="text-center text-slate-500 mb-6 leading-relaxed">
            {message}
          </Text>

          {/* Primary Action Button */}
          <TouchableOpacity
            onPress={onPrimaryPress}
            className="w-full bg-red-600 py-3.5 rounded-xl items-center mb-3"
            style={iconColor !== '#DC2626' ? { backgroundColor: iconColor } : {}} // Match button color to icon color if provided
          >
            <Text className="text-white font-bold text-base">{primaryButtonText}</Text>
          </TouchableOpacity>

          {/* Secondary Action Button (Optional) */}
          {secondaryButtonText && onSecondaryPress && (
            <TouchableOpacity onPress={onSecondaryPress} className="w-full py-3 items-center">
              <Text className="text-slate-400 font-semibold text-sm">{secondaryButtonText}</Text>
            </TouchableOpacity>
          )}
        </View>
        
      </View>
    </Modal>
  );
}