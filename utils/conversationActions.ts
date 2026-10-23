import { db } from '@/utils/firebase';
import { getTimestampMs } from '@/utils/chatHelpers';
import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface ConversationDeleteTarget {
  id: string;
  lastMessageAt: unknown;
}

export interface SelectableConversation extends ConversationDeleteTarget {
  otherUserId: string;
  sourceChats?: ConversationDeleteTarget[];
}

export const getConversationSources = (conversation: SelectableConversation): ConversationDeleteTarget[] =>
  conversation.sourceChats || [{ id: conversation.id, lastMessageAt: conversation.lastMessageAt }];

/** Keep every underlying thread so clearing a merged conversation cannot reveal a duplicate. */
export function mergeConversationThreads<T extends SelectableConversation>(conversations: T[]): T[] {
  const threads = new Map<string, T>();
  for (const conversation of conversations) {
    const otherId = conversation.otherUserId?.trim();
    const key = otherId && otherId !== 'unknown' ? `user:${otherId}` : `chat:${conversation.id}`;
    const existing = threads.get(key);
    if (existing) existing.sourceChats!.push(...getConversationSources(conversation));
    else threads.set(key, { ...conversation, sourceChats: [...getConversationSources(conversation)] });
  }
  return [...threads.values()];
}

/** Clear only the requesting participant's history through the confirmed preview. */
export async function deleteConversationsForUser(userId: string, targets: ConversationDeleteTarget[]) {
  if (!userId || userId === 'unknown') throw new Error('Please sign in again.');
  const unique = new Map<string, ConversationDeleteTarget>();
  for (const target of targets) {
    if (!target.id || target.id.includes('/')) throw new Error('Invalid conversation.');
    const previous = unique.get(target.id);
    if (!previous || getTimestampMs(target.lastMessageAt) > getTimestampMs(previous.lastMessageAt)) unique.set(target.id, target);
  }
  const queue = [...unique.values()];
  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const target = queue[next++];
      try {
        await runTransaction(db, async transaction => {
          const ref = doc(db, 'chats', target.id);
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          const participantIds = Array.isArray(data.participant_ids) ? data.participant_ids.map(String) : [];
          const participants = [data.sender_id, data.receiver_id, data.student_user_id, data.owner_user_id, data.studentId, data.ownerId].map(value => String(value ?? ''));
          if (!participantIds.includes(userId) && !participants.includes(userId)) throw new Error('This conversation is not yours.');
          const previousClear = getTimestampMs(data[`cleared_at_for_${userId}`] ?? data.cleared_at?.[userId]);
          const confirmedThrough = getTimestampMs(target.lastMessageAt);
          const latestMessage = getTimestampMs(data.last_message_at ?? data.lastMessageAt);
          if (!confirmedThrough && latestMessage > 0) throw new Error('The conversation changed. Please select it again.');
          if (confirmedThrough > 0 && previousClear >= confirmedThrough) return;
          transaction.update(ref, {
            [`cleared_at_for_${userId}`]: confirmedThrough > 0 ? Timestamp.fromMillis(confirmedThrough) : serverTimestamp(),
          });
        });
        deletedIds.push(target.id);
      } catch {
        failedIds.push(target.id);
      }
    }
  };
  // Bound concurrent transactions when Select all includes many conversations.
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return { deletedIds, failedIds };
}
