import JobCard from '@/components/ui/JobCard';
import SearchBar from '@/components/ui/SearchBar';
import Chip from '@/components/ui/Chip';
import { Colors } from '@/constants/colors';
import { jobs } from '@/data/jobs';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const salaryFilters = ['₱50-₱75/hr', '₱75-₱100/hr', '₱100-₱150/hr', '₱150+/hr'];
const distanceFilters = ['< 1 km', '< 3 km', '< 5 km', 'Any'];
const scheduleFilters = ['Flexible', 'Morning', 'Evening', 'Midnight', 'Weekends'];

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // States para sa mga karagdagang filters
  const [selectedSalary, setSelectedSalary] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);

  // Pinagsamang filtering logic
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = searchQuery
      ? job.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.location.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesCategory = selectedCategory
      ? job.category.toLowerCase() === selectedCategory.toLowerCase()
      : true;

    const matchesSchedule = selectedSchedule
      ? job.schedule.toLowerCase().includes(selectedSchedule.toLowerCase())
      : true;

    return matchesSearch && matchesCategory && matchesSchedule;
  });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <View className="px-6 pt-12 pb-4">
        <Text className="text-2xl font-bold text-slate-900">Find Jobs</Text>
      </View>

      <View className="px-6 mb-2">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilter={() => setShowFilters(!showFilters)}
        />
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 mb-2"
        contentContainerClassName="px-6 gap-2"
      >
        {['All', 'Food Service', 'Retail', 'Tutoring', 'Delivery', 'Admin', 'Freelance'].map(
          (cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={selectedCategory === cat || (cat === 'All' && !selectedCategory)}
              onPress={() => setSelectedCategory(cat === 'All' ? null : cat)}
            />
          )
        )}
      </ScrollView>

      {/* Filters Section */}
      {showFilters && (
        <View className="bg-white mx-6 rounded-2xl p-4 mb-2 shadow-sm">
          {/* Salary Range */}
          <Text className="text-xs font-bold text-slate-900 mb-2 mt-2 uppercase tracking-wider">Salary Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-2">
            {salaryFilters.map((f) => {
              const isSelected = selectedSalary === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedSalary(isSelected ? null : f)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Distance */}
          <Text className="text-xs font-bold text-slate-900 mb-2 mt-2 uppercase tracking-wider">Distance</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-2">
            {distanceFilters.map((f) => {
              const isSelected = selectedDistance === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedDistance(isSelected ? null : f)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Schedule */}
          <Text className="text-xs font-bold text-slate-900 mb-2 mt-2 uppercase tracking-wider">Schedule</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerClassName="gap-2">
            {scheduleFilters.map((f) => {
              const isSelected = selectedSchedule === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setSelectedSchedule(isSelected ? null : f)}
                  className={`px-4 py-2 rounded-full border ${
                    isSelected ? 'bg-red-600 border-red-600' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Results */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-6 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs text-slate-500 mb-4">{filteredJobs.length} jobs found</Text>
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onPress={() => router.push(`/students/job-details?id=${job.id}`)}
              onBookmark={() => {}}
              onApply={() => router.push(`/students/job-details?id=${job.id}`)}
            />
          ))
        ) : (
          <Text className="text-slate-400 text-center py-8">No jobs found matching your criteria.</Text>
        )}
      </ScrollView>
    </View>
  );
}