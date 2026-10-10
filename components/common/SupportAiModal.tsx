import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import api from '@/api/axios';
import { useDarkMode } from '@/hooks/useDarkMode';
import Markdown from 'react-native-markdown-display';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  time: string;
}

interface SupportAiModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenFileReport?: () => void;
}

const QUICK_SUGGESTIONS = [
  'Paano mag-apply sa student jobs?',
  'Paano magpa-verify ng account?',
  'Paano gumagana ang ratings & reviews?',
  'Ano ang gagawin kapag may suspicious hirer?',
];

export default function SupportAiModal({
  visible,
  onClose,
}: SupportAiModalProps) {
  const { colors, isDark } = useDarkMode();
  const markdownStyles = {
    body: { color: colors.text, fontFamily: 'Poppins-Regular', fontSize: 12, lineHeight: 18 },
    strong: { fontFamily: 'Poppins-Bold', fontWeight: '700' as const },
    heading1: { fontFamily: 'Poppins-Bold', fontSize: 16, lineHeight: 23, marginBottom: 6 },
    heading2: { fontFamily: 'Poppins-Bold', fontSize: 15, lineHeight: 22, marginBottom: 6 },
    heading3: { fontFamily: 'Poppins-Bold', fontSize: 14, lineHeight: 21, marginBottom: 6 },
    heading4: { fontFamily: 'Poppins-Bold', fontSize: 13, lineHeight: 20, marginBottom: 6 },
    heading5: { fontFamily: 'Poppins-Bold', fontSize: 12, lineHeight: 18, marginBottom: 6 },
    heading6: { fontFamily: 'Poppins-Bold', fontSize: 12, lineHeight: 18, marginBottom: 6 },
    paragraph: { marginTop: 0, marginBottom: 6 },
    bullet_list: { marginBottom: 6 },
    ordered_list: { marginBottom: 6 },
    bullet_list_icon: { marginLeft: 0, marginRight: 6 },
    ordered_list_icon: { marginLeft: 0, marginRight: 6 },
    link: { color: colors.accent },
    blocklink: { borderColor: colors.border },
    blockquote: { backgroundColor: colors.background, borderColor: colors.border, marginLeft: 0, paddingHorizontal: 8 },
    code_inline: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, padding: 2 },
    code_block: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, padding: 8 },
    fence: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, padding: 8 },
    table: { borderColor: colors.border },
    tr: { borderColor: colors.border },
    hr: { backgroundColor: colors.border, marginVertical: 6 },
  };
  const getInitialMessage = (): Message => ({
    id: 'welcome-1',
    role: 'model',
    text: 'Kumusta! Ako si DARA, ang iyong 24/7 customer support assistant sa DiskarTech. Handa akong sumagot sa anumang tanong tungkol sa paghahanap ng trabaho, requirements, account verification, ratings & reviews, o safety policies ng DiskarTech.\n\nPaano kita matutulungan ngayon?',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<Message[]>([getInitialMessage()]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const screenHeight = Dimensions.get('window').height;

  // Preserve the original 90% tall height by default, and adapt seamlessly when keyboard opens
  const cardHeight =
    keyboardHeight > 0
      ? Math.max(280, screenHeight - keyboardHeight - (Platform.OS === 'android' ? 52 : 44))
      : Math.round(screenHeight * 0.90);

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [visible, messages]);

  // Track keyboard height directly for 100% reliable positioning on Android & iOS inside Modals
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleClose = () => {
    Keyboard.dismiss();
    setKeyboardHeight(0);
    onClose();
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const historyPayload = newMessages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await api.post('/support/ai-chat', {
        message: text,
        history: historyPayload,
      });

      const replyText =
        res.data?.reply ||
        'Salamat sa mensahe! May maitutulong ba ako tungkol sa iyong DiskarTech account?';

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'model',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'model',
        text:
          err.response?.data?.reply ||
          'Paumanhin, nagkaroon ng problema sa koneksyon. Pakisubukang muli mamaya.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleResetChat = () => {
    setMessages([getInitialMessage()]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          justifyContent: 'flex-end',
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + (Platform.OS === 'android' ? 20 : 0) : 0,
        }}
      >
        {/* Absolute backdrop so it never divides flex height */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            if (keyboardHeight > 0) {
              Keyboard.dismiss();
            } else {
              handleClose();
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          }}
        />

        {/* Modal Card - Full 90% tall by default, dynamically adjusts above keyboard when typing */}
        <View
          style={{
            height: cardHeight,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            width: '100%',
            overflow: 'hidden',
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            elevation: 10,
            flexDirection: 'column',
          }}
        >
          {/* Modal Header */}
          <View
            style={{
              backgroundColor: '#DC2626',
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                }}
              >
                <MaterialIcons name="smart-toy" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }}>DARA</Text>
                <Text style={{ fontSize: 11, color: '#FEE2E2' }}>
                  24/7 Customer Support
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableOpacity
                onPress={handleResetChat}
                style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginRight: 4 }}
                accessibilityLabel="Restart Chat"
              >
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClose}
                style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              >
                <MaterialIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Chat Messages Body */}
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.background }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Message List with Guaranteed Margins */}
            {messages.map((item) => {
              const isUser = item.role === 'user';
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    marginBottom: 14,
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    paddingRight: isUser ? 0 : 48,
                    paddingLeft: isUser ? 48 : 0,
                  }}
                >
                  {!isUser && (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                        marginTop: 4,
                      }}
                    >
                      <MaterialIcons name="smart-toy" size={16} color={colors.accent} />
                    </View>
                  )}

                  <View
                    style={{
                      flexShrink: 1,
                      backgroundColor: isUser ? '#DC2626' : colors.surface,
                      borderColor: isUser ? 'transparent' : colors.border,
                      borderWidth: isUser ? 0 : 1,
                      borderRadius: 16,
                      borderTopRightRadius: isUser ? 2 : 16,
                      borderTopLeftRadius: !isUser ? 2 : 16,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    {!isUser && (
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#DC2626', marginBottom: 4 }}>
                        DARA
                      </Text>
                    )}
                    {isUser ? (
                      <Text style={{ fontSize: 12, lineHeight: 18, color: '#FFFFFF' }}>
                        {item.text}
                      </Text>
                    ) : (
                      <Markdown style={markdownStyles}>{item.text}</Markdown>
                    )}
                    <Text
                      style={{
                        fontSize: 9,
                        marginTop: 6,
                        alignSelf: 'flex-end',
                        color: isUser ? '#FECACA' : colors.textSecondary,
                      }}
                    >
                      {item.time}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Typing indicator */}
            {isLoading && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 14,
                  paddingRight: 48,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                    marginTop: 4,
                  }}
                >
                  <MaterialIcons name="smart-toy" size={16} color={colors.accent} />
                </View>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    borderTopLeftRadius: 0,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ActivityIndicator size="small" color="#DC2626" />
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '500' }}>
                    DARA is typing...
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Quick Question Chips at the Bottom */}
          {messages.length <= 2 && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 6, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
              >
                {QUICK_SUGGESTIONS.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSend(suggestion)}
                    disabled={isLoading}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(220, 38, 38, 0.4)' : '#FECACA',
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: isDark ? colors.accent : '#B91C1C', fontWeight: '600' }}>
                      {suggestion}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Bar */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: keyboardHeight > 0 ? 12 : (Platform.OS === 'ios' ? 24 : 16),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Magtanong kay DARA..."
                placeholderTextColor={colors.textSecondary}
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: colors.text,
                  maxHeight: 96,
                  paddingVertical: 6,
                }}
                multiline={true}
                editable={!isLoading}
                onSubmitEditing={() => handleSend()}
              />
              <TouchableOpacity
                onPress={() => handleSend()}
                disabled={!inputText.trim() || isLoading}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                  backgroundColor: inputText.trim() && !isLoading ? '#DC2626' : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1'),
                }}
              >
                <MaterialIcons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
