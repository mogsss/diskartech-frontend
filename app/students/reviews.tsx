import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

const reviews = [
  { id: '1', employerName: "McDonald's SM North", rating: 4.5, comment: 'Great workplace! Very understanding of student schedules. Flexible hours and free meals.', date: '2 weeks ago' },
  { id: '2', employerName: 'Starbucks BGC', rating: 5, comment: 'Excellent training program. Learned a lot about coffee and customer service. Highly recommended!', date: '1 month ago' },
  { id: '3', employerName: '7-Eleven Katipunan', rating: 3.5, comment: 'Good for night shift students. Decent pay but can be busy during peak hours.', date: '2 months ago' },
  { id: '4', employerName: 'Grab PH', rating: 4, comment: 'Very flexible. Perfect for students who have their own motorcycle. Good earnings.', date: '3 months ago' },
];

const renderStars = (rating: number) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <MaterialIcons key={i} name={i <= Math.floor(rating) ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-border'} size={16} color="#FFB300" />
    );
  }
  return stars;
};

export default function ReviewsScreen() {
  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 pt-12 pb-4 bg-white">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-slate-900">My Reviews</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        {reviews.map((review) => (
          <View key={review.id} className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <View className="flex-row items-center mb-3">
              <View 
                style={{ backgroundColor: Colors.primary + '15' }}
                className="w-11 h-11 rounded-full items-center justify-center mr-4"
              >
                <Text className="text-xl font-bold text-red-600">{review.employerName[0]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">{review.employerName}</Text>
                <View className="flex-row gap-[2px] mt-1">{renderStars(review.rating)}</View>
              </View>
              <Text className="text-xl font-bold text-[#FFB300]">{review.rating}</Text>
            </View>
            <Text className="text-sm text-slate-500 italic leading-5 mb-3">"{review.comment}"</Text>
            <Text className="text-xs text-slate-400">{review.date}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}