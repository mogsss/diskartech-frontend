import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

// Animated style objects must reach Reanimated without being flattened by NativeWind.
// Use cssInterop={false} and native styles for these animation containers.
export const AnimatedView = Animated.View;

export const AnimatedFlatList = cssInterop(Animated.FlatList, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
}) as typeof Animated.FlatList;
