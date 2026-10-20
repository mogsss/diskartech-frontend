import api from '@/api/axios';
import type { ChatAttachment } from '@/types/chat';
import { CHAT_FILE_TYPES, ChatAttachmentDraft, ChatAttachmentUploadError, createAttachmentDraft, normalizeChatAttachment } from '@/utils/chatAttachments';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';

export function useChatAttachments(chatId: string, onError: (message: string) => void) {
  const [draft, setDraft] = useState<ChatAttachmentDraft | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const busy = useRef(false);
  const alive = useRef(true);
  const uploaded = useRef<ChatAttachment | null>(null);
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; uploadController.current?.abort(); };
  }, []);

  const pick = async (kind: 'photo' | 'file') => {
    if (busy.current) return;
    busy.current = true; setSelecting(true);
    try {
      const result = kind === 'photo'
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible })
        : await DocumentPicker.getDocumentAsync({ type: CHAT_FILE_TYPES, copyToCacheDirectory: true, multiple: false });
      if (!alive.current || result.canceled) return;
      const asset = result.assets[0];
      const next = createAttachmentDraft(asset);
      uploaded.current = null;
      setDraft(next); setProgress(0);
    } catch (error) {
      if (alive.current) onError(error instanceof Error ? error.message : 'Could not select this file. Please try again.');
    } finally { busy.current = false; if (alive.current) setSelecting(false); }
  };

  const prepare = async (): Promise<ChatAttachment | undefined> => {
    if (!draft) return undefined;
    if (uploaded.current) return uploaded.current;
    if (busy.current) throw new Error('Please wait for the current attachment.');
    busy.current = true; setUploading(true); setProgress(0);
    const controller = new AbortController(); uploadController.current = controller;
    try {
      const form = new FormData();
      form.append('file', draft.file || { uri: draft.uri, name: draft.filename, type: draft.mime_type } as any);
      const response = await api.post(`/chats/${encodeURIComponent(chatId)}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000, signal: controller.signal,
        onUploadProgress: event => {
          if (alive.current && event.total) setProgress(Math.min(95, Math.round(event.loaded / event.total * 100)));
        },
      });
      const attachment = normalizeChatAttachment(response.data?.attachment);
      if (!attachment) throw new Error('The attachment could not be saved. Please try again.');
      if (!alive.current) throw new Error('Chat closed.');
      uploaded.current = attachment;
      setProgress(100);
      return attachment;
    } catch (error: any) {
      const fieldError = error.response?.data?.errors?.file?.[0];
      throw new ChatAttachmentUploadError(error.response?.status === 422 && typeof fieldError === 'string' ? fieldError : error.response?.status === 429
        ? 'Too many uploads. Please wait before trying again.'
        : error.response?.status === 403 ? 'You cannot attach a file to this conversation.'
        : error.response?.status === 404 ? 'File attachments are unavailable right now. Please try again later.'
        : error.response?.status === 422 && typeof error.response?.data?.message === 'string' ? error.response.data.message
        : 'The attachment could not be uploaded. Please check your connection and try again.');
    } finally {
      busy.current = false; uploadController.current = null;
      if (alive.current) setUploading(false);
    }
  };

  const clear = () => { if (busy.current) return; uploaded.current = null; setDraft(null); setProgress(0); };
  return { draft, selecting, uploading, progress, pick, prepare, clear };
}
