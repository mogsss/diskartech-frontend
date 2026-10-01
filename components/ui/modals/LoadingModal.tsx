import React from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';

interface LoadingModalProps {
  visible: boolean;
  title?: string;
  message?: string;
}

export default function LoadingModal({
  visible,
  title = 'Processing...',
  message = 'Please wait while we process your request.',
}: LoadingModalProps) {
  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      statusBarTranslucent={true}
    >
      <View className="flex-1 bg-slate-900/60 backdrop-blur-sm items-center justify-center px-6">
        <View className="bg-white rounded-3xl p-6 items-center w-full max-w-[280px] shadow-2xl border border-slate-100">
          
          {/* Spinner na may modern container */}
          <View className="w-14 h-14 rounded-full bg-red-50 items-center justify-center mb-4">
            <ActivityIndicator size="large" color="#DC2626" />
          </View>

          {/* Title */}
          <Text className="text-lg font-bold text-slate-900 text-center mb-1">
            {title}
          </Text>

          {/* Subtitle/Message */}
          <Text className="text-xs text-slate-500 text-center leading-relaxed">
            {message}
          </Text>

        </View>
      </View>
    </Modal>
  );
}