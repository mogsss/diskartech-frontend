# Connection toasts

The root layout shows a floating notification toast for students, employers,
households, and authentication screens. It uses NetInfo 11.4.1, the version
specified by Expo SDK 54's bundled native modules.

- Confirmed disconnection or unreachable internet shows **You're offline** with
  a Wi-Fi-off icon for 5 seconds.
- Unknown reachability does not flash an offline warning or announce recovery.
- Confirmed recovery shows **Back online** with a Wi-Fi icon for 3 seconds.
- Toasts respect the status bar, support light/dark mode, and can be swiped left,
  right, or up to dismiss. Android accessibility settings can extend the timeout.
- Returning from the background refreshes the connection check.
- Navigation stays mounted and the screen does not shift. The toast does not clear forms, change sessions,
  retry uploads or message sends, or interpret a backend HTTP error as offline.

## Build and verify

If the installed APK already includes NetInfo, changing the toast presentation
only needs a JavaScript update. NetInfo itself adds native code: APKs without it
need a **new development or preview build**. An older development APK can still
open the app, but skips connectivity detection and prints a development warning.
An EAS Update alone cannot add the native module to an existing APK.

```sh
eas build --platform android --profile development
# Or, for group testing:
eas build --platform android --profile preview
```

Install the resulting APK. For development, start Metro with
`npx expo start --dev-client` and open the server in the development client.

1. Open a profile form or chat and leave an unsaved draft.
2. Turn off both Wi-Fi and mobile data. The offline toast should appear below
   the status bar without moving the screen or resetting the draft.
3. Swipe to dismiss. Reconnect; the recovery toast should briefly appear and hide.
4. Repeat with Wi-Fi connected to a router without internet access.
5. Change connectivity while the app is in the background, then reopen it.
6. Check light/dark mode, landscape safe areas, and larger system font sizes.

This toast reports connectivity; it does not make every screen available
offline or add persistent Firestore caching across app restarts.

Automated checks: `node --test scripts/test-connectivity-banner.cjs`.
