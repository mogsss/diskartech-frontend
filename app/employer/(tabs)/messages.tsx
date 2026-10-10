import api, { STORAGE_URL } from '@/api/axios';
import Avatar from '@/components/ui/Avatar';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import DrawerMenuButton from '@/components/ui/DrawerMenuButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';
import { db } from '@/utils/firebase';
import { collection, onSnapshot, query, where, or } from 'firebase/firestore';
import {
  CHATS_COLLECTION,
  formatChatListTime,
  getLoggedInUserId,
  getOtherParticipant,
  getTimestampMs,
  isChatUnreadForUser,
  normalizeChatFields,
} from '@/utils/chat';

interface LiveUserProfile {
  isVerified: boolean;
  name?: string;
  avatar?: string | null;
  role?: string;
}

export default function EmployerMessagesScreen() {
  const { colors } = useDarkMode();
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
      isVerified?: boolean;
    }[]
  >([]);
  const [currentOwnerId, setCurrentOwnerId] = useState<string | null>(null);
  const [liveUsersMap, setLiveUsersMap] = useState<Record<string, LiveUserProfile>>({});
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    role?: string;
    avatarUri?: string | null;
    avatarInitials?: string;
    isVerified?: boolean;
    rejectionReason?: string | null;
  }>({
    name: 'Employer',
    role: 'business',
  });

  useEffect(() => {
    getLoggedInUserId().then((id) => {
      if (id !== 'unknown') setCurrentOwnerId(id);
    });

    AsyncStorage.getItem('userProfile').then((stored) => {
      if (stored) {
        try {
          const prof = JSON.parse(stored);
          const isH = prof.role === 'household' || !!prof.household_name;
          const resolvedName = isH
            ? (prof.household_name || prof.name || 'Household Employer')
            : (prof.employer_name || prof.business_name || prof.name || 'Business Employer');
          const nameParts = resolvedName.trim().split(' ');
          const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : (isH ? 'VF' : 'MD');
          const avatarUrl = prof.avatar
            ? (prof.avatar.startsWith('http') ? prof.avatar : `${STORAGE_URL}${prof.avatar}`)
            : null;
          setUserProfile({
            name: resolvedName,
            role: isH ? 'household' : 'business',
            avatarUri: avatarUrl,
            avatarInitials: initials,
            isVerified: prof.isVerified === 1 || prof.isVerified === true,
            rejectionReason: prof.rejection_reason || null,
          });
        } catch (e) {}
      }
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

        const firestoreConvs = matchedDocs
          .filter((docSnap) => {
            const raw = docSnap.data();
            const chat = normalizeChatFields(raw, docSnap.id);
            const clearedVal =
              (raw as any)[`cleared_at_for_${currentOwnerId}`] ??
              (raw as any).cleared_at?.[currentOwnerId];
            const clearedMs = getTimestampMs(clearedVal);
            const lastMsgMs = getTimestampMs(chat.last_message_at);
            const isCleared = clearedMs > 0 && (lastMsgMs === 0 || lastMsgMs <= clearedMs);

            // Kapag na-clear ang chat o walang mensahe, huwag ipakita sa listahan
            if (isCleared || !chat.last_message?.trim()) {
              return false;
            }
            return true;
          })
          .map((docSnap) => {
            const raw = docSnap.data();
            const chat = normalizeChatFields(raw, docSnap.id);
            const other = getOtherParticipant(chat, currentOwnerId);
            const isUnread = isChatUnreadForUser(chat, currentOwnerId, 'employer');

            const isVerifiedDoc =
              String(raw.student_user_id) === String(other.id)
                ? Boolean(raw.student_is_verified)
                : Boolean(raw.owner_is_verified);

            return {
              id: docSnap.id,
              otherUserId: other.id,
              senderName: other.name,
              senderAvatar: other.avatar,
              lastMessage: chat.last_message,
              timestamp: formatChatListTime(chat.last_message_at),
              unread: isUnread,
              lastMessageAt: chat.last_message_at,
              isVerified: isVerifiedDoc,
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

        // Kumuha ng live verification statuses para sa mga kachat mula sa backend
        const userIdsToFetch = Array.from(
          new Set(
            uniqueConvs
              .map((c) => String(c.otherUserId).trim())
              .filter((id) => id && id !== 'unknown')
          )
        );

        if (userIdsToFetch.length > 0) {
          api
            .get(`/users/verification-statuses?ids=${userIdsToFetch.join(',')}`)
            .then((res) => {
              if (res.data?.statuses) {
                setLiveUsersMap((prev) => ({ ...prev, ...res.data.statuses }));
              }
            })
            .catch(() => {
              // fallback gracefully
            });
        }
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
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar backgroundColor={colors.surface} />
      <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }} className="w-full max-w-2xl self-center px-6 pt-2 pb-3 border-b flex-row items-center justify-between">
        <DrawerMenuButton onPress={() => setDrawerVisible(true)} />

        <Text style={{ color: colors.text }} className="text-xl font-bold tracking-tight flex-1 text-center pr-12">
          Messages
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {conversationsList.length === 0 ? (
          <View className="flex-1 justify-center items-center mt-32">
            <MaterialIcons name="chat-bubble-outline" size={56} color={colors.textSecondary} />
            <Text style={{ color: colors.text }} className="mt-4 text-base font-medium">No messages yet</Text>
            <Text style={{ color: colors.textSecondary }} className="text-xs text-center mt-1 px-8">
              Applicants and students who reach out will appear here.
            </Text>
          </View>
        ) : (
          conversationsList.map((conv) => {
            const live = liveUsersMap[conv.otherUserId];
            const displayName = live?.name || conv.senderName;
            const displayAvatar = live?.avatar || conv.senderAvatar;
            const isVerified = Boolean(live ? live.isVerified : conv.isVerified);

            return (
              <TouchableOpacity
                key={conv.id}
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className={`flex-row rounded-2xl p-4 mb-3 shadow-sm items-center border ${
                  conv.unread ? 'border-l-[3px] border-l-red-600' : ''
                }`}
                onPress={() => handleConversationPress(conv.id)}
                activeOpacity={0.7}
              >
                <View className="mr-4">
                  <Avatar uri={displayAvatar} name={displayName} size={52} online />
                </View>
                <View className="flex-1 justify-center">
                  <View className="flex-row justify-between items-center mb-1">
                    <View className="flex-1 mr-2 flex-row items-center gap-1.5">
                      <Text
                        style={{ color: colors.text }}
                        className={`text-sm ${
                          conv.unread ? 'font-bold' : 'font-semibold'
                        }`}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      {isVerified && (
                        <MaterialIcons name="verified" size={16} color="#10B981" />
                      )}
                    </View>
                    <Text style={{ color: colors.textSecondary }} className="text-xs">{conv.timestamp}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text
                      style={{ color: conv.unread ? colors.text : colors.textSecondary }}
                      className={`text-sm flex-1 ${
                        conv.unread ? 'font-bold' : ''
                      }`}
                      numberOfLines={1}
                    >
                      {conv.lastMessage}
                    </Text>
                    {conv.unread && <View className="w-2 h-2 rounded-full bg-red-600" />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Slide-out Burger Menu / Side Drawer */}
      <SideDrawerMenu
        visible={isDrawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={{
          name: userProfile.name,
          role: userProfile.role || 'business',
          avatarUri: userProfile.avatarUri,
          avatarInitials: userProfile.avatarInitials,
          isVerified: userProfile.isVerified,
          rejectionReason: userProfile.rejectionReason,
        }}
      />
    </View>
  );
}
