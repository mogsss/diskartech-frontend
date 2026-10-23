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

Deleting a live alert removes its `app_notifications/{id}` Firestore document.
The same transaction saves a version cutoff for each original source in
`app_notifications/dismissal:{encodedUserId}:{encodedSourceId}` with the reserved
type `notification_dismissal`. This uses the existing permitted notification
collection. These account-scoped dismissals also hide notifications reconstructed from application status or chat
previews, without deleting applications, employment records, chats, or messages.
The shared preferences hook subscribes to these dismissals, so the list and
notification indicator update on other devices and after reinstalling the app.
Internal dismissal records are excluded from notification cards, counts, and the
foreground notification listener, so deleting an alert never creates another alert.

Mark-all-read and older local dismissals remain in per-account AsyncStorage.
Older local-only deletions are not migrated automatically. No MySQL schema or
native build changes are needed.

Actions record each original source ID and timestamp, including all API and
Firestore records represented by one merged card. A newer incoming message or
application update can appear again. Delete confirmation captures its source
versions so an update arriving during confirmation is preserved. Writes are
serialized for local reads. Cloud deletion uses transactions of up to 100 source
records, checks the live alert's recipient, preserves newer cutoffs, and rereads
alert versions on transaction retries. A newer event in the same Firestore
document is preserved. Transactions require connectivity; failed deletes are
not silently replaced with a local dismissal. Large operations report partial
failures and leave remaining cards available for retry.
The notification indicator observes the same saved state; the Messages badge
continues to reflect actual unread conversations.

Validation:

```sh
node --test scripts/test-notification-actions.cjs scripts/test-notification-feed.cjs scripts/test-notification-preferences.cjs
```

On a device, check long press, Back/Cancel, filter changes, bulk selection, read
state after reopening the screen, light/dark mode, and a new message arriving
after removing its earlier notification.

The deployed rules were inspected on 2026-10-24: `app_notifications/{id}` permits
the client's existing operations, while the previously introduced
`notification_dismissals/{userId}/entries/{sourceId}` path is denied. That denied
path caused the repeated saved-settings error and is no longer used. No deployed
rules were changed. A cloud subscription error now preserves local actions and
does not trigger the misleading reopen toast; a failed delete still reports an
error and retains selection for retry.

Client-side recipient checks do not replace authorization in trusted server/rules.
Existing Firebase authentication/rule hardening is separate from this UI fix.
Tests use mocked transactions/listeners; verify on a test account/device before
release, including deleting an alert, reopening, and a new event arriving later.
