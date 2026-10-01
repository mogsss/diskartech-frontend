import Avatar from '@/components/ui/Avatar';
import ChatOptionsModal from '@/components/ui/modals/ChatOptionsModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '@/utils/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import {
  CHATS_COLLECTION,
  formatChatListTime,
  getLoggedInUserId,
  getMessageCreatedAt,
  getMessageSenderId,
  getOtherParticipant,
  markChatAsRead,
  normalizeChatFields,
  sendChatMessage,
} from '@/utils/chat';
import { setActiveChatScreen } from '@/utils/notifications';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const conversationId = Array.isArray(id) ? id[0] : (id || '');

  const [currentUserId, setCurrentUserId] = useState<string>('unknown');
  const [chatUser, setChatUser] = useState({
    id: '',
    name: 'Loading...',
    avatar: '',
    online: true,
  });

  const [message, setMessage] = useState('');
  const [messagesList, setMessagesList] = useState<
    { id: string; sender: 'me' | 'other'; text: string; timestamp: string }[]
  >([]);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!conversationId) return;
    setActiveChatScreen(conversationId);
    return () => {
      setActiveChatScreen(null);
    };
  }, [conversationId]);

  useEffect(() => {
    getLoggedInUserId().then((uid) => {
      if (uid && uid !== 'unknown') setCurrentUserId(uid);
    });
  }, []);

  // 1. Real-time listener para sa kabilang party (Pangalan at Avatar)
  useEffect(() => {
    if (!conversationId || currentUserId === 'unknown') return;

    const chatDocRef = doc(db, CHATS_COLLECTION, conversationId);
    const unsubscribe = onSnapshot(
      chatDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const chat = normalizeChatFields(snap.data(), snap.id);
        const other = getOtherParticipant(chat, currentUserId);

        setChatUser({
          id: other.id,
          name: other.name,
          avatar: other.avatar,
          online: true,
        });

        markChatAsRead(conversationId, currentUserId);
      },
      (error) => {
        console.error('Error listening to chat details:', error);
      }
    );

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  // 2. Real-time listener para sa Messages subcollection
  useEffect(() => {
    if (!conversationId || currentUserId === 'unknown') return;

    const q = query(
      collection(db, CHATS_COLLECTION, conversationId, 'messages'),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const created = getMessageCreatedAt(data);
          const timeString = created
            ? created.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : formatChatListTime(data.timestamp);

          const senderId = getMessageSenderId(data);
          const isMe = String(senderId) === String(currentUserId);

          return {
            id: docSnap.id,
            sender: isMe ? ('me' as const) : ('other' as const),
            text: String(data.text ?? ''),
            timestamp: timeString,
          };
        });

        setMessagesList(fetched);
      },
      (error) => {
        console.error('Error listening to messages:', error);
      }
    );

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  const handleSend = async () => {
    const textToSend = message.trim();
    if (!textToSend || !conversationId) return;

    setMessage('');

    try {
      await sendChatMessage({
        chatId: conversationId,
        senderId: currentUserId,
        receiverId: chatUser.id,
        receiverName: chatUser.name,
        receiverAvatar: chatUser.avatar,
        text: textToSend,
      });

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message: ', error);
      Alert.alert('Error', 'Failed to send message.');
    }
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
          <Avatar uri={chatUser.avatar} name={chatUser.name} size={40} online={chatUser.online} />
          <View className="flex-1 ml-4">
            <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
              {chatUser.name}
            </Text>
            <Text className="text-xs text-emerald-600">{chatUser.online ? 'Online' : 'Offline'}</Text>
          </View>
          <TouchableOpacity onPress={() => setOptionsModalVisible(true)} className="p-2">
            <MaterialIcons name="more-vert" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Messages List */}
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

        {/* Input Bar */}
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

        {/* Options Modal */}
        <ChatOptionsModal
          visible={isOptionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          onViewProfile={() => {
            setOptionsModalVisible(false);
            Alert.alert('View Profile', 'Redirecting to profile...');
          }}
          onClearChat={() => {
            setOptionsModalVisible(false);
            setMessagesList([]);
          }}
          onBlockUser={() => {
            setOptionsModalVisible(false);
            Alert.alert('Block User', 'User has been blocked.');
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
