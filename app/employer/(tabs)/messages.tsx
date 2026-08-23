import Avatar from '@/components/ui/Avatar';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { db } from '@/utils/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function EmployerMessagesScreen() {
  const [conversationsList, setConversationsList] = useState<any[]>([]);
  const [currentOwnerId, setCurrentOwnerId] = useState<string | null>(null);

  // Kunin ang ID ng nakalogin na employer o household
  useEffect(() => {
    const fetchCurrentEmployer = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentOwnerId(user.id?.toString());
        }
      } catch (e) {
        console.error('Error fetching current employer data:', e);
      }
    };
    fetchCurrentEmployer();
  }, []);

  // Real-time listener para sa mga chat na naka-filter sa ownerId
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'chats'), (snapshot) => {
      const firestoreConvs = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ownerId: data.ownerId?.toString(),
            senderName: data.senderName || 'Student Applicant',
            senderAvatar: data.senderAvatar || '', 
            online: data.online ?? true,
            lastMessage: data.lastMessage || 'Tap to chat',
            timestamp: data.timestamp || '',
            // Gumamit tayo ng fallback para masiguradong mababasa ang unreadByEmployer
            unread: data.unreadByEmployer ?? data.unread ?? false,
          };
        })
        .filter((conv) => {
          if (!currentOwnerId) return true; 
          return conv.ownerId === currentOwnerId || !conv.ownerId;
        });
      
      setConversationsList(firestoreConvs);
    }, (error) => {
      console.error("Error fetching conversations: ", error);
    });

    return () => unsubscribe();
  }, [currentOwnerId]);

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat?id=${conversationId}` as any);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900 text-center">Messages</Text>
      </View>

      {/* Conversations List */}
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
        )}
      </ScrollView>
    </View>
  );
}