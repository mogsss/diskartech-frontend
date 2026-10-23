# Notification list actions

Students, employers, and households share the Notifications screen.

- Long press a notification, or tap **Select**, to enter selection mode.
- Tap cards to toggle their checkboxes. **Select all** and **Deselect all** apply
  to the current filter. Changing filters or pressing Back exits selection.
- **Delete** asks for confirmation, then removes the selected notification entries.
  Applications, employment records, and conversations are not deleted.
- **Mark all read** applies to all visible, non-deleted notification entries across
  filters. It does not open chats or change their actual unread-message state.
- Notification icons have no background and retain light/dark theme colors.

Read and deleted states are stored per account in AsyncStorage on this device.
They survive reopening the app, but do not sync to another phone or survive
clearing application data. No backend schema or Firebase records are changed.

Actions record each original source ID and timestamp, including all API and
Firestore records represented by one merged card. A newer incoming message or
application update can appear again. Delete confirmation captures its source
versions so an update arriving during confirmation is preserved. Writes are
serialized, and a failed save leaves the feed and selection available for retry.
The notification indicator observes the same saved state; the Messages badge
continues to reflect actual unread conversations.

Validation:

```sh
node --test scripts/test-notification-actions.cjs scripts/test-notification-feed.cjs scripts/test-notification-preferences.cjs
```

On a device, check long press, Back/Cancel, filter changes, bulk selection, read
state after reopening the screen, light/dark mode, and a new message arriving
after removing its earlier notification.
