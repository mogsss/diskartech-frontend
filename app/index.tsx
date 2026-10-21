import { Colors } from '@/constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

async function getStartupRoute(): Promise<Href> {
  try {
    const [[, token], [, storedUser], [, hasSeenOnboarding]] = await AsyncStorage.multiGet([
      'userToken',
      'userData',
      'has_seen_onboarding',
    ]);

    if (token && storedUser) {
      const user = JSON.parse(storedUser);
      const role = user.role || (user.student_school_name ? 'student' : user.household_name ? 'household' : 'employer');

      if (role === 'student') return '/students/(tabs)/home';
      return {
        pathname: '/employer/(tabs)/dashboard',
        params: { type: role === 'household' ? 'household' : 'business' },
      };
    }

    return hasSeenOnboarding === 'true' ? '/auth/welcome' : '/onboarding';
  } catch {
    return '/onboarding';
  }
}

export default function SplashScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 620;
  const ringSize = Math.min(width + 48, 420);
  const motion = useRef({
    logo: new Animated.Value(0),
    title: new Animated.Value(0),
    tagline: new Animated.Value(0),
    ambient: new Animated.Value(0),
    pulse: new Animated.Value(0),
    shimmer: new Animated.Value(0),
    exit: new Animated.Value(0),
  }).current;

  useEffect(() => {
    let cancelled = false;
    const animations: Animated.CompositeAnimation[] = [];
    const routePromise = getStartupRoute();

    const play = (animation: Animated.CompositeAnimation) => {
      animations.push(animation);
      return new Promise<boolean>((resolve) => animation.start(({ finished }) => resolve(finished)));
    };

    const start = async () => {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (cancelled) return;

      if (reduceMotion) {
        motion.logo.setValue(1);
        motion.title.setValue(1);
        motion.tagline.setValue(1);
        motion.ambient.setValue(1);
        motion.shimmer.setValue(0.5);
      } else {
        const pulse = Animated.loop(Animated.sequence([
          Animated.timing(motion.pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(motion.pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        const shimmer = Animated.loop(Animated.timing(motion.shimmer, {
          toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }));
        animations.push(pulse, shimmer);
        pulse.start();
        shimmer.start();

        const finished = await play(Animated.parallel([
          Animated.timing(motion.ambient, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.sequence([
            Animated.spring(motion.logo, { toValue: 1, damping: 15, stiffness: 130, mass: 0.8, useNativeDriver: true }),
            Animated.stagger(130, [
              Animated.timing(motion.title, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(motion.tagline, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
            Animated.delay(350),
          ]),
        ]));
        if (!finished || cancelled) return;
      }

      // Wait for storage as well as the entrance, even on slower devices.
      const route = await routePromise;
      if (cancelled) return;

      if (!reduceMotion) {
        const finished = await play(Animated.timing(motion.exit, {
          toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true,
        }));
        if (!finished || cancelled) return;
      }
      router.replace(route);
    };

    void start();
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.stop());
      Object.values(motion).forEach((value) => value.setValue(0));
    };
  }, [motion]);

  return (
    <LinearGradient
      colors={[Colors.primary, '#B51D28', '#750510']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <StatusBar style="light" />
      <View pointerEvents="none" accessible={false} style={styles.decoration}>
        <Animated.View style={[
          styles.halo,
          { width: ringSize, height: ringSize, borderRadius: ringSize / 2, opacity: motion.ambient,
            transform: [{ scale: motion.pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.06] }) }] },
        ]}>
          <View style={styles.innerRing} />
          <View style={styles.orbitDot} />
        </Animated.View>
      </View>

      <Animated.View style={[
        styles.foreground,
        { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 20), opacity: motion.exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
      ]}>
        <View style={[styles.content, { paddingHorizontal: width < 360 ? 24 : 32 }]}>
          <Animated.View style={[
            styles.logoFrame,
            compact && styles.logoCompact,
            { opacity: motion.logo, transform: [
              { translateY: motion.logo.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
              { scale: motion.logo.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
              { rotate: motion.logo.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
            ] },
          ]}>
            <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="cover" accessible={false} />
          </Animated.View>

          <Animated.View style={[
            styles.wordmark,
            { opacity: motion.title, transform: [{ translateY: motion.title.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
          ]}>
            <Text accessibilityRole="header" style={[styles.title, { fontSize: compact || width < 360 ? 36 : 44 }]}>DiskarTech<Text style={styles.titleDot}>.</Text></Text>
          </Animated.View>

          <Animated.View style={[
            styles.taglineBlock,
            { opacity: motion.tagline, transform: [{ translateY: motion.tagline.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
          ]}>
            <View style={styles.accentLine} />
            <Text style={styles.tagline}>Smart Job-Matching Platform{'\n'}for Smart Students</Text>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <View style={styles.loadingTrack} accessible={false}>
            <Animated.View style={[
              styles.loadingLight,
              { transform: [{ translateX: motion.shimmer.interpolate({ inputRange: [0, 1], outputRange: [-34, 104] }) }] },
            ]} />
          </View>
          <Text style={styles.footerText}>OPPORTUNITY, CLOSER.</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  decoration: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  halo: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.025)', alignItems: 'center', justifyContent: 'center', marginTop: -65 },
  innerRing: { width: '78%', height: '78%', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  orbitDot: { position: 'absolute', top: '14%', right: '14%', width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  foreground: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 },
  logoFrame: { width: 112, height: 112, borderRadius: 30, padding: 6, backgroundColor: '#FFFFFF', marginBottom: 24, shadowColor: '#400008', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 },
  logoCompact: { width: 88, height: 88, borderRadius: 24, marginBottom: 16 },
  logo: { width: '100%', height: '100%', borderRadius: 24 },
  wordmark: { alignItems: 'center' },
  title: { fontFamily: 'Poppins-ExtraBold', color: '#FFFFFF', letterSpacing: -1.5, textAlign: 'center' },
  titleDot: { color: '#FFB8AA' },
  taglineBlock: { alignItems: 'center', marginTop: 16, maxWidth: 320 },
  accentLine: { width: 28, height: 3, borderRadius: 2, backgroundColor: '#FFB8AA', marginBottom: 16 },
  tagline: { fontFamily: 'Poppins-Regular', fontSize: 15, lineHeight: 24, color: 'rgba(255,255,255,0.82)', textAlign: 'center' },
  footer: { alignItems: 'center', paddingTop: 12, paddingBottom: 12, gap: 16 },
  loadingTrack: { width: 104, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  loadingLight: { width: 34, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  footerText: { fontFamily: 'Poppins-Medium', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.6)' },
});
