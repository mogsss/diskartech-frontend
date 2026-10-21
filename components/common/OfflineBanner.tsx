import { useConnectivityNotice } from '@/hooks/useConnectivityNotice';
import { useDarkMode } from '@/hooks/useDarkMode';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Keeps navigation mounted while reserving space for a connection notice. */
export default function OfflineBanner({ children }: { children: React.ReactNode }) {
  const notice = useConnectivityNotice();
  const { isDark, colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const offline = notice === 'offline';
  const foreground = offline
    ? (isDark ? '#FDE68A' : '#854D0E')
    : (isDark ? '#BBF7D0' : '#166534');
  const background = offline
    ? (isDark ? '#332B1B' : '#FFFBEB')
    : (isDark ? '#163326' : '#F0FDF4');
  const message = offline
    ? "You're offline. Check your internet connection."
    : 'Back online. Your connection is restored.';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {notice !== null && (
        <View
          accessible
          accessibilityLabel={message}
          accessibilityLiveRegion="polite"
          style={[styles.banner, {
            backgroundColor: background,
            borderBottomColor: offline
              ? (isDark ? '#64512A' : '#FDE68A')
              : (isDark ? '#2B5940' : '#BBF7D0'),
            paddingTop: insets.top + 10,
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          }]}
        >
          <MaterialIcons
            name={offline ? 'wifi-off' : 'wifi'}
            size={21}
            color={foreground}
            accessible={false}
          />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: foreground }]}>
              {offline ? "You're offline" : 'Back online'}
            </Text>
            <Text style={[styles.detail, { color: foreground }]}>
              {offline ? 'Check your internet connection.' : 'Your connection is restored.'}
            </Text>
          </View>
        </View>
      )}
      {/* The notice already consumes the top inset. Keep the same provider and
          child tree in both states so navigation and form drafts are preserved. */}
      <SafeAreaInsetsContext.Provider value={notice ? { ...insets, top: 0 } : insets}>
        <View style={styles.container}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: { flex: 1 },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 13, lineHeight: 20 },
  detail: { fontFamily: 'Poppins', fontSize: 12, lineHeight: 18 },
});
