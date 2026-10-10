import { HapticTab } from '@/components/ui/haptic-tab';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { BottomTabBar, BottomTabBarButtonProps, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { StudentScrollChromeProvider, useStudentScrollChrome } from '@/hooks/useStudentScrollChrome';
import { AnimatedView } from '@/components/ui/animated';

const SEARCH_TAB_LIFT = 22;
const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 90 : 72) + SEARCH_TAB_LIFT;

function SearchTabButton(props: BottomTabBarButtonProps) {
  const { colors, isDark } = useDarkMode();
  const focused = props['aria-selected'] === true || props.accessibilityState?.selected === true;

  return (
    <HapticTab
      {...props}
      accessibilityLabel={props.accessibilityLabel ?? props['aria-label'] ?? 'Search jobs'}
      accessibilityState={{ ...props.accessibilityState, selected: focused }}
      pressOpacity={0.85}
      style={[props.style, { padding: 0, gap: 0, justifyContent: 'flex-start', overflow: 'visible' }]}
    >
      <View pointerEvents="none" className="items-center">
        <View
          className="w-16 h-16 rounded-3xl border-4 items-center justify-center"
          style={{
            backgroundColor: focused ? Colors.primaryDark : Colors.primary,
            borderColor: colors.surface,
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: focused ? 0.24 : 0.16,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <MaterialIcons name="search" size={28} color="#FFFFFF" />
        </View>
        <Text className="text-xs font-semibold mt-1" style={{ color: focused ? (isDark ? colors.accent : Colors.primary) : (isDark ? '#94A3B8' : Colors.gray500) }}>Search</Text>
      </View>
    </HapticTab>
  );
}

function StudentTabBar(props: BottomTabBarProps) {
  const { progress } = useStudentScrollChrome();
  const height = useSharedValue(TAB_BAR_HEIGHT);
  const isHome = props.state.routes[props.state.index].name === 'home';
  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value * (isHome ? 1 - progress.value : 1),
  }));

  return (
    <AnimatedView
      cssInterop={false}
      style={[{ overflow: 'hidden', flexShrink: 0 }, animatedStyle]}
    >
      <View className="shrink-0" onLayout={(event) => { height.value = event.nativeEvent.layout.height; }}>
        <BottomTabBar {...props} />
      </View>
    </AnimatedView>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useDarkMode();
  const { unreadMessagesCount } = useUnreadNotifications();

  return (
    <StudentScrollChromeProvider>
      <Tabs
        tabBar={(props) => <StudentTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: isDark ? colors.accent : Colors.primary,
          tabBarInactiveTintColor: isDark ? '#94A3B8' : Colors.gray400,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'ios' ? 28 : 14,
            paddingTop: 8 + SEARCH_TAB_LIFT,
            height: TAB_BAR_HEIGHT,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarItemStyle: {
            gap: 2,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="applications"
          options={{
            title: 'Applications',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="description" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarButton: (props) => <SearchTabButton {...props} />,
            tabBarItemStyle: { gap: 0, marginTop: -SEARCH_TAB_LIFT },
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="search" size={size} color={color} />
            ),
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
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </StudentScrollChromeProvider>
  );
}
