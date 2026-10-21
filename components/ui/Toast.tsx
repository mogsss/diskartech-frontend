import { useDarkMode } from '@/hooks/useDarkMode';
import type { ToastMessage } from '@/hooks/useToast';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Dimensions, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const variants = {
  success: { icon: 'check-circle', title: 'Success', light: '#047857', dark: '#6EE7B7', lightBg: '#ECFDF5', darkBg: '#14352A' },
  error: { icon: 'error-outline', title: 'Something went wrong', light: '#DC2626', dark: '#F87171', lightBg: '#FEF2F2', darkBg: '#3F222A' },
  warning: { icon: 'warning-amber', title: 'Please check', light: '#92400E', dark: '#FCD34D', lightBg: '#FFFBEB', darkBg: '#3B321D' },
  info: { icon: 'info-outline', title: 'Notice', light: '#1D4ED8', dark: '#93C5FD', lightBg: '#EFF6FF', darkBg: '#1E3351' },
} as const;

export default function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const { colors, isDark } = useDarkMode();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dragAxis = useRef<'x' | 'y' | null>(null);
  const cardHeight = useRef(100);
  const closing = useRef(false);
  const mounted = useRef(true);
  const reduceMotion = useRef(false);
  const variant = variants[toast.type];
  const title = toast.title || variant.title;
  const accent = isDark ? variant.dark : variant.light;

  const dismiss = useCallback((direction: 'left' | 'right' | 'up' = 'up') => {
    if (closing.current) return;
    closing.current = true;
    const duration = reduceMotion.current ? 0 : 160;
    Animated.parallel([
      Animated.timing(progress, { toValue: 0, duration, useNativeDriver: true }),
      Animated.timing(direction === 'up' ? dragY : dragX, {
        toValue: direction === 'up' ? -(cardHeight.current + insets.top + 28)
          : (direction === 'left' ? -1 : 1) * (Dimensions.get('window').width + 32),
        duration,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && mounted.current) onDismiss(toast.id);
    });
  }, [dragX, dragY, insets.top, onDismiss, progress, toast.id]);

  const panResponder = useMemo(() => {
    const returnToStart = (value: Animated.Value) => reduceMotion.current
      ? Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true })
      : Animated.spring(value, { toValue: 0, useNativeDriver: true, overshootClamping: true });
    const reset = () => Animated.parallel([
      returnToStart(dragX),
      returnToStart(dragY),
    ]).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => !closing.current && (
        (Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy))
        || (gesture.dy < -8 && Math.abs(gesture.dy) > Math.abs(gesture.dx))
      ),
      onPanResponderGrant: () => {
        dragAxis.current = null;
        dragX.stopAnimation();
        dragY.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        dragAxis.current ??= Math.abs(gesture.dx) > Math.abs(gesture.dy) ? 'x' : 'y';
        if (dragAxis.current === 'x') dragX.setValue(gesture.dx);
        else dragY.setValue(Math.min(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        const axis = dragAxis.current ?? (Math.abs(gesture.dx) > Math.abs(gesture.dy) ? 'x' : 'y');
        if (axis === 'x' && (Math.abs(gesture.dx) >= 72
          || (Math.abs(gesture.dx) >= 16 && Math.abs(gesture.vx) >= 0.65 && gesture.dx * gesture.vx > 0))) {
          dismiss(gesture.dx < 0 ? 'left' : 'right');
        } else if (axis === 'y' && (gesture.dy <= -48 || (gesture.dy <= -12 && gesture.vy <= -0.65))) {
          dismiss('up');
        } else reset();
      },
      onPanResponderTerminate: reset,
    });
  }, [dismiss, dragX, dragY]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const animate = async () => {
      try { reduceMotion.current = await AccessibilityInfo.isReduceMotionEnabled(); } catch { /* Use the short default transition. */ }
      if (!cancelled && !closing.current) Animated.timing(progress, { toValue: 1, duration: reduceMotion.current ? 0 : 180, useNativeDriver: true }).start();
    };
    void animate();
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${title}. ${toast.message}`);
    return () => {
      cancelled = true;
      mounted.current = false;
      progress.stopAnimation(); dragX.stopAnimation(); dragY.stopAnimation();
    };
  }, [dragX, dragY, progress, title, toast.message]);

  return <View pointerEvents="box-none" style={[styles.host, {
    top: insets.top + 12,
    left: Math.max(insets.left, 16),
    right: Math.max(insets.right, 16),
  }]}>
    <Animated.View {...panResponder.panHandlers} onLayout={event => { cardHeight.current = event.nativeEvent.layout.height; }} style={[styles.card, {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      opacity: progress,
      transform: [
        { translateX: dragX },
        { translateY: Animated.add(dragY, progress.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] })) },
      ],
    }]}>
      <View style={[styles.icon, { backgroundColor: isDark ? variant.darkBg : variant.lightBg }]}>
        <MaterialIcons name={variant.icon} size={23} color={accent} accessible={false} />
      </View>
      <View style={styles.copy} accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={`${title}. ${toast.message}`}
        accessibilityActions={[{ name: 'dismiss', label: 'Dismiss notification' }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'dismiss') dismiss(); }}
        onAccessibilityEscape={() => dismiss()}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{toast.message}</Text>
      </View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', alignItems: 'center', zIndex: 1000 },
  card: {
    width: '100%', maxWidth: 480, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 12,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Poppins-SemiBold', fontSize: 13, lineHeight: 20 },
  message: { fontFamily: 'Poppins', fontSize: 12, lineHeight: 18 },
});
