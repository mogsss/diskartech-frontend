import Avatar from '@/components/ui/Avatar';
import ChatOptionsModal from '@/components/ui/modals/ChatOptionsModal';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import UserProfileModal, { UserProfileData } from '@/components/ui/modals/UserProfileModal';
import SafeStatusBar from '@/components/ui/SafeStatusBar';
import api from '@/api/axios';
import { resolveMediaUrl } from '@/utils/media';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  clearChatConversation,
  formatChatListTime,
  getLoggedInUserId,
  getLoggedInRole,
  getMessageCreatedAt,
  getMessageSenderId,
  getOtherParticipant,
  getTimestampMs,
  markChatAsRead,
  normalizeChatFields,
  sendChatMessage,
} from '@/utils/chat';
import { setActiveChatScreen } from '@/utils/notifications';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useToast } from '@/hooks/useToast';
import ChatAttachmentBubble from '@/components/chat/ChatAttachmentBubble';
import { useChatAttachments } from '@/hooks/useChatAttachments';
import { ChatAttachmentUploadError, formatAttachmentSize, normalizeChatAttachment, sanitizeChatText } from '@/utils/chatAttachments';
import type { ChatAttachment } from '@/types/chat';
import { randomUUID } from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatScreen() {
  const { colors, isDark } = useDarkMode();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const conversationId = Array.isArray(id) ? id[0] : (id || '');

  const [currentUserId, setCurrentUserId] = useState<string>('unknown');
  const [chatUser, setChatUser] = useState({
    id: '',
    name: 'Loading...',
    avatar: '',
    online: true,
    isVerified: false,
  });

  const [message, setMessage] = useState('');
  const [messagesList, setMessagesList] = useState<
    { id: string; sender: 'me' | 'other'; text: string; timestamp: string; attachment: ChatAttachment | null }[]
  >([]);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [profileModalLoading, setProfileModalLoading] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<UserProfileData | null>(null);
  const [clearedAtMs, setClearedAtMs] = useState<number>(0);

  const handleOpenUserProfile = () => {
    if (!chatUser.id) {
      setNotification({
        visible: true,
        title: 'User Not Found',
        message: 'Unable to view profile because user information is still loading.',
        iconName: 'info',
        iconColor: '#2563EB',
        iconBgColor: 'bg-blue-50',
        primaryButtonText: 'OK',
        onPrimaryPress: closeNotification,
      });
      return;
    }
    setViewedProfile({
      id: chatUser.id,
      name: chatUser.name,
      avatar: chatUser.avatar,
      isVerified: chatUser.isVerified,
    });
    setProfileModalLoading(true);
    setProfileModalVisible(true);
    api.get(`/user/${chatUser.id}/public-profile`)
      .then((res) => {
        if (res.data?.status === 'success' && res.data?.user) {
          setViewedProfile(res.data.user);
        }
      })
      .catch((err) => {
        console.warn('Failed to load profile details:', err);
      })
      .finally(() => {
        setProfileModalLoading(false);
      });
  };

  const [notification, setNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof MaterialIcons.glyphMap;
    iconColor?: string;
    iconBgColor?: string;
    primaryButtonText?: string;
    onPrimaryPress: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
    buttonLayout?: 'stacked' | 'row';
  }>({
    visible: false,
    title: '',
    message: '',
    onPrimaryPress: () => {},
  });

  const closeNotification = () => setNotification((prev) => ({ ...prev, visible: false }));
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const messageId = useRef<string | null>(null);
  const attachments = useChatAttachments(conversationId, (errorMessage) => setNotification({ visible: true, title: 'Attachment', message: errorMessage, iconName: 'error-outline', onPrimaryPress: closeNotification }));
  const canSend = (!!message.trim() || !!attachments.draft) && !sending && !attachments.selecting && !!chatUser.id && currentUserId !== 'unknown';

  const scrollViewRef = useRef<ScrollView>(null);
  const isInitialLoad = useRef(true);

  const scrollToBottom = (animated = false) => {
    scrollViewRef.current?.scrollToEnd({ animated });
  };

  useEffect(() => {
    if (!conversationId) return;
    isInitialLoad.current = true;
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
        const data = snap.data();
        const chat = normalizeChatFields(data, snap.id);
        const other = getOtherParticipant(chat, currentUserId);

        const rawData = (data || {}) as Record<string, unknown>;
        const clearedVal =
          rawData[`cleared_at_for_${currentUserId}`] ??
          (rawData.cleared_at as Record<string, unknown> | undefined)?.[currentUserId];
        const cMs = getTimestampMs(clearedVal);
        setClearedAtMs(cMs);

        const isVerifiedDoc =
          String(data.student_user_id) === String(other.id)
            ? Boolean(data.student_is_verified)
            : Boolean(data.owner_is_verified);

        setChatUser((prev) => ({
          ...prev,
          id: other.id,
          name: other.name,
          avatar: other.avatar,
          online: true,
          isVerified: isVerifiedDoc || prev.isVerified,
        }));

        markChatAsRead(conversationId, currentUserId);
      },
      (error) => {
        console.error('Error listening to chat details:', error);
      }
    );

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  // Kumuha ng live verification status para sa kachat mula sa backend
  useEffect(() => {
    if (!chatUser.id || chatUser.id === 'unknown') return;

    let isMounted = true;
    api
      .get(`/user/${chatUser.id}/public-profile`)
      .then((res) => {
        if (isMounted && res.data?.status === 'success') {
          const user = res.data.user;
          const verified = Boolean(user?.isVerified);
          const liveName = user?.name;
          const liveAvatar = user?.avatar;
          const avatarUrl = resolveMediaUrl(liveAvatar) ?? undefined;

          setChatUser((prev) => ({
            ...prev,
            isVerified: verified,
            name: liveName || prev.name,
            avatar: avatarUrl || prev.avatar,
          }));
        }
      })
      .catch(() => {
        // Fallback: panatilihin ang existing status
      });

    return () => {
      isMounted = false;
    };
  }, [chatUser.id]);

  // 2. Real-time listener para sa Messages subcollection (Clear for me filtering)
  useEffect(() => {
    if (!conversationId || currentUserId === 'unknown') return;

    const q = query(
      collection(db, CHATS_COLLECTION, conversationId, 'messages'),
      orderBy('created_at', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs
          .filter((docSnap) => {
            if (!clearedAtMs) return true;
            const data = docSnap.data() as Record<string, unknown>;
            const msgMs = getTimestampMs(data.created_at || data.createdAt || data.timestamp);
            if (msgMs === 0 && !data.created_at) return true;
            return msgMs > clearedAtMs;
          })
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const created = getMessageCreatedAt(data);
            const timeString = created
              ? created.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : (data.timestamp ? formatChatListTime(data.timestamp) : 'Just now');

            const senderId = getMessageSenderId(data);
            const isMe = String(senderId) === String(currentUserId);

            return {
              id: docSnap.id,
              sender: isMe ? ('me' as const) : ('other' as const),
              text: String(data.text ?? ''),
              attachment: normalizeChatAttachment(data.attachment),
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
  }, [conversationId, currentUserId, clearedAtMs]);

  // Always scroll to latest message when messages load or change
  useEffect(() => {
    if (messagesList.length > 0) {
      if (isInitialLoad.current) {
        // Immediate scroll to bottom
        scrollToBottom(false);

        // Sequence of ticks to catch layout finish, keyboard, and navigation transition
        const t1 = setTimeout(() => scrollToBottom(false), 50);
        const t2 = setTimeout(() => scrollToBottom(false), 150);
        const t3 = setTimeout(() => scrollToBottom(false), 300);
        const t4 = setTimeout(() => {
          scrollToBottom(false);
          isInitialLoad.current = false;
        }, 500);

        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
          clearTimeout(t4);
        };
      } else {
        // Subsequent new messages: smooth scroll down
        scrollToBottom(true);
        const t = setTimeout(() => scrollToBottom(true), 80);
        return () => clearTimeout(t);
      }
    }
  }, [messagesList]);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Auto-scroll at pag-track ng eksaktong keyboard height (gaya sa DARA AI Chat)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => scrollToBottom(true), 80);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = async () => {
    const textToSend = sanitizeChatText(message).trim();
    if (sendingRef.current || !canSend || !conversationId) return;
    sendingRef.current = true; setSending(true); setAttachmentMenu(false);
    messageId.current ||= randomUUID();

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token || await getLoggedInUserId() !== currentUserId) throw new Error('Your session changed. Open this conversation again before sending.');
      const attachment = await attachments.prepare();
      if (await AsyncStorage.getItem('userToken') !== token || await getLoggedInUserId() !== currentUserId) throw new Error('Your session changed. Open this conversation again before sending.');
      await sendChatMessage({
        chatId: conversationId,
        senderId: currentUserId,
        receiverId: chatUser.id,
        receiverName: chatUser.name,
        receiverAvatar: chatUser.avatar,
        text: textToSend,
        attachment,
        messageId: messageId.current,
      });
      setMessage(''); attachments.clear(); messageId.current = null;

      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    } catch (error) {
      setNotification({
        visible: true,
        title: 'Error',
        message: error instanceof ChatAttachmentUploadError || (error instanceof Error && /attachment|uploads|conversation/i.test(error.message)) ? error.message : 'Failed to send message. Your draft is saved here. Please try again.',
        iconName: 'error-outline',
        iconColor: '#DC2626',
        iconBgColor: 'bg-red-50',
        primaryButtonText: 'OK',
        onPrimaryPress: closeNotification,
      });
    } finally { sendingRef.current = false; setSending(false); }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        paddingBottom: keyboardHeight > 0 ? keyboardHeight + (Platform.OS === 'android' ? 14 : 4) : 0,
      }}
    >
      <SafeStatusBar backgroundColor={colors.surface} style={isDark ? 'light' : 'dark'} withSpacer={false} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingTop: insets.top + 8,
              paddingBottom: 14,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={() => router.back()} disabled={sending} accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: sending }} style={{ marginRight: 16, opacity: sending ? 0.5 : 1 }}>
              <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenUserProfile}
              activeOpacity={0.7}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            >
              <Avatar uri={chatUser.avatar} name={chatUser.name} size={40} online={chatUser.online} />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 }} numberOfLines={1}>
                    {chatUser.name}
                  </Text>
                  {chatUser.isVerified && (
                    <MaterialIcons name="verified" size={17} color="#10B981" />
                  )}
                </View>
                <Text style={{ fontSize: 12, color: chatUser.online ? '#10B981' : colors.textSecondary }}>
                  {chatUser.online ? 'Online' : 'Offline'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOptionsModalVisible(true)} style={{ padding: 8 }}>
              <MaterialIcons name="more-vert" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

        {/* Messages List */}
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onLayout={() => {
            scrollToBottom(false);
          }}
          onContentSizeChange={(_w, _h) => {
            scrollToBottom(!isInitialLoad.current);
          }}
        >
          {messagesList.map((msg) => {
            const isPhoto = msg.attachment?.kind === 'image';
            const photoOnly = isPhoto && !msg.text;
            return (
            <View
              key={msg.id}
              style={{
                maxWidth: '80%',
                padding: isPhoto ? 0 : 16,
                borderRadius: 16,
                overflow: isPhoto ? 'hidden' : 'visible',
                marginBottom: 10,
                alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                borderBottomRightRadius: msg.sender === 'me' ? 4 : 16,
                borderBottomLeftRadius: msg.sender === 'me' ? 16 : 4,
                backgroundColor: msg.sender === 'me' ? '#DC2626' : colors.surface,
                borderWidth: msg.sender === 'me' ? 0 : 1,
                borderColor: msg.sender === 'me' ? 'transparent' : colors.border,
              }}
            >
              {msg.attachment && <ChatAttachmentBubble chatId={conversationId} attachment={msg.attachment} mine={msg.sender === 'me'} />}
              {!!msg.text && <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  paddingHorizontal: isPhoto ? 12 : 0,
                  paddingTop: isPhoto ? 10 : 0,
                  color: msg.sender === 'me' ? '#FFFFFF' : colors.text,
                }}
              >
                {msg.text}
              </Text>}
              <Text
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  textAlign: 'right',
                  color: photoOnly ? '#FFFFFF' : msg.sender === 'me' ? 'rgba(255, 255, 255, 0.75)' : colors.textSecondary,
                  ...(photoOnly ? {
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    borderRadius: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  } : isPhoto ? { paddingHorizontal: 12, paddingBottom: 10 } : {}),
                }}
              >
                {msg.timestamp}
              </Text>
            </View>
            );
          })}
        </ScrollView>

        {attachmentMenu && (
          <View style={{ flexDirection: 'row', gap: 12, padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            {(['photo', 'file'] as const).map(kind => (
              <TouchableOpacity key={kind} disabled={sending || attachments.selecting} onPress={() => { setAttachmentMenu(false); Keyboard.dismiss(); void attachments.pick(kind); messageId.current = null; }} accessibilityRole="button" accessibilityLabel={kind === 'photo' ? 'Choose photo' : 'Choose file'} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
                <MaterialIcons name={kind === 'photo' ? 'photo-library' : 'description'} size={22} color={colors.accent} /><Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{kind === 'photo' ? 'Photo' : 'File'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {attachments.draft && (
          <View style={{ padding: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {attachments.draft.kind === 'image' ? <Image source={{ uri: attachments.draft.uri }} style={{ width: 56, height: 56, borderRadius: 10 }} resizeMode="cover" /> : <MaterialIcons name="description" size={32} color={colors.accent} />}
              <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{attachments.draft.filename}</Text><Text style={{ fontSize: 12, color: colors.textSecondary }}>{sending ? attachments.uploading ? `Uploading ${attachments.progress}%` : 'Sending message...' : formatAttachmentSize(attachments.draft.size)}</Text></View>
              <TouchableOpacity disabled={sending || attachments.selecting} onPress={() => { attachments.clear(); messageId.current = null; }} accessibilityRole="button" accessibilityLabel="Remove attachment" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.4 : 1 }}><MaterialIcons name="close" size={22} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            {sending && <View style={{ height: 4, borderRadius: 2, marginTop: 10, backgroundColor: colors.border }}><View style={{ height: 4, borderRadius: 2, width: `${attachments.progress}%`, backgroundColor: colors.primary }} /></View>}
          </View>
        )}

        {/* Input Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12),
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 8,
          }}
        >
          <TouchableOpacity onPress={() => { Keyboard.dismiss(); setAttachmentMenu(value => !value); }} disabled={sending || attachments.selecting || !chatUser.id} accessibilityRole="button" accessibilityLabel="Add attachment" accessibilityState={{ expanded: attachmentMenu, disabled: sending || attachments.selecting || !chatUser.id }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            {attachments.selecting ? <ActivityIndicator color={colors.accent} /> : <MaterialIcons name={attachmentMenu ? 'close' : 'add'} size={26} color={colors.accent} />}
          </TouchableOpacity>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 14,
              color: colors.text,
              maxHeight: 120,
            }}
            placeholder={attachments.draft ? 'Add a message (optional)...' : 'Type a message...'}
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={text => { setMessage(sanitizeChatText(text)); messageId.current = null; }}
            maxLength={2000}
            editable={!sending}
            onFocus={() => {
              setTimeout(() => scrollToBottom(true), 150);
            }}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend || sending ? '#DC2626' : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'),
            }}
          >
            {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons
              name="send"
              size={20}
              color={canSend ? '#FFFFFF' : colors.textSecondary}
            />}
          </TouchableOpacity>
        </View>

        {/* Options Modal */}
        <ChatOptionsModal
          visible={isOptionsModalVisible}
          onClose={() => setOptionsModalVisible(false)}
          onViewProfile={() => {
            setOptionsModalVisible(false);
            handleOpenUserProfile();
          }}
          onClearChat={() => {
            setOptionsModalVisible(false);
            setNotification({
              visible: true,
              title: 'Delete Conversation',
              message: 'Are you sure you want to delete for you this Conversation?',
              iconName: 'delete-outline',
              iconColor: '#DC2626',
              iconBgColor: 'bg-red-50',
              primaryButtonText: 'Delete',
              secondaryButtonText: 'Cancel',
              buttonLayout: 'row',
              onSecondaryPress: closeNotification,
              onPrimaryPress: async () => {
                closeNotification();
                try {
                  await clearChatConversation(conversationId, currentUserId);
                  setMessagesList([]);
                  showToast({
                    type: 'success',
                    title: 'Chat cleared',
                    message: 'The messages have been deleted from your account.',
                  });
                  const role = await getLoggedInRole();
                  if (role === 'student') router.dismissTo('/students/(tabs)/messages');
                  else if (role === 'employer' || role === 'household') router.dismissTo('/employer/(tabs)/messages');
                  else router.back();
                } catch (err) {
                  console.error('Error clearing chat:', err);
                  showToast({
                    type: 'error',
                    title: 'Could not clear chat',
                    message: 'Could not clear the chat. Please try again.',
                  });
                }
              },
            });
          }}
          onBlockUser={() => {
            setOptionsModalVisible(false);
            setNotification({
              visible: true,
              title: 'Block User',
              message: `Are you sure you want to block ${chatUser.name}?`,
              iconName: 'block',
              iconColor: '#DC2626',
              iconBgColor: 'bg-red-50',
              primaryButtonText: 'Yes, Block',
              secondaryButtonText: 'Cancel',
              onSecondaryPress: closeNotification,
              onPrimaryPress: () => {
                closeNotification();
                setNotification({
                  visible: true,
                  title: 'User Blocked',
                  message: `${chatUser.name} has been blocked.`,
                  iconName: 'check-circle',
                  iconColor: '#16A34A',
                  iconBgColor: 'bg-emerald-50',
                  primaryButtonText: 'Done',
                  onPrimaryPress: closeNotification,
                });
              },
            });
          }}
        />

        {/* User Profile Modal */}
        <UserProfileModal
          visible={isProfileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          loading={profileModalLoading}
          user={viewedProfile}
        />

        {/* Notification Modal */}
        <NotificationModal
          visible={notification.visible}
          title={notification.title}
          message={notification.message}
          iconName={notification.iconName}
          iconColor={notification.iconColor}
          iconBgColor={notification.iconBgColor}
          primaryButtonText={notification.primaryButtonText}
          onPrimaryPress={notification.onPrimaryPress}
          secondaryButtonText={notification.secondaryButtonText}
          onSecondaryPress={notification.onSecondaryPress}
          buttonLayout={notification.buttonLayout}
        />
      </View>
    </View>
  );
}
