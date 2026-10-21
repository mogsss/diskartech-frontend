import { HapticTab } from '@/components/ui/haptic-tab';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { router, Tabs, useGlobalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { resolveHirerAccountType, type HirerAccountType } from '@/utils/hirerAccount';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

const POST_TAB_LIFT = 22;

function PostTabButton(props: BottomTabBarButtonProps) {
  const { colors } = useDarkMode();

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
      style={[props.style, { padding: 0, gap: 0, justifyContent: 'flex-start', overflow: 'visible' }]}
    >
      <View pointerEvents="none" className="items-center">
        <View
          className="w-16 h-16 rounded-3xl border-4 items-center justify-center"
          style={{
            backgroundColor: colors.primary,
            borderColor: colors.surface,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <MaterialIcons name="add" size={30} color="#FFFFFF" />
        </View>
        <Text className="text-xs font-semibold mt-1" style={{ color: colors.accent }}>Post</Text>
      </View>
    </HapticTab>
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
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: isDark ? '#94A3B8' : Colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: (Platform.OS === 'ios' ? 90 : 72) + POST_TAB_LIFT,
          paddingBottom: Platform.OS === 'ios' ? 28 : 14,
          paddingTop: 8 + POST_TAB_LIFT,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
        initialParams={{ type: role }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="work" size={size} color={color} />
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
          tabBarItemStyle: { marginTop: -POST_TAB_LIFT },
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
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
        initialParams={{ type: role }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
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
