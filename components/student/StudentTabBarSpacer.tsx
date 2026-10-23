import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const STUDENT_TAB_BAR_HEIGHT = 74;
export const STUDENT_SEARCH_TAB_LIFT = 22;

export const getStudentTabBarHeight = (bottomInset: number) =>
  STUDENT_TAB_BAR_HEIGHT + STUDENT_SEARCH_TAB_LIFT + Math.max(bottomInset, 12) + 8;

/** Lets the last scrollable item clear the floating navigation and system controls. */
export default function StudentTabBarSpacer() {
  const { bottom } = useSafeAreaInsets();

  return <View accessible={false} pointerEvents="none" style={{ height: getStudentTabBarHeight(bottom) }} />;
}
