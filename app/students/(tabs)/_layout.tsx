import { HapticTab } from '@/components/ui/haptic-tab';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { BottomTabBar, BottomTabBarButtonProps, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentScrollChromeProvider, useStudentScrollChrome } from '@/hooks/useStudentScrollChrome';
import { AnimatedView } from '@/components/ui/animated';
import {
  getStudentTabBarHeight,
  STUDENT_SEARCH_TAB_LIFT as SEARCH_TAB_LIFT,
  STUDENT_TAB_BAR_HEIGHT as TAB_BAR_HEIGHT,
} from '@/components/student/StudentTabBarSpacer';

function SearchTabButton(props: BottomTabBarButtonProps) {
  const { colors, isDark } = useDarkMode();
  const focused = props['aria-selected'] === true || props.accessibilityState?.selected === true;

  return (
    <HapticTab
      {...props}
      accessibilityLabel={props.accessibilityLabel ?? props['aria-label'] ?? 'Search jobs'}
      accessibilityState={{ ...props.accessibilityState, selected: focused }}
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
            backgroundColor: focused ? Colors.primaryDark : Colors.primary,
            borderColor: colors.surface,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.16,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Ionicons name="search-outline" size={27} color="#FFFFFF" />
        </View>
        <Text style={{ marginTop: 4, fontSize: 10, lineHeight: 14, fontFamily: 'Poppins-SemiBold', color: focused ? colors.accent : colors.textSecondary }}>Search</Text>
      </View>
    </HapticTab>
  );
}

function StudentTabBar(props: BottomTabBarProps) {
  const { colors } = useDarkMode();
  const { progress } = useStudentScrollChrome();
  const insets = useSafeAreaInsets();
  const bottomSpacing = Math.max(insets.bottom, 12) + 8;
  const height = getStudentTabBarHeight(insets.bottom);
  const isHome = props.state.routes[props.state.index].name === 'home';
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: isHome ? 1 - progress.value : 1,
    transform: [{ translateY: isHome ? height * progress.value : 0 }],
  }));

  return (
    <AnimatedView
      cssInterop={false}
      pointerEvents="box-none"
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height, zIndex: 10, overflow: 'visible' }, animatedStyle]}
    >
      {/* Fade the feed into a solid backdrop beneath the pill and system controls. */}
      <LinearGradient
        accessible={false}
        pointerEvents="none"
        colors={[`${colors.background}00`, colors.background, colors.background]}
        locations={[0, (SEARCH_TAB_LIFT + 24) / (height + 24), 1]}
        style={{ position: 'absolute', top: -24, bottom: 0, left: 0, right: 0 }}
      />
      <View pointerEvents="box-none" style={{ paddingTop: SEARCH_TAB_LIFT, paddingBottom: bottomSpacing, paddingHorizontal: 14 }}>
        <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 600, alignSelf: 'center' }}>
          <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
        </View>
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
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelPosition: 'below-icon',
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderWidth: 0,
            borderTopWidth: 0,
            borderRadius: TAB_BAR_HEIGHT / 2,
            paddingHorizontal: 6,
            paddingBottom: 10,
            paddingTop: 12,
            height: TAB_BAR_HEIGHT,
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
          tabBarItemStyle: {
            gap: 2,
          },
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: '#FFFFFF',
            fontSize: 10,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarItemStyle: { flex: 0.8, gap: 2 },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="applications"
          options={{
            title: 'Applications',
            tabBarItemStyle: { flex: 1.2, gap: 2 },
            tabBarLabel: ({ color, children }) => (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  alignSelf: 'stretch',
                  textAlign: 'center',
                  fontSize: 10,
                  lineHeight: 14,
                  fontFamily: 'Poppins-Medium',
                  marginTop: 3,
                  color,
                }}
              >
                {children}
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarButton: (props) => <SearchTabButton {...props} />,
            tabBarItemStyle: { gap: 0, marginTop: -SEARCH_TAB_LIFT },
            tabBarIcon: ({ color }) => (
              <Ionicons name="search-outline" size={24} color={color} />
            ),
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
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </StudentScrollChromeProvider>
  );
}
