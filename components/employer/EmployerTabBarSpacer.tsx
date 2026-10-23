import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const EMPLOYER_TAB_BAR_HEIGHT = 74;
export const EMPLOYER_POST_TAB_LIFT = 22;

export const getEmployerTabBarHeight = (bottomInset: number) =>
  EMPLOYER_TAB_BAR_HEIGHT + EMPLOYER_POST_TAB_LIFT + Math.max(bottomInset, 12) + 8;

/** Keeps the final item above the floating navigation and system controls. */
export default function EmployerTabBarSpacer() {
  const { bottom } = useSafeAreaInsets();
  return <View accessible={false} pointerEvents="none" style={{ height: getEmployerTabBarHeight(bottom) }} />;
}
