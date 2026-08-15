import PrimaryButton from '@/components/ui/PrimaryButton';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Text,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: 'school',
    title: 'Find Flexible Jobs',
    subtitle: 'Discover part-time jobs that fit your school schedule. Work around your classes!',
    color: '#D32F2F',
    bgColor: '#FFEBEE',
  },
  {
    id: '2',
    icon: 'verified-user',
    title: 'Verified Employers',
    subtitle: 'Apply safely to trusted employers near you. All employers are verified for your safety.',
    color: '#121212',
    bgColor: '#F5F5F5',
  },
  {
    id: '3',
    icon: 'stars',
    title: 'Earn While You Learn',
    subtitle: 'Gain experience, build your resume, and earn money while pursuing your education.',
    color: '#D32F2F',
    bgColor: '#FFEBEE',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/auth/welcome');
    }
  };

  const handleSkip = () => {
    router.replace('/auth/welcome');
  };

  const renderSlide = ({ item }: { item: typeof slides[0] }) => (
    <View style={{ width }} className="flex-1 items-center justify-center px-10">
      <View 
        style={{ backgroundColor: item.bgColor }} 
        className="w-[180px] h-[180px] rounded-[90px] items-center justify-center mb-8 shadow-lg"
      >
        <MaterialIcons name={item.icon as any} size={80} color={item.color} />
      </View>
      <Text className="text-3xl font-bold text-slate-900 text-center mb-3">{item.title}</Text>
      <Text className="text-base text-slate-500 text-center leading-6 px-4">{item.subtitle}</Text>
    </View>
  );

  const dotOpacity = scrollX.interpolate({
    inputRange: [0, width, width * 2],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    <View className="flex-1 bg-white">
      {/* Skip button */}
      <Animated.View style={{ opacity: dotOpacity }} className="absolute top-[60px] right-6 z-10">
        <Text onPress={handleSkip} className="text-base font-semibold text-slate-500">
          Skip
        </Text>
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        bounces={false}
        keyExtractor={(item) => item.id}
      />

      {/* Bottom section */}
      <View className="px-10 pb-12">
        {/* Dots */}
        <View className="flex-row justify-center items-center mb-8 gap-[6px]">
          {slides.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 32, 8],
              extrapolate: 'clamp',
            });
            const dotOpacityAnim = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={index}
                style={[
                  {
                    width: dotWidth,
                    opacity: dotOpacityAnim,
                    backgroundColor: currentIndex === index ? Colors.primary : Colors.gray300,
                  },
                ]}
                className="h-2 rounded-full"
              />
            );
          })}
        </View>

        {/* Button */}
        <View className="mb-4">
          <PrimaryButton
            title={currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            onPress={handleNext}
            size="large"
            icon={
              <MaterialIcons
                name="arrow-forward"
                size={20}
                color={Colors.white}
              />
            }
          />
        </View>
      </View>
    </View>
  );
}