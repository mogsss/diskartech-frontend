import Avatar from '@/components/ui/Avatar';
import ChatOptionsModal from '@/components/modals/student/ChatOptionsModal';
import { Colors } from '@/constants/colors';
import { conversations } from '@/data/messages';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const initialConversation = conversations.find((c) => c.id === id);

  const [message, setMessage] = useState('');
  const [messagesList, setMessagesList] = useState(initialConversation ? initialConversation.messages : []);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  if (!initialConversation) {
    return (
      <View className="flex-1 bg-[#F8FAFC] justify-center items-center">
        <Text className="text-slate-500">Conversation not found</Text>
      </View>
    );
  }

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      sender: 'me',
      text: message.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessagesList([...messagesList, newMessage]);
    setMessage('');

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View className="flex-1 bg-[#F8FAFC]">
        {/* Header */}
        <View className="flex-row items-center px-4 pt-12 pb-4 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Avatar uri={initialConversation.senderAvatar} name={initialConversation.senderName} size={40} online={initialConversation.online} />
          <View className="flex-1 ml-4">
            <Text className="text-sm font-semibold text-slate-900">{initialConversation.senderName}</Text>
            <Text className="text-xs text-emerald-600">{initialConversation.online ? 'Online' : 'Offline'}</Text>
          </View>
          <TouchableOpacity onPress={() => setOptionsModalVisible(true)} className="p-2">
            <MaterialIcons name="more-vert" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Messages Scroll Area */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {messagesList.map((msg) => (
            <View
              key={msg.id}
              className={`max-w-[80%] p-4 rounded-2xl mb-2 ${
                msg.sender === 'me'
                  ? 'bg-red-600 self-end rounded-br-[4px]'
                  : 'bg-white self-start rounded-bl-[4px] shadow-sm'
              }`}
            >
              <Text className={`text-sm leading-5 ${msg.sender === 'me' ? 'text-white' : 'text-slate-900'}`}>
                {msg.text}
              </Text>
              <Text className={`text-xs mt-1 text-right ${msg.sender === 'me' ? 'text-white/70' : 'text-slate-500'}`}>
                {msg.timestamp}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Input Section - Ginawa nating mas compact at idinikit sa pinakababa */}
        {/* Input Section - Medyo pinalaki at pinaluwag natin nang konti */}
        <View className="flex-row items-center px-3 py-3 bg-white border-t border-gray-100 gap-2">
          <TouchableOpacity className="p-2">
            <MaterialIcons name="attach-file" size={24} color={Colors.gray400} />
          </TouchableOpacity>
          <TextInput
            className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-base text-slate-900 max-h-[120px]"
            placeholder="Type a message..."
            placeholderTextColor={Colors.gray400}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity 
            onPress={handleSend} 
            className={`w-10 h-10 rounded-full items-center justify-center ${
              message.trim() ? 'bg-red-600' : 'bg-gray-200'
            }`}
          >
            <MaterialIcons name="send" size={20} color={message.trim() ? Colors.white : Colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* CHAT OPTIONS MODAL */}
        <ChatOptionsModal
          visible={isOptionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          onViewProfile={() => {
            setOptionsModalVisible(false);
            Alert.alert("View Profile", "Redirecting to profile...");
          }}
          onClearChat={() => {
            setOptionsModalVisible(false);
            setMessagesList([]);
          }}
          onBlockUser={() => {
            setOptionsModalVisible(false);
            Alert.alert("Block User", "User has been blocked.");
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}