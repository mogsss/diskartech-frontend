# Selecting and deleting conversations

Student Messages and the shared employer/household Messages screen support:

- **Select**, or long press a conversation, to show checkboxes.
- Tap cards to toggle selection without opening the chat.
- **Select all / Deselect all** applies to the current search and All/Unread filter.
- Changing search/filter or pressing Back exits selection.
- The Delete action opens a **Delete for me** confirmation. Cancel keeps messages.

Deletion updates the participant's existing `cleared_at_for_<userId>` field in
Firestore. It does not delete the conversation document, message documents, or
the other participant's clear/read state. The chat view already uses this cutoff
to hide the requesting user's older messages. No new native package or schema
is needed.

The confirmation captures each selected conversation's last-message timestamp.
Messages arriving later remain visible. Transactions verify participation and
keep an existing newer cutoff from moving backwards. Legacy threads merged into
one conversation card are all included; people sharing a name stay separate.
At most four transactions run concurrently. Partial failures retain the failed
conversations' selection and display retry feedback. Firestore transaction
failure, including lack of connectivity, does not report a successful deletion.

The Messages unread badge ignores conversations whose latest message is at or
before the user's clear cutoff. A later incoming message can reappear and count
as unread normally.

```sh
node --test scripts/test-conversation-selection.cjs scripts/test-chat-screen.cjs scripts/test-notification-actions.cjs
```

Device checks: try all three roles, light/dark mode, search/Unread filters,
Android Back, confirmation cancellation, connectivity loss, and a message
arriving during confirmation. Verify from the other participant's account that
their history remains available.
