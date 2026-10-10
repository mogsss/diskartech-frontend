import React from 'react';
import { View, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useDarkMode } from '@/hooks/useDarkMode';

interface SafeStatusBarProps {
  /**
   * Custom background color. Kung may red header, ipasa ang '#DC2626'.
   * Kung undefined, kusang susunod sa Dark Mode / Light Mode ng CP!
   */
  backgroundColor?: string;
  /**
   * Optional custom background color kapag naka-dark mode ang CP.
   */
  darkBackgroundColor?: string;
  /**
   * Style ng status bar icons (clock, battery, signal): 'light' | 'dark' | 'auto'.
   * Kapag hindi tinukoy, kusang magiging 'light' kung dark mode o red header, at 'dark' kung light mode.
   */
  style?: 'light' | 'dark' | 'auto';
  /**
   * Kung maglalagay ng persistent top spacer para hindi sumampa ang content sa status bar kapag nag-i-scroll.
   * Default: true
   */
  withSpacer?: boolean;
}

export default function SafeStatusBar({
  backgroundColor,
  darkBackgroundColor,
  style,
  withSpacer = true,
}: SafeStatusBarProps) {
  const { isDark } = useDarkMode();

  // Auto-detect: kung may darkBackgroundColor kapag dark mode, gamitin ito. Kung red header, panatilihin ang red.
  const resolvedBg = isDark
    ? (darkBackgroundColor ?? backgroundColor ?? '#0F172A')
    : (backgroundColor ?? '#F8FAFC');

  // Kung pula o madilim ang background, kailangan 'light' (puting clock/battery)
  const isRed =
    resolvedBg.toLowerCase() === '#dc2626' ||
    resolvedBg.toLowerCase() === '#d32f2f' ||
    resolvedBg.toLowerCase() === '#b71c1c';

  const isBackgroundDark = isRed || isDark;

  const resolvedStyle = style ?? (isBackgroundDark ? 'light' : 'dark');

  const statusBarHeight = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 44;

  return (
    <>
      <StatusBar
        style={resolvedStyle}
        backgroundColor={resolvedBg}
        translucent
      />
      {withSpacer && (
        <View
          style={{
            height: statusBarHeight,
            backgroundColor: resolvedBg,
          }}
        />
      )}
    </>
  );
}
