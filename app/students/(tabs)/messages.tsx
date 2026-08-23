import Avatar from '@/components/ui/Avatar';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { db } from '@/utils/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MessagesScreen() {
  const [conversationsList, setConversationsList] = useState<any[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);

  // Kunin ang ID ng nakalogin na estudyante mula sa AsyncStorage
  useEffect(() => {
    const fetchCurrentStudent = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentStudentId(user.id?.toString());
        }
      } catch (e) {
        console.error('Error fetching student data:', e);
      }
    };
    fetchCurrentStudent();
  }, []);

  // Real-time listener na naka-filter sa studentId para hindi magkahalo ang mga mensahe
  useEffect(() => {
    if (!currentStudentId) return;

    // Gumamit ng query at where clause para sa kaukulang estudyante lamang
    const q = query(
      collection(db, 'chats'),
      where('studentId', '==', currentStudentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreConvs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ownerId: data.ownerId?.toString(),
          senderName: data.employerName || data.senderName || 'Employer / Store',
          senderAvatar: data.employerAvatar || '', 
          online: data.online ?? true,
          lastMessage: data.lastMessage || 'Tap to chat',
          timestamp: data.timestamp || '',
          // Dito natin pinalitan: binabasa na nito ang unreadByStudent para sa panig ng estudyante
          unread: data.unreadByStudent || false,
        };
      });
      
      setConversationsList(firestoreConvs);
    }, (error) => {
      console.error("Error fetching conversations: ", error);
    });

    return () => unsubscribe();
  }, [currentStudentId]);

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat?id=${conversationId}` as any);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="px-6 pt-12 pb-4 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-slate-900">Messages</Text>
      </View>

      {/* Conversations List */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-20"
        showsVerticalScrollIndicator={false}
      >
        {conversationsList.length === 0 ? (
          <View className="flex-1 justify-center items-center mt-32">
            <MaterialIcons name="chat-bubble-outline" size={56} color={Colors.gray400} />
            <Text className="text-slate-500 mt-4 text-base font-medium">Wala pang mga mensahe.</Text>
            <Text className="text-slate-400 text-xs text-center mt-1 px-8">
              Lilitaw dito ang mga usapan mo sa mga employer o household.
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