import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useToast } from '@/hooks/useToast';
import { deleteConversationsForUser, getConversationSources, type SelectableConversation } from '@/utils/conversationActions';

export function useConversationSelection<T extends SelectableConversation>(userId: string | null, conversations: T[], visibleConversations: T[]) {
  const { showToast } = useToast();
  const [mode, setMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [pending, setPending] = useState<T[] | null>(null);
  const [busy, setBusy] = useState(false);
  const deleting = useRef(false);
  const mounted = useRef(true);
  const isSelected = (conversation: T) => getConversationSources(conversation).some(source => selectedIds.has(source.id));
  const selected = conversations.filter(isSelected);
  const allVisibleSelected = visibleConversations.length > 0 && visibleConversations.every(isSelected);

  const exit = () => {
    if (deleting.current) return;
    setMode(false);
    setSelectedIds(new Set());
    setPending(null);
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setMode(false);
    setSelectedIds(new Set());
    setPending(null);
  }, [userId]);

  useEffect(() => {
    if (!mode) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!deleting.current) { setMode(false); setSelectedIds(new Set()); setPending(null); }
      return true;
    });
    return () => subscription.remove();
  }, [mode]);

  const enter = (conversation?: T) => {
    if (deleting.current || !userId) return;
    Keyboard.dismiss();
    setMode(true);
    if (conversation) setSelectedIds(previous => new Set([...previous, ...getConversationSources(conversation).map(source => source.id)]));
  };

  const toggle = (conversation: T) => {
    if (deleting.current) return;
    const ids = getConversationSources(conversation).map(source => source.id);
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (ids.some(id => next.has(id))) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleAll = () => {
    if (deleting.current) return;
    setSelectedIds(new Set(allVisibleSelected ? [] : visibleConversations.flatMap(conversation => getConversationSources(conversation).map(source => source.id))));
  };

  const requestDelete = () => {
    if (deleting.current || !selected.length) return;
    setPending(selected.map(conversation => ({ ...conversation, sourceChats: getConversationSources(conversation).map(source => ({ ...source })) })));
  };

  const confirmDelete = async () => {
    if (!pending || !userId || deleting.current) return;
    const targets = pending;
    setPending(null);
    deleting.current = true;
    setBusy(true);
    try {
      const result = await deleteConversationsForUser(userId, targets.flatMap(getConversationSources));
      if (!mounted.current) return;
      if (result.failedIds.length) {
        setSelectedIds(new Set(result.failedIds));
        showToast({
          type: result.deletedIds.length ? 'warning' : 'error',
          title: result.deletedIds.length ? 'Some conversations could not be deleted' : 'Could not delete conversations',
          message: 'Check your connection. The remaining conversations are selected so you can retry.',
        });
      } else {
        setMode(false);
        setSelectedIds(new Set());
        showToast({ type: 'success', title: 'Conversations deleted', message: 'Selected conversations have been removed for you.' });
      }
    } catch {
      if (mounted.current) showToast({ type: 'error', message: 'Could not delete conversations. Your selection has been kept. Please try again.' });
    } finally {
      deleting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return {
    mode, busy, selectedCount: selected.length, isSelected, allVisibleSelected,
    enter, exit, toggle, toggleAll, requestDelete, confirmDelete,
    confirmationVisible: pending !== null, confirmationCount: pending?.length || 0,
    cancelDelete: () => { if (!deleting.current) setPending(null); },
  };
}
