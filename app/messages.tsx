import Avatar from '@/components/ui/Avatar';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

// Mock data para sa mga messages ng employer/household
const employerConversations = [
  {
    id: '1',
    senderName: 'Junnyl Mabini',
    senderAvatar: '',
    lastMessage: 'Good morning po, nag-apply po ako bilang Service Crew.',
    timestamp: '9:41 AM',
    unread: true,
    online: true,
    messages: [
      { id: '1', sender: 'them', text: 'Good morning po, nag-apply po ako bilang Service Crew.', timestamp: '9:41 AM' }
    ]
  },
  {
    id: '2',
    senderName: 'Ana Santos',
    senderAvatar: '',
    lastMessage: 'Salamat po sa pag-accept ng application ko!',
    timestamp: 'Yesterday',
    unread: false,
    online: false,
    messages: [
      { id: '1', sender: 'them', text: 'Salamat po sa pag-accept ng application ko!', timestamp: 'Yesterday' }
    ]
  },
  {
    id: '3',
    senderName: 'Juan Dela Cruz',
    senderAvatar: '',
    lastMessage: 'Available po ba para sa interview bukas?',
    timestamp: '2 days ago',
    unread: false,
    online: true,
    messages: [
      { id: '1', sender: 'them', text: 'Available po ba para sa interview bukas?', timestamp: '2 days ago' }
    ]
  }
];

export default function MessagesScreen() {
  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat?id=${conversationId}` as any);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-bold text-slate-900 text-center">Messages</Text>
      </View>

      {/* Conversations List */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {employerConversations.length > 0 ? (
          employerConversations.map((conv) => (
            <TouchableOpacity
              key={conv.id}
              className={`flex-row bg-white rounded-2xl p-4 mb-3 shadow-sm items-center border border-gray-100 ${
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
          ))
        ) : (
          <View className="items-center justify-center py-20">
            <MaterialIcons name="chat-bubble-outline" size={48} color={Colors.gray400} />
            <Text className="text-sm font-semibold text-slate-600 mt-2">No messages yet</Text>
            <Text className="text-xs text-slate-400 mt-1">Your conversations will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}