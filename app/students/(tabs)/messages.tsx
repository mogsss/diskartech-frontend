import api, { STORAGE_URL } from '@/api/axios';
import Avatar from '@/components/ui/Avatar';
import StudentTabBarSpacer from '@/components/student/StudentTabBarSpacer';
import SearchBar from '@/components/ui/SearchBar';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import SideDrawerMenu from '@/components/ui/modals/SideDrawerMenu';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { db } from '@/utils/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
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

interface Conversation {
  id: string;
  otherUserId: string;
  senderName: string;
  senderAvatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  lastMessageAt: any;
  isVerified?: boolean;
}

export default function MessagesScreen() {
  const [conversationsList, setConversationsList] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Unread'>('All');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const listRef = useRef<FlatList<Conversation>>(null);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [liveUsersMap, setLiveUsersMap] = useState<Record<string, LiveUserProfile>>({});
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [studentProfile, setStudentProfile] = useState<{
    name: string;
    avatarUri?: string | null;
    avatarInitials?: string;
    isVerified?: boolean;
    rejectionReason?: string | null;
  }>({
    name: 'Student',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    getLoggedInUserId().then((id) => {
      if (!active) return;
      if (id !== 'unknown') setCurrentStudentId(id);
      else { setLoadError(true); setLoading(false); }
    }).catch(() => {
      if (active) { setLoadError(true); setLoading(false); }
    });

    AsyncStorage.getItem('userProfile').then((stored) => {
      if (stored && active) {
        try {
          const profile = JSON.parse(stored);
          const fullName = profile.student_name || 'Student';
          const nameParts = fullName.trim().split(' ');
          const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : fullName.substring(0, 2).toUpperCase();
          const avatarUrl = profile.avatar
            ? (profile.avatar.startsWith('http') ? profile.avatar : `${STORAGE_URL}${profile.avatar}`)
            : null;
          setStudentProfile({
            name: fullName,
            avatarUri: avatarUrl,
            avatarInitials: initials,
            isVerified: profile.isVerified === 1 || profile.isVerified === true,
            rejectionReason: profile.rejection_reason || null,
          });
        } catch {
          console.warn('Unable to read the stored student profile.');
        }
      }
    }).catch(() => console.warn('Unable to load the student profile.'));
    return () => { active = false; };
  }, [retryVersion]);

  useEffect(() => {
    if (!currentStudentId) return;
    let active = true;

    const unsubscribe = onSnapshot(
      collection(db, CHATS_COLLECTION),
      (snapshot) => {
        if (!active) return;
        const myId = String(currentStudentId);
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
              (raw as any)[`cleared_at_for_${currentStudentId}`] ??
              (raw as any).cleared_at?.[currentStudentId];
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
            const other = getOtherParticipant(chat, currentStudentId);
            const isUnread = isChatUnreadForUser(chat, currentStudentId, 'student');

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
          const timeA = getTimestampMs(a.lastMessageAt);
          const timeB = getTimestampMs(b.lastMessageAt);
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
        setLoading(false);
        setLoadError(false);

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
              if (active && res.data?.statuses) {
                setLiveUsersMap((prev) => ({ ...prev, ...res.data.statuses }));
              }
            })
            .catch(() => {
              // fallback gracefully
            });
        }
      },
      (error) => {
        if (!active) return;
        console.error('Error fetching conversations: ', error);
        setLoading(false);
        setLoadError(true);
      }
    );

    return () => { active = false; unsubscribe(); };
  }, [currentStudentId, retryVersion]);

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat?id=${conversationId}` as any);
  };

  const { colors, isDark } = useDarkMode();
  const accentSurface = isDark ? 'rgba(220, 38, 38, 0.12)' : '#FFF1F2';
  const accentText = isDark ? colors.accent : colors.primary;
  const subtle = isDark ? '#263449' : '#F1F5F9';
  const unreadCount = conversationsList.filter((conversation) => conversation.unread).length;
  const getDisplayProfile = (conversation: Conversation) => {
    const live = liveUsersMap[conversation.otherUserId];
    return {
      name: live?.name || conversation.senderName || 'Employer',
      avatar: live?.avatar || conversation.senderAvatar,
      verified: Boolean(live ? live.isVerified : conversation.isVerified),
    };
  };
  const filteredConversations = conversationsList.filter((conversation) => {
    if (activeFilter === 'Unread' && !conversation.unread) return false;
    const queryText = searchQuery.trim().toLowerCase();
    if (!queryText) return true;
    const { name } = getDisplayProfile(conversation);
    return name.toLowerCase().includes(queryText) || conversation.lastMessage.toLowerCase().includes(queryText);
  });
  const resetFilters = () => { setSearchQuery(''); setActiveFilter('All'); };
  const retry = () => setRetryVersion((version) => version + 1);

  const renderConversation = ({ item: conversation }: { item: Conversation }) => {
    const profile = getDisplayProfile(conversation);
    return (
      <TouchableOpacity
        onPress={() => handleConversationPress(conversation.id)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${profile.name}${conversation.unread ? ', unread message' : ''}: ${conversation.lastMessage}`}
        className="mx-6 mb-3 p-4 rounded-2xl border flex-row items-center gap-3"
        style={{ backgroundColor: conversation.unread ? (isDark ? '#252B3E' : '#FFF7F7') : colors.surface, borderColor: colors.border }}
      >
        <Avatar uri={profile.avatar} name={profile.name} size={48} />
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-1.5">
              <Text className={conversation.unread ? 'text-base font-bold shrink' : 'text-base font-semibold shrink'} style={{ color: colors.text }} numberOfLines={1}>{profile.name}</Text>
              {profile.verified && <MaterialIcons name="verified" size={15} color={isDark ? '#6EE7B7' : '#15803D'} />}
            </View>
            <Text className="text-xs leading-5" style={{ color: conversation.unread ? accentText : colors.textSecondary }}>{conversation.timestamp}</Text>
          </View>
          <View className="flex-row items-center gap-3 mt-1.5">
            <Text className={conversation.unread ? 'flex-1 text-sm leading-5 font-medium' : 'flex-1 text-sm leading-5'} style={{ color: conversation.unread ? colors.text : colors.textSecondary }} numberOfLines={2}>{conversation.lastMessage}</Text>
            {conversation.unread && <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const hasFilters = searchQuery.trim().length > 0 || activeFilter === 'Unread';
    return (
      <View className="mx-6 rounded-3xl border px-6 py-8 items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        {loading ? <ActivityIndicator size="large" color={colors.primary} /> : <View className="w-16 h-16 rounded-3xl items-center justify-center" style={{ backgroundColor: accentSurface }}><MaterialIcons name={loadError ? 'wifi-off' : searchQuery.trim() ? 'search-off' : activeFilter === 'Unread' ? 'mark-chat-read' : 'chat-bubble-outline'} size={30} color={accentText} /></View>}
        <Text className="text-lg font-bold text-center mt-4" style={{ color: colors.text }}>{loading ? 'Loading conversations' : loadError ? 'Unable to load messages' : searchQuery.trim() ? 'No matching conversations' : activeFilter === 'Unread' ? "You're all caught up" : 'No messages yet'}</Text>
        <Text className="text-sm leading-6 text-center mt-2" style={{ color: colors.textSecondary }}>{loading ? 'Your latest conversations will appear here shortly.' : loadError ? 'Check your connection and try again.' : searchQuery.trim() ? 'Try another name or keyword, or view all conversations.' : activeFilter === 'Unread' ? 'You have no unread conversations right now.' : 'Your conversations with employers and households will appear here.'}</Text>
        {!loading && (loadError || hasFilters) && <TouchableOpacity onPress={loadError ? retry : resetFilters} activeOpacity={0.8} accessibilityRole="button" className="min-h-12 flex-row items-center gap-2 px-4 rounded-xl mt-5" style={{ backgroundColor: accentSurface }}><Text className="text-sm font-semibold" style={{ color: accentText }}>{loadError ? 'Try again' : 'View all conversations'}</Text><MaterialIcons name={loadError ? 'refresh' : 'arrow-forward'} size={16} color={accentText} /></TouchableOpacity>}
      </View>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <SafeStatusBar />
      <View className="w-full max-w-2xl self-center shrink-0 px-6 pt-2 pb-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => setDrawerVisible(true)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Open navigation menu" className="w-12 h-12 items-center justify-center"><MaterialIcons name="menu" size={23} color={colors.text} /></TouchableOpacity>
          <View className="flex-1"><Text className="text-xl font-bold tracking-tight" style={{ color: colors.text }}>Messages</Text></View>
        </View>
        <View className="mt-3"><SearchBar placeholder="Search conversations" value={searchQuery} onChangeText={(value) => { setSearchQuery(value); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }} onSearch={() => Keyboard.dismiss()} /></View>
        <View className="flex-row items-center gap-2 mt-3">
          {(['All', 'Unread'] as const).map((filter) => {
            const selected = activeFilter === filter;
            const count = filter === 'All' ? conversationsList.length : unreadCount;
            return (
              <TouchableOpacity key={filter} onPress={() => { setActiveFilter(filter); listRef.current?.scrollToOffset({ offset: 0, animated: true }); }} activeOpacity={0.75} accessibilityRole="button" accessibilityState={{ selected }} className="min-h-12 flex-row items-center gap-2 rounded-xl border px-4 py-2.5" style={{ backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }}>
                <Text className="text-xs font-semibold" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{filter}</Text>
                {!loading && <View className="min-w-5 rounded-full items-center justify-center px-1.5 py-0.5" style={{ backgroundColor: selected ? 'rgba(255, 255, 255, 0.2)' : subtle }}><Text className="text-xs font-medium" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>{count}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <FlatList
        ref={listRef}
        className="flex-1"
        data={loading ? [] : filteredConversations}
        keyExtractor={(conversation) => conversation.id}
        renderItem={renderConversation}
        contentContainerClassName="w-full max-w-2xl self-center pt-2 pb-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={loadError && conversationsList.length > 0 ? <View className="px-6 pb-3"><TouchableOpacity onPress={retry} accessibilityRole="button" activeOpacity={0.75} className="flex-row items-center gap-2 rounded-xl p-3" style={{ backgroundColor: accentSurface }}><MaterialIcons name="refresh" size={18} color={accentText} /><Text className="flex-1 text-xs leading-5" style={{ color: accentText }}>Could not update messages. Tap to reconnect.</Text></TouchableOpacity></View> : null}
        ListEmptyComponent={renderEmptyState()}
        ListFooterComponent={StudentTabBarSpacer}
      />
      <SideDrawerMenu visible={isDrawerVisible} onClose={() => setDrawerVisible(false)} user={{ name: studentProfile.name, role: 'student', avatarUri: studentProfile.avatarUri, avatarInitials: studentProfile.avatarInitials, isVerified: studentProfile.isVerified, rejectionReason: studentProfile.rejectionReason }} />
    </View>
  );
}
