import Avatar from '@/components/ui/Avatar';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { db } from '@/utils/firebase';
import { collection, onSnapshot, query, where, or } from 'firebase/firestore';
import {
  CHATS_COLLECTION,
  formatChatListTime,
  getLoggedInUserId,
  getOtherParticipant,
  isChatUnreadForUser,
  normalizeChatFields,
} from '@/utils/chat';

export default function EmployerMessagesScreen() {
  const [conversationsList, setConversationsList] = useState<
    {
      id: string;
      otherUserId: string;
      senderName: string;
      senderAvatar: string;
      lastMessage: string;
      timestamp: string;
      unread: boolean;
      lastMessageAt: any;
    }[]
  >([]);
  const [currentOwnerId, setCurrentOwnerId] = useState<string | null>(null);

  useEffect(() => {
    getLoggedInUserId().then((id) => {
      if (id !== 'unknown') setCurrentOwnerId(id);
    });
  }, []);

  useEffect(() => {
    if (!currentOwnerId) return;

    const unsubscribe = onSnapshot(
      collection(db, CHATS_COLLECTION),
      (snapshot) => {
        const myId = String(currentOwnerId);
        const matchedDocs = snapshot.docs.filter((docSnap) => {
          const raw = docSnap.data();
          const sId = String(raw.sender_id ?? raw.student_user_id ?? raw.studentId ?? '');
          const rId = String(raw.receiver_id ?? raw.owner_user_id ?? raw.ownerId ?? '');
          const pIds: string[] = Array.isArray(raw.participant_ids)
            ? raw.participant_ids.map(String)
            : [];
          return pIds.includes(myId) || sId === myId || rId === myId;
        });

        const firestoreConvs = matchedDocs.map((docSnap) => {
          const chat = normalizeChatFields(docSnap.data(), docSnap.id);
          const other = getOtherParticipant(chat, currentOwnerId);
          const isUnread = isChatUnreadForUser(chat, currentOwnerId, 'employer');

          return {
            id: docSnap.id,
            otherUserId: other.id,
            senderName: other.name,
            senderAvatar: other.avatar,
            lastMessage: chat.last_message || 'Tap to chat',
            timestamp: formatChatListTime(chat.last_message_at),
            unread: isUnread,
            lastMessageAt: chat.last_message_at,
          };
        });

        // Sort descending: most recent message at the top
        firestoreConvs.sort((a, b) => {
          const timeA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
          const timeB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
          return timeB - timeA;
        });

        // 1-on-1 thread deduplication: iisa lang ang card bawat kausap!
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();

        const uniqueConvs = firestoreConvs.filter((conv) => {
          const id = conv.otherUserId ? String(conv.otherUserId).trim() : '';
          const name = conv.senderName ? conv.senderName.trim().toLowerCase() : '';

          const hasSeenId = Boolean(id && id !== 'unknown' && seenIds.has(id));
          const hasSeenName = Boolean(name && seenNames.has(name));

          if (hasSeenId || hasSeenName) {
            return false;
          }

          if (id && id !== 'unknown') seenIds.add(id);
          if (name) seenNames.add(name);
          return true;
        });

        setConversationsList(uniqueConvs);
      },
      (error) => {
        console.error('Error fetching conversations: ', error);
      }
    );

    return () => unsubscribe();
  }, [currentOwnerId]);

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat?id=${conversationId}` as any);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900 text-center">Messages</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {conversationsList.length === 0 ? (
          <View className="flex-1 justify-center items-center mt-32">
            <MaterialIcons name="chat-bubble-outline" size={56} color={Colors.gray400} />
            <Text className="text-slate-500 mt-4 text-base font-medium">No messages.</Text>
            <Text className="text-slate-400 text-xs text-center mt-1 px-8">
              Lilitaw dito ang mga mag-a-apply o makikipag-chat sa iyo.
            </Text>
          </View>
        ) : (
          conversationsList.map((conv) => (
            <TouchableOpacity
              key={conv.id}
              className={`flex-row bg-white rounded-2xl p-4 mb-3 shadow-sm items-center ${
                conv.unread ? 'border-l-[3px] border-l-red-600' : ''
              }`}
              onPress={() => handleConversationPress(conv.id)}
              activeOpacity={0.7}
            >
              <View className="mr-4">
                <Avatar uri={conv.senderAvatar} name={conv.senderName} size={52} online />
              </View>
              <View className="flex-1 justify-center">
                <View className="flex-row justify-between items-center mb-1">
                  <View className="flex-1 mr-2 flex-row items-center gap-1.5 flex-wrap">
                    <Text
                      className={`text-sm text-slate-900 ${
                        conv.unread ? 'font-bold text-slate-900' : 'font-semibold'
                      }`}
                      numberOfLines={1}
                    >
                      {conv.senderName}
                    </Text>
                  </View>
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
        )}
      </ScrollView>
    </View>
  );
}
