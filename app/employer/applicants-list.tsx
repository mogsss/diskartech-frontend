import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const allApplicants = [
  { id: '1', name: 'Junnyl Mabini', position: 'Service Crew', status: 'pending', school: 'University of Santo Tomas', avatar: '' },
  { id: '2', name: 'Ana Santos', position: 'Barista', status: 'accepted', school: 'De La Salle University', avatar: '' },
  { id: '3', name: 'Carlos Reyes', position: 'Sales Associate', status: 'pending', school: 'Mapua University', avatar: '' },
  { id: '4', name: 'Maria Santos', position: 'Household Kasambahay', status: 'pending', school: 'Pinamalayan Institute', avatar: '' },
  { id: '5', name: 'Juan Dela Cruz', position: 'Family Driver', status: 'accepted', school: 'Mindoro State University', avatar: '' },
  { id: '6', name: 'John Doe', position: 'Service Crew', status: 'accepted', school: 'Ateneo de Manila University', avatar: '' },
];

export default function ApplicantsListScreen() {
  const { jobTitle } = useLocalSearchParams<{ jobTitle?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  // Filter logic: Kung may jobTitle, i-filter muna base roon, saka i-apply ang search at status filter
  const filteredApplicants = allApplicants.filter((app) => {
    const matchesJob = jobTitle ? app.position.toLowerCase() === jobTitle.toLowerCase() : true;
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          app.position.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedFilter.toLowerCase() === 'all' || app.status === selectedFilter.toLowerCase();

    return matchesJob && matchesSearch && matchesStatus;
  });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      {/* Header */}
      <View className="px-6 pt-12 pb-4 bg-white border-b border-gray-100">
        <View className="flex-row items-center mb-3">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-slate-900" numberOfLines={1}>
              {jobTitle ? `Applicants for ${jobTitle}` : 'All Applicants'}
            </Text>
            <Text className="text-xs text-slate-500">Manage and review job seekers</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 mt-2">
          <MaterialIcons name="search" size={20} color={Colors.gray400} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by name or position..."
            placeholderTextColor={Colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-sm text-slate-900"
          />
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mt-4 gap-2">
          {['All', 'Pending', 'Accepted', 'Rejected'].map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-full border ${
                selectedFilter === filter 
                  ? 'bg-red-600 border-red-600' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-sm font-semibold ${selectedFilter === filter ? 'text-white' : 'text-slate-600'}`}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List of Applicants */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {filteredApplicants.length > 0 ? (
          filteredApplicants.map((app) => (
            <TouchableOpacity
              key={app.id}
              className="flex-row bg-white rounded-2xl p-4 mb-3 shadow-sm items-center border border-gray-100"
              onPress={() => router.push(`/employer/applicant-details?name=${encodeURIComponent(app.name)}&position=${encodeURIComponent(app.position)}`)}
              activeOpacity={0.7}
            >
              <View className="mr-4">
                <Avatar uri={app.avatar} name={app.name} size={50} />
              </View>
              <View className="flex-1 justify-center">
                <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
                  {app.name}
                </Text>
                <Text className="text-xs text-red-600 font-semibold mt-0.5">{app.position}</Text>
                <Text className="text-xs text-slate-400 mt-1" numberOfLines={1}>{app.school}</Text>
              </View>
              <View className="items-end gap-2">
                <Badge
                  text={app.status === 'pending' ? 'Pending' : app.status === 'accepted' ? 'Accepted' : 'Rejected'}
                  variant={app.status === 'pending' ? 'warning' : app.status === 'accepted' ? 'success' : 'error'}
                />
                <MaterialIcons name="chevron-right" size={20} color={Colors.gray400} />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View className="items-center justify-center py-20">
            <MaterialIcons name="person-off" size={48} color={Colors.gray400} />
            <Text className="text-base font-semibold text-slate-700 mt-3">No applicants found</Text>
            <Text className="text-xs text-slate-400 mt-1">Try searching for a different keyword or filter.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}