# Connection banner

The root layout shows a small banner above navigation for students, employers,
households, and authentication screens. It uses NetInfo 11.4.1, the version
specified by Expo SDK 54's bundled native modules.

- Confirmed disconnection or unreachable internet shows **You're offline**.
- Unknown reachability does not flash an offline warning or announce recovery.
- Confirmed recovery shows **Back online** for 2.5 seconds, then hides.
- Returning from the background refreshes the connection check.
- Navigation stays mounted. The banner does not clear forms, change sessions,
  retry uploads or message sends, or interpret a backend HTTP error as offline.

## Build and verify

NetInfo adds native code. Build and install a **new development or preview APK**
before testing the banner. An older development APK can still open the app,
but skips the banner and prints a development warning until rebuilt.
An EAS Update alone cannot add this module to an existing APK.

```sh
eas build --platform android --profile development
# Or, for group testing:
eas build --platform android --profile preview
```

Install the resulting APK. For development, start Metro with
`npx expo start --dev-client` and open the server in the development client.

1. Open a profile form or chat and leave an unsaved draft.
2. Turn off both Wi-Fi and mobile data. The amber offline banner should appear
   without hiding the header or resetting the draft.
3. Reconnect. The green recovery banner should briefly appear and then hide.
4. Repeat with Wi-Fi connected to a router without internet access.
5. Change connectivity while the app is in the background, then reopen it.
6. Check light/dark mode, landscape safe areas, and larger system font sizes.

This banner reports connectivity; it does not make every screen available
offline or add persistent Firestore caching across app restarts.

Automated checks: `node --test scripts/test-connectivity-banner.cjs`.
