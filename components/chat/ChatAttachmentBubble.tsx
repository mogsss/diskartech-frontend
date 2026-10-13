import api, { BACKEND_URL } from '@/api/axios';
import type { ChatAttachment } from '@/types/chat';
import { formatAttachmentSize, normalizeChatAttachment } from '@/utils/chatAttachments';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Media = { attachment: ChatAttachment; url: string };

export default function ChatAttachmentBubble({ chatId, attachment, mine }: { chatId: string; attachment: ChatAttachment; mine: boolean }) {
  const { colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const opening = useRef(false);
  const imageRetried = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const foreground = mine ? '#FFFFFF' : colors.text;
  const secondary = mine ? '#FFFFFFCC' : colors.textSecondary;

  const refresh = useCallback(async (): Promise<Media | null> => {
    if (pending.current || !mounted.current) return null;
    pending.current = true; setLoading(true); setFailed(false);
    const request = new AbortController(); controller.current = request;
    try {
      const response = await api.get(`/chats/${encodeURIComponent(chatId)}/attachments/${attachment.id}`, { signal: request.signal, timeout: 30000 });
      const actual = normalizeChatAttachment(response.data?.attachment);
      const url = response.data?.url;
      if (!actual || actual.id !== attachment.id || typeof url !== 'string' || !url.startsWith(`${BACKEND_URL}/chat-attachments/${attachment.id}/view?`)) throw new Error('Unavailable attachment.');
      const next = { attachment: actual, url };
      if (!mounted.current) return null;
      setMedia(next);
      return next;
    } catch {
      if (mounted.current) setFailed(true);
      return null;
    } finally { pending.current = false; controller.current = null; if (mounted.current) setLoading(false); }
  }, [chatId, attachment.id]);

  useEffect(() => {
    mounted.current = true;
    if (attachment.kind === 'image') void refresh();
    return () => { mounted.current = false; controller.current?.abort(); };
  }, [attachment.kind, refresh]);

  const open = async () => {
    if (opening.current) return;
    opening.current = true;
    try {
      const fresh = await refresh();
      if (!fresh || !mounted.current) return;
      if (fresh.attachment.kind === 'image') setViewer(fresh.url);
      else await WebBrowser.openBrowserAsync(fresh.url);
    } catch { if (mounted.current) setFailed(true); }
    finally { opening.current = false; }
  };
  const actual = media?.attachment || attachment;

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity onPress={() => void open()} disabled={loading} accessibilityRole="button" accessibilityLabel={`Open ${actual.kind === 'image' ? 'photo' : actual.filename}`} activeOpacity={0.8} style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: mine ? '#FFFFFF1F' : colors.background }}>
        {actual.kind === 'image' && media && !failed ? (
          <Image source={{ uri: media.url }} style={{ width: 220, maxWidth: '100%', aspectRatio: 4 / 3 }} resizeMode="cover" onError={() => {
            if (!imageRetried.current) { imageRetried.current = true; setMedia(null); void refresh(); }
            else setFailed(true);
          }} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minWidth: 160, maxWidth: 240 }}>
            {loading ? <ActivityIndicator color={foreground} /> : <MaterialIcons name={actual.kind === 'image' ? 'image' : 'description'} size={28} color={foreground} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: foreground }}>{actual.kind === 'image' ? 'Photo' : actual.filename}</Text>
              <Text style={{ fontSize: 11, color: secondary }}>{loading ? 'Loading...' : failed ? 'Unavailable · tap to retry' : `${formatAttachmentSize(actual.size)} · Tap to open`}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
      {actual.kind === 'image' && failed && <TouchableOpacity accessibilityRole="button" onPress={() => { imageRetried.current = false; void refresh(); }} style={{ paddingVertical: 8 }}><Text style={{ fontSize: 12, color: foreground }}>Try again</Text></TouchableOpacity>}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: '#000000F2', justifyContent: 'center' }}>
          {viewer && <Image source={{ uri: viewer }} resizeMode="contain" style={{ width: '100%', height: '80%' }} onError={() => { setViewer(null); setFailed(true); }} />}
          <TouchableOpacity onPress={() => setViewer(null)} accessibilityRole="button" accessibilityLabel="Close photo" style={{ position: 'absolute', top: insets.top + 12, right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF22' }}><MaterialIcons name="close" size={24} color="#FFFFFF" /></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
