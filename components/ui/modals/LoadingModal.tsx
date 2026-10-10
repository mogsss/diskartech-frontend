import React from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';

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
  const { colors, isDark } = useDarkMode();

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={visible}
      statusBarTranslucent={true}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            width: '100%',
            maxWidth: 280,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          {/* Spinner container */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <ActivityIndicator size="large" color="#DC2626" />
          </View>

          {/* Title */}
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center', marginBottom: 4 }}>
            {title}
          </Text>

          {/* Subtitle/Message */}
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }}>
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
}