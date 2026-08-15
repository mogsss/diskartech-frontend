import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const defaultSchedule = days.map((day) => ({
  day,
  jobs: [
    { id: '1', title: 'Service Crew', time: '4:00 PM - 8:00 PM', company: "McDonald's" },
  ],
  hasConflict: day === 'Wednesday',
}));

export default function ScheduleScreen() {
  const [schedule] = useState(defaultSchedule);
  const [conflictResolved, setConflictResolved] = useState(false);

  const handleConflict = (resolve: boolean) => {
    setConflictResolved(resolve);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-4"
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-slate-900">My Schedule</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="p-6 pb-10">
        {schedule.map((day) => (
          <View 
            key={day.day} 
            className={`bg-white rounded-2xl p-4 mb-4 shadow-sm ${day.hasConflict ? 'border-l-4 border-l-[#FF9800]' : ''}`}
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-slate-900">{day.day}</Text>
              {day.hasConflict && (
                <View className="flex-row items-center gap-1 bg-[#FF9800] px-2.5 py-1 rounded-full">
                  <MaterialIcons name="warning" size={16} color={Colors.white} />
                  <Text className="text-[10px] font-semibold text-white uppercase">Conflict</Text>
                </View>
              )}
            </View>
            {day.jobs.map((job) => (
              <View key={job.id} className="flex-row items-start gap-4 mb-3">
                <View className="w-2.5 h-2.5 rounded-full bg-red-600 mt-1.5" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{job.title}</Text>
                  <Text className="text-xs text-slate-500">{job.company}</Text>
                  <Text className="text-xs text-slate-400 mt-0.5">{job.time}</Text>
                </View>
              </View>
            ))}
            {day.hasConflict && !conflictResolved && (
              <View style={{ backgroundColor: '#FF980010' }} className="rounded-xl p-4 mt-3">
                <Text className="text-sm font-semibold text-[#FF9800] mb-1">AI Conflict Detection</Text>
                <Text className="text-xs text-slate-500 mb-3">This job overlaps with your existing schedule. What would you like to do?</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity className="flex-row items-center gap-1 bg-red-600 px-4 py-2 rounded-xl" onPress={() => handleConflict(true)}>
                    <MaterialIcons name="block" size={18} color={Colors.white} />
                    <Text className="text-xs font-semibold text-white">Block Job</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-row items-center gap-1 bg-emerald-600 px-4 py-2 rounded-xl" onPress={() => handleConflict(true)}>
                    <MaterialIcons name="check-circle" size={18} color={Colors.white} />
                    <Text className="text-xs font-semibold text-white">Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {day.hasConflict && conflictResolved && (
              <View className="flex-row items-center gap-1 mt-3">
                <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                <Text className="text-xs font-semibold text-emerald-600">Conflict Resolved</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}