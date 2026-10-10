import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Easing,
  Switch,
  TouchableWithoutFeedback,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Avatar from '@/components/ui/Avatar';
import NotificationModal from '@/components/ui/modals/NotificationModal';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Colors } from '@/constants/colors';

const normalizeRoute = (route: string) =>
  route.split(/[?#]/)[0].replace(/\/\([^/]+\)/g, '').replace(/\/+$/, '') || '/';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

export interface SideDrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  user: {
    name: string;
    role?: 'business' | 'household' | 'student' | string;
    avatarUri?: string | null;
    avatarInitials?: string;
    isVerified?: boolean;
    rejectionReason?: string | null;
  };
  onLogout?: () => void;
}

export default function SideDrawerMenu({
  visible,
  onClose,
  user,
  onLogout,
}: SideDrawerMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleDarkMode } = useDarkMode();

  const [modalVisible, setModalVisible] = useState(visible);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setLogoutModalVisible(false);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleClose = (callback?: unknown) => {
    setLogoutModalVisible(false);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  const handleNavigate = (route: string) => {
    handleClose(() => {
      setTimeout(() => {
        router.push(route as any);
      }, 60);
    });
  };

  const handleLogoutPress = () => {
    setLogoutModalVisible(true);
  };

  const handleConfirmLogout = () => {
    handleClose(async () => {
      if (onLogout) {
        onLogout();
      } else {
        try {
          await AsyncStorage.clear();
        } catch (error) {
          console.error('Error clearing storage on logout:', error);
        }
        router.replace('/auth/welcome' as any);
      }
    });
  };

  if (!modalVisible) return null;

  const isHousehold = user.role === 'household';
  const isStudent = user.role === 'student';

  const activeColor = isDark ? colors.accent : colors.primary;
  const activeSurface = isDark ? 'rgba(220, 38, 38, 0.15)' : '#FFF1F2';
  const isRouteActive = (route: string) => normalizeRoute(pathname) === normalizeRoute(route);
  const navigationStyle = (route: string) => ({
    backgroundColor: isRouteActive(route) ? activeSurface : 'transparent',
    borderLeftWidth: 3,
    borderLeftColor: isRouteActive(route) ? activeColor : 'transparent',
  });


  const statusBarHeight = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 36) : insets.top;
  const safeTopPadding = Math.max(insets.top || 0, statusBarHeight || 0) + (Platform.OS === 'android' ? 14 : 10);

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      onRequestClose={() => handleClose()}
      statusBarTranslucent
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Animated Dim Overlay / Backdrop */}
        <TouchableWithoutFeedback onPress={() => handleClose()}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              opacity: fadeAnim,
            }}
          />
        </TouchableWithoutFeedback>

        {/* Animated Sliding Drawer Container */}
        <Animated.View
          style={{
            width: DRAWER_WIDTH,
            height: '100%',
            backgroundColor: colors.surface,
            transform: [{ translateX: slideAnim }],
            shadowColor: '#000',
            shadowOffset: { width: 4, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 16,
            paddingTop: safeTopPadding,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          {/* Top Bar: Brand Logo & Close Button */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 4,
              paddingBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >


          </View>

          {/* Simple Minimalist Profile Row (As requested) */}
          <TouchableOpacity
            onPress={() =>
              handleNavigate(
                isStudent
                  ? '/students/(tabs)/profile'
                  : `/employer/(tabs)/profile?type=${user.role}`
              )
            }
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
            }}
          >
            {/* Avatar */}
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                overflow: 'hidden',
                backgroundColor: isDark ? '#334155' : '#E2E8F0',
                marginRight: 14,
              }}
              className="items-center justify-center"
            >
              <Avatar
                uri={user.avatarUri || ''}
                name={user.avatarInitials || user.name}
                size={48}
              />
            </View>

            {/* Name + View account details */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View className="flex-row items-center gap-1.5">
                <Text
                  style={{ color: colors.text }}
                  className="text-[15px] font-bold tracking-tight shrink"
                  numberOfLines={1}
                >
                  {user.name}
                </Text>
                {user.isVerified ? (
                  <MaterialIcons name="verified" size={17} color={Colors.verified} />
                ) : user.rejectionReason ? (
                  <MaterialIcons name="error" size={17} color={Colors.rejected} />
                ) : (
                  <MaterialIcons name="schedule" size={17} color={Colors.pending} />
                )}
              </View>
              <Text
                style={{ color: colors.textSecondary }}
                className="text-xs font-normal mt-0.5"
              >
                View account details
              </Text>
            </View>

            {/* Chevron Right */}
            <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Menu Items (Scrollable) */}
          <ScrollView
            className="flex-1 mt-2 px-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Group: Core Navigation */}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive(isStudent ? '/students/(tabs)/home' : `/employer/(tabs)/dashboard?type=${user.role}`) }}
              activeOpacity={0.7}
              onPress={() => handleNavigate(isStudent ? '/students/(tabs)/home' : `/employer/(tabs)/dashboard?type=${user.role}`)}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 6,
              }, navigationStyle(isStudent ? '/students/(tabs)/home' : `/employer/(tabs)/dashboard?type=${user.role}`)]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive(isStudent ? '/students/(tabs)/home' : `/employer/(tabs)/dashboard?type=${user.role}`) ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons name="home" size={20} color={isRouteActive(isStudent ? '/students/(tabs)/home' : `/employer/(tabs)/dashboard?type=${user.role}`) ? activeColor : colors.text} />
              </View>
              <Text style={{ color: isRouteActive(isStudent ? '/students/(tabs)/home' : `/employer/(tabs)/dashboard?type=${user.role}`) ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                {isStudent ? 'Home' : ' Home'}
              </Text>
            </TouchableOpacity>

            {isStudent ? (
              <>
                <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/students/(tabs)/applications') }}
                  activeOpacity={0.7}
                  onPress={() => handleNavigate('/students/(tabs)/applications')}
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    marginBottom: 6,
                  }, navigationStyle('/students/(tabs)/applications')]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isRouteActive('/students/(tabs)/applications') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialIcons name="description" size={20} color={isRouteActive('/students/(tabs)/applications') ? activeColor : colors.text} />
                  </View>
                  <Text style={{ color: isRouteActive('/students/(tabs)/applications') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                    My Applications
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/students/(tabs)/search') }}
                  activeOpacity={0.7}
                  onPress={() => handleNavigate('/students/(tabs)/search')}
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    marginBottom: 6,
                  }, navigationStyle('/students/(tabs)/search')]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isRouteActive('/students/(tabs)/search') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialIcons name="search" size={20} color={isRouteActive('/students/(tabs)/search') ? activeColor : colors.text} />
                  </View>
                  <Text style={{ color: isRouteActive('/students/(tabs)/search') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                    Search Jobs
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/employer/job-posting') }}
                  activeOpacity={0.7}
                  onPress={() => handleNavigate('/employer/job-posting')}
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    marginBottom: 6,
                  }, navigationStyle('/employer/job-posting')]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isRouteActive('/employer/job-posting') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialIcons name="work" size={20} color={isRouteActive('/employer/job-posting') ? activeColor : colors.text} />
                  </View>
                  <Text style={{ color: isRouteActive('/employer/job-posting') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                    {isHousehold ? 'Post an Opening' : 'Post a New Job'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive(`/employer/(tabs)/jobs?type=${user.role}`) }}
                  activeOpacity={0.7}
                  onPress={() => handleNavigate(`/employer/(tabs)/jobs?type=${user.role}`)}
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    marginBottom: 6,
                  }, navigationStyle(`/employer/(tabs)/jobs?type=${user.role}`)]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isRouteActive(`/employer/(tabs)/jobs?type=${user.role}`) ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialIcons name="work" size={20} color={isRouteActive(`/employer/(tabs)/jobs?type=${user.role}`) ? activeColor : colors.text} />
                  </View>
                  <Text style={{ color: isRouteActive(`/employer/(tabs)/jobs?type=${user.role}`) ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                    My Jobs
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/employer/applicants-list') }}
                  activeOpacity={0.7}
                  onPress={() => handleNavigate('/employer/applicants-list')}
                  style={[{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    marginBottom: 6,
                  }, navigationStyle('/employer/applicants-list')]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isRouteActive('/employer/applicants-list') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialIcons name="people" size={20} color={isRouteActive('/employer/applicants-list') ? activeColor : colors.text} />
                  </View>
                  <Text style={{ color: isRouteActive('/employer/applicants-list') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                    Applicants List
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive(isStudent ? '/students/(tabs)/messages' : '/employer/(tabs)/messages') }}
              activeOpacity={0.7}
              onPress={() => handleNavigate(isStudent ? '/students/(tabs)/messages' : '/employer/(tabs)/messages')}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 6,
              }, navigationStyle(isStudent ? '/students/(tabs)/messages' : '/employer/(tabs)/messages')]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive(isStudent ? '/students/(tabs)/messages' : '/employer/(tabs)/messages') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons name="chat" size={20} color={isRouteActive(isStudent ? '/students/(tabs)/messages' : '/employer/(tabs)/messages') ? activeColor : colors.text} />
              </View>
              <Text style={{ color: isRouteActive(isStudent ? '/students/(tabs)/messages' : '/employer/(tabs)/messages') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                Messages
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/notifications') }}
              activeOpacity={0.7}
              onPress={() => handleNavigate('/notifications')}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 12,
              }, navigationStyle('/notifications')]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive('/notifications') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons name="notifications" size={20} color={isRouteActive('/notifications') ? activeColor : colors.text} />
              </View>
              <Text style={{ color: isRouteActive('/notifications') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                Notifications
              </Text>
            </TouchableOpacity>

            {/* Group: Account & Verification */}
            <Text
              style={{ color: colors.textSecondary }}
              className="text-[11px] font-bold uppercase tracking-wider mb-2 ml-2"
            >
              Account & Security
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive(isStudent ? '/students/(tabs)/profile' : `/employer/(tabs)/profile?type=${user.role}`) }}
              activeOpacity={0.7}
              onPress={() => handleNavigate(isStudent ? '/students/(tabs)/profile' : `/employer/(tabs)/profile?type=${user.role}`)}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 6,
              }, navigationStyle(isStudent ? '/students/(tabs)/profile' : `/employer/(tabs)/profile?type=${user.role}`)]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive(isStudent ? '/students/(tabs)/profile' : `/employer/(tabs)/profile?type=${user.role}`) ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons name="person" size={20} color={isRouteActive(isStudent ? '/students/(tabs)/profile' : `/employer/(tabs)/profile?type=${user.role}`) ? activeColor : colors.text} />
              </View>
              <Text style={{ color: isRouteActive(isStudent ? '/students/(tabs)/profile' : `/employer/(tabs)/profile?type=${user.role}`) ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                My Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive(isStudent
                    ? '/students/verification-status'
                    : `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`) }}
              activeOpacity={0.7}
              onPress={() =>
                handleNavigate(
                  isStudent
                    ? '/students/verification-status'
                    : `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`
                )
              }
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 6,
              }, navigationStyle(isStudent
                    ? '/students/verification-status'
                    : `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`)]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive(isStudent
                    ? '/students/verification-status'
                    : `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`) ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons
                  name={
                    user.isVerified
                      ? 'verified-user'
                      : user.rejectionReason
                        ? 'error-outline'
                        : 'schedule'
                  }
                  size={20}
                  color={
                    isRouteActive(isStudent
                      ? '/students/verification-status'
                      : `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`)
                      ? activeColor
                      : colors.text
                  }
                />
              </View>
              <Text style={{ color: isRouteActive(isStudent
                    ? '/students/verification-status'
                    : `/employer/verification-status?type=${isHousehold ? 'household' : 'business'}`) ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                Verification Status
              </Text>

              {/* Status Pill */}
              <View
                style={{
                  backgroundColor: user.isVerified
                    ? 'rgba(76, 175, 80, 0.12)'
                    : user.rejectionReason
                      ? 'rgba(244, 67, 54, 0.12)'
                      : 'rgba(255, 152, 0, 0.12)',
                  borderColor: user.isVerified
                    ? 'rgba(76, 175, 80, 0.3)'
                    : user.rejectionReason
                      ? 'rgba(244, 67, 54, 0.3)'
                      : 'rgba(255, 152, 0, 0.3)',
                }}
                className="px-2 py-0.5 rounded-full border mr-1.5"
              >
                <Text
                  style={{
                    color: user.isVerified
                      ? Colors.verified
                      : user.rejectionReason
                        ? Colors.rejected
                        : Colors.pending,
                    fontSize: 10,
                    fontWeight: '700',
                  }}
                >
                  {user.isVerified
                    ? 'Verified'
                    : user.rejectionReason
                      ? 'Rejected'
                      : 'Pending'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/settings') }}
              activeOpacity={0.7}
              onPress={() => handleNavigate('/settings')}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 12,
              }, navigationStyle('/settings')]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive('/settings') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons name="settings" size={20} color={isRouteActive('/settings') ? activeColor : colors.text} />
              </View>
              <Text style={{ color: isRouteActive('/settings') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                Settings
              </Text>
            </TouchableOpacity>

            {/* Group: Preferences & Support */}
            <Text
              style={{ color: colors.textSecondary }}
              className="text-[11px] font-bold uppercase tracking-wider mb-2 ml-2"
            >
              Preferences & Info
            </Text>

            {/* Dark Mode Switch Row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                marginBottom: 6,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons
                  name={isDark ? 'dark-mode' : 'light-mode'}
                  size={20}
                  color={colors.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text }} className="text-sm font-semibold">
                  Dark Mode
                </Text>
                <Text style={{ color: colors.textSecondary }} className="text-[11px]">
                  {isDark ? 'Dark theme enabled' : 'Light theme enabled'}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#CBD5E1', true: '#DC2626' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/help-center') }}
              activeOpacity={0.7}
              onPress={() => handleNavigate('/help-center')}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 6,
              }, navigationStyle('/help-center')]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive('/help-center') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons name="help" size={20} color={isRouteActive('/help-center') ? activeColor : colors.text} />
              </View>
              <Text style={{ color: isRouteActive('/help-center') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                Help Center & FAQs
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={isRouteActive('/help-center') ? activeColor : colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: isRouteActive('/about-diskartech') }}
              activeOpacity={0.7}
              onPress={() => handleNavigate('/about-diskartech')}
              style={[{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                marginBottom: 6,
              }, navigationStyle('/about-diskartech')]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: isRouteActive('/about-diskartech') ? activeSurface : isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialIcons name="info" size={20} color={isRouteActive('/about-diskartech') ? activeColor : colors.text} />
              </View>
              <Text style={{ color: isRouteActive('/about-diskartech') ? activeColor : colors.text, flex: 1 }} className="text-sm font-semibold">
                About DiskarTech
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={isRouteActive('/about-diskartech') ? activeColor : colors.textSecondary} />
            </TouchableOpacity>
          </ScrollView>

          {/* Sticky Bottom Footer (Logout Button + Version) */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLogoutPress}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                gap: 8,
              }}
            >
              <MaterialIcons name="logout" size={18} color={colors.accent} />
              <Text style={{ color: '#DC2626' }} className="text-sm font-bold">
                Log Out
              </Text>
            </TouchableOpacity>

            <Text
              style={{ color: colors.textSecondary }}
              className="text-[10px] text-center mt-2.5 font-medium"
            >
              DiskarTech v1.0.0
            </Text>
          </View>
        </Animated.View>
      </View>
      <NotificationModal
        visible={logoutModalVisible}
        title="Log Out"
        message="Are you sure you want to Log Out?"
        iconName="logout"
        iconColor="#DC2626"
        iconBgColor="bg-red-50"
        primaryButtonText="Log Out"
        onPrimaryPress={handleConfirmLogout}
        secondaryButtonText="Cancel"
        onSecondaryPress={() => setLogoutModalVisible(false)}
        buttonLayout="row"
      />
    </Modal>
  );
}
