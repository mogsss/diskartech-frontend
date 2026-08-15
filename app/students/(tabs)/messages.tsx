import Avatar from '@/components/ui/Avatar';
import { Colors } from '@/constants/colors';
import { conversations } from '@/data/messages';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function MessagesScreen() {
  const handleConversationPress = (conversationId: string) => {
    // Siguraduhing tama ang path patungo sa iyong chat screen file
    router.push(`/chat?id=${conversationId}` as any);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900 align-items-center justify-center text-center">Messages</Text>
      </View>

      {/* Conversations List */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {conversations.map((conv) => (
          <TouchableOpacity
            key={conv.id}
            className={`flex-row bg-white rounded-2xl p-4 mb-3 shadow-sm items-center ${
              conv.unread ? 'border-l-[3px] border-l-red-600' : ''
            }`}
            onPress={() => handleConversationPress(conv.id)}
            activeOpacity={0.7}
          >
            <View className="mr-4">
              <Avatar
                uri={conv.senderAvatar}
                name={conv.senderName}
                size={52}
                online={conv.online}
              />
            </View>
            <View className="flex-1 justify-center">
              <View className="flex-row justify-between items-center mb-1">
                <Text 
                  className={`text-sm text-slate-900 flex-1 mr-2 ${
                    conv.unread ? 'font-bold text-slate-900' : 'font-semibold'
                  }`} 
                  numberOfLines={1}
                >
                  {conv.senderName}
                </Text>
                <Text className="text-xs text-slate-400">{conv.timestamp}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text 
                  className={`text-sm text-slate-500 flex-1 ${
                    conv.unread ? 'font-bold text-slate-900' : ''
                  }`} 
                  numberOfLines={1}
                >
                  {conv.lastMessage}
                </Text>
                {conv.unread && <View className="w-2 h-2 rounded-full bg-red-600" />}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}