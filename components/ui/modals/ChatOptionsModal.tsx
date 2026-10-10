import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';

interface ChatOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onViewProfile: () => void;
  onClearChat: () => void;
  onBlockUser: () => void;
}

export default function ChatOptionsModal({
  visible,
  onClose,
  onViewProfile,
  onClearChat,
  onBlockUser,
}: ChatOptionsModalProps) {
  const { colors, isDark } = useDarkMode();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            paddingBottom: 40,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.border,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Options</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Action List */}
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={onViewProfile}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 16,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <MaterialIcons name="person-outline" size={20} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClearChat}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 16,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <MaterialIcons name="delete-outline" size={20} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Clear Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onBlockUser}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 16,
                backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FEE2E2',
                marginTop: 8,
              }}
            >
              <MaterialIcons name="block" size={20} color={colors.accent} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#EF4444' }}>Block User</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}