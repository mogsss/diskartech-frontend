import Avatar from '@/components/ui/Avatar';
import ChatOptionsModal from '@/components/modals/student/ChatOptionsModal';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/utils/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const conversationId = Array.isArray(id) ? id[0] : (id || 'mcdonalds_hr'); 
  
  const [chatUser, setChatUser] = useState({
    displayName: 'Loading...',
    displayAvatar: '',
    online: true,
  });

  const [message, setMessage] = useState('');
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('user_test');
  const [isEmployerUser, setIsEmployerUser] = useState<boolean>(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Kunin ang user profile at tukuyin kung Student o Employer/Household ba ang nakalogin
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          setCurrentUserId(profile.id?.toString() || profile.email || 'user_test');
          if (profile.role === 'employer' || profile.role === 'household' || profile.household_name || profile.employer_name) {
            setIsEmployerUser(true);
          }
        }
      } catch (e) {}
    };
    fetchUser();
  }, []);

  // Kunin ang chat details mula sa Firestore at itakda ang tamang pangalan at avatar sa header
  useEffect(() => {
    const fetchChatDetails = async () => {
      try {
        const chatDocRef = doc(db, 'chats', conversationId);
        const chatDocSnap = await getDoc(chatDocRef);
        if (chatDocSnap.exists()) {
          const data = chatDocSnap.data();
          
          // MALINAW NA LOGIC:
          // - Kung Employer ang nakalogin: Ipakita ang pangalan ng Estudyante (studentName) at avatar nito (studentAvatar)
          // - Kung Student ang nakalogin: Ipakita ang pangalan ng Employer (employerName) at avatar nito (employerAvatar)
          const nameToDisplay = isEmployerUser 
            ? (data.studentName || 'Student Applicant') 
            : (data.employerName || 'Employer / Store');

          const avatarToDisplay = isEmployerUser 
            ? (data.studentAvatar || '') 
            : (data.employerAvatar || '');

          setChatUser({
            displayName: nameToDisplay,
            displayAvatar: avatarToDisplay,
            online: data.online ?? true,
          });

          // Iwasto ang pag-clear ng unread status
          if (isEmployerUser) {
            await setDoc(chatDocRef, { unreadByEmployer: false }, { merge: true });
          } else {
            await setDoc(chatDocRef, { unreadByStudent: false }, { merge: true });
          }

        } else {
          setChatUser({
            displayName: 'Chat User',
            displayAvatar: '',
            online: true,
          });
        }
      } catch (error) {
        console.error('Error fetching chat details:', error);
      }
    };

    if (conversationId) {
      fetchChatDetails();
    }
  }, [conversationId, isEmployerUser]);

  // Real-time listener para sa mga mensahe
  useEffect(() => {
    const q = query(
      collection(db, 'chats', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        let timeString = '';
        if (data.createdAt && data.createdAt.toDate) {
          timeString = data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const isMe = data.senderId === currentUserId;

        return {
          id: docSnap.id,
          sender: isMe ? 'me' : 'other',
          text: data.text,
          timestamp: timeString,
        };
      });

      setMessagesList(fetchedMessages);
    });

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  const handleSend = async () => {
    if (!message.trim()) return;

    const textToSend = message.trim();
    setMessage('');

    try {
      const messagesRef = collection(db, 'chats', conversationId, 'messages');
      
      await addDoc(messagesRef, {
        text: textToSend,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
      });

      const convRef = doc(db, 'chats', conversationId);
      
      // I-update ang unread status batay sa kung sino ang nagpadala ng mensahe
      await setDoc(convRef, {
        lastMessage: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unreadByEmployer: isEmployerUser ? false : true,
        unreadByStudent: isEmployerUser ? true : false,
      }, { merge: true });

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message: ', error);
      Alert.alert('Error', 'Hindi naipadala ang mensahe.');
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
          <Avatar uri={chatUser.displayAvatar} name={chatUser.displayName} size={40} online={chatUser.online} />
          <View className="flex-1 ml-4">
            <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>{chatUser.displayName}</Text>
            <Text className="text-xs text-emerald-600">{chatUser.online ? 'Online' : 'Offline'}</Text>
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

        {/* Input Section */}
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