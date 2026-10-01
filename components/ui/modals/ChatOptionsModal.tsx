import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 pb-10 shadow-lg">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <Text className="text-lg font-bold text-slate-900">Options</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Action List */}
          <View className="gap-2">
            <TouchableOpacity 
              onPress={onViewProfile}
              className="flex-row items-center py-3.5 px-4 rounded-2xl bg-gray-50 border border-gray-100"
            >
              <MaterialIcons name="person-outline" size={20} color={Colors.text} style={{ marginRight: 12 }} />
              <Text className="text-base font-semibold text-slate-800">View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={onClearChat}
              className="flex-row items-center py-3.5 px-4 rounded-2xl bg-gray-50 border border-gray-100"
            >
              <MaterialIcons name="delete-outline" size={20} color={Colors.text} style={{ marginRight: 12 }} />
              <Text className="text-base font-semibold text-slate-800">Clear Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={onBlockUser}
              className="flex-row items-center py-3.5 px-4 rounded-2xl bg-red-50 border border-red-100 mt-2"
            >
              <MaterialIcons name="block" size={20} color="#DC2626" style={{ marginRight: 12 }} />
              <Text className="text-base font-semibold text-red-600">Block User</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}