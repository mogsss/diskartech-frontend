import { HapticTab } from '@/components/ui/haptic-tab';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, BottomTabBarButtonProps, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Tabs, useGlobalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { resolveHirerAccountType, type HirerAccountType } from '@/utils/hirerAccount';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

import {
  getEmployerTabBarHeight,
  EMPLOYER_POST_TAB_LIFT as POST_TAB_LIFT,
  EMPLOYER_TAB_BAR_HEIGHT as TAB_BAR_HEIGHT,
} from '@/components/employer/EmployerTabBarSpacer';

function PostTabButton(props: BottomTabBarButtonProps) {
  const { colors, isDark } = useDarkMode();

  return (
    <HapticTab
      {...props}
      accessibilityRole="button"
      role="button"
      accessibilityLabel="Post a new job"
      aria-label="Post a new job"
      aria-selected={false}
      accessibilityState={{ ...props.accessibilityState, selected: false }}
      pressOpacity={0.85}
      style={[props.style, { padding: 0, gap: 0, alignItems: 'center', justifyContent: 'flex-start', overflow: 'visible' }]}
    >
      <View pointerEvents="none" className="items-center">
        <View
          className="items-center justify-center"
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            borderWidth: 3,
            backgroundColor: colors.primary,
            borderColor: colors.surface,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.16,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </View>
        <Text style={{ marginTop: 4, fontSize: 10, lineHeight: 14, fontFamily: 'Poppins-SemiBold', color: colors.textSecondary }}>Post</Text>
      </View>
    </HapticTab>
  );
}

function EmployerTabBar(props: BottomTabBarProps) {
  const { colors } = useDarkMode();
  const insets = useSafeAreaInsets();
  const height = getEmployerTabBarHeight(insets.bottom);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height, zIndex: 10, overflow: 'visible' }}>
      <LinearGradient
        accessible={false}
        pointerEvents="none"
        colors={[`${colors.background}00`, colors.background, colors.background]}
        locations={[0, (POST_TAB_LIFT + 24) / (height + 24), 1]}
        style={{ position: 'absolute', top: -24, bottom: 0, left: 0, right: 0 }}
      />
      <View pointerEvents="box-none" style={{ paddingTop: POST_TAB_LIFT, paddingBottom: Math.max(insets.bottom, 12) + 8, paddingHorizontal: 14 }}>
        <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 600, alignSelf: 'center' }}>
          <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
        </View>
      </View>
    </View>
  );
}

export default function EmployerTabLayout() {
  const { type } = useGlobalSearchParams<{ type?: string }>();
  const [accountType, setAccountType] = useState<HirerAccountType | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const role = accountType ?? resolveHirerAccountType(null, null, type) ?? 'business';
  const queryParam = `?type=${role}`;
  useFocusEffect(useCallback(() => {
    let active = true;
    AsyncStorage.multiGet(['userData', 'userProfile']).then((entries) => {
      if (active) setAccountType(resolveHirerAccountType(entries[0]?.[1], entries[1]?.[1], type));
    }).catch(() => { /* Profile can still resolve the account from the API. */ }).finally(() => {
      if (active) setRoleReady(true);
    });
    return () => { active = false; };
  }, [type]));
  const { colors, isDark } = useDarkMode();
  const { unreadMessagesCount } = useUnreadNotifications();

  // initialParams are captured when each tab first mounts, so resolve the role first.
  if (!roleReady) return <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <Tabs
      tabBar={(props) => <EmployerTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderWidth: 0,
          borderTopWidth: 0,
          borderRadius: TAB_BAR_HEIGHT / 2,
          height: TAB_BAR_HEIGHT,
          paddingHorizontal: 6,
          paddingBottom: 10,
          paddingTop: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.08,
          shadowRadius: 12,
          elevation: 6,
          overflow: 'visible',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 14,
          fontFamily: 'Poppins-Medium',
          marginTop: 3,
        },
        tabBarItemStyle: { gap: 2 },
        tabBarBadgeStyle: { backgroundColor: colors.primary, color: '#FFFFFF', fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarItemStyle: { flex: 1.2, gap: 2 },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
        initialParams={{ type: role }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarItemStyle: { flex: 0.8, gap: 2 },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={24} color={color} />
          ),
        }}
        initialParams={{ type: role }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarAccessibilityLabel: 'Post a new job',
          tabBarButton: (props) => <PostTabButton {...props} />,
          tabBarItemStyle: { gap: 0, marginTop: -POST_TAB_LIFT },
        }}
        initialParams={{ type: role }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            // The existing posting screen checks verification before allowing a post.
            router.push(`/employer/job-posting?type=${role}`);
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
        }}
        initialParams={{ type: role }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
        initialParams={{ type: role }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push(`/employer/profile${queryParam}` as any);
          },
        }}
      />
    </Tabs>
  );
}
