import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import JobCard from '@/components/ui/JobCard';
import CategoryCard from '@/components/ui/CategoryCard';
import SearchBar from '@/components/ui/SearchBar';
import { categories, jobs, featuredJobs, nearbyJobs, recommendedJobs, recentJobs } from '@/data/jobs';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null); // Pwedeng maging section name o category name

  const handleJobPress = (jobId: string) => {
    router.push(`/students/job-details?id=${jobId}`);
  };

  // Aling listahan ang ipapakita depende sa pinindot (See All sections o Category)
  let displayTitle = '';
  let displayJobs = [];

  if (activeFilter === 'featured') {
    displayTitle = 'Featured Jobs';
    displayJobs = featuredJobs;
  } else if (activeFilter === 'nearby') {
    displayTitle = 'Nearby Jobs';
    displayJobs = nearbyJobs;
  } else if (activeFilter === 'recommended') {
    displayTitle = 'Recommended For You';
    displayJobs = recommendedJobs;
  } else if (activeFilter === 'recent') {
    displayTitle = 'Recent Jobs';
    displayJobs = recentJobs;
  } else if (activeFilter === 'all_categories') {
    displayTitle = 'All Categories';
    displayJobs = jobs; // O pwede mong gawan ng sariling view para sa categories list kung gusto mo
  } else if (activeFilter && activeFilter.startsWith('cat_')) {
    // Kung kategorya ang pinindot (halimbawa: Food Service)
    const categoryName = activeFilter.replace('cat_', '');
    displayTitle = `${categoryName} Jobs`;
    displayJobs = jobs.filter((job) => job.category.toLowerCase() === categoryName.toLowerCase());
  }

  const renderHeader = () => (
    <View>
      {/* Greeting */}
      <View className="flex-row justify-between items-center px-6 pt-12 pb-4">
        <View>
          <Text className="text-2xl font-bold text-slate-900">Hello, Junnyl 👋</Text>
          <Text className="text-xs text-slate-500 mt-[2px]">Find your perfect student job today!</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications')}>
          <View className="relative p-2">
            <MaterialIcons name="notifications" size={24} color={Colors.text} />
            <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-600 border-[1.5px] border-[#F8FAFC]" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-6 mb-4">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFilter={() => {}}
        />
      </View>

      {/* Categories (Ipakita lang kung walang active filter) */}
      {!activeFilter && (
        <>
          <View className="flex-row justify-between items-center px-6 mt-4 mb-2">
            <Text className="text-lg font-bold text-slate-900">Categories</Text>
            <TouchableOpacity onPress={() => setActiveFilter('all_categories')}>
              <Text className="text-sm font-semibold text-red-600">See All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            renderItem={({ item }) => (
              <CategoryCard
                name={item.name}
                icon={item.icon as any}
                count={item.count}
                color={item.color}
                onPress={() => setActiveFilter(`cat_${item.name}`)} // Dito natin ikinabit ang pagpindot sa kategorya
              />
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pl-6 mb-2"
          />
        </>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-10"
      >
        {renderHeader()}

        {/* Kung may pinindot na See All o Category, ito ang magpapakita */}
        {activeFilter ? (
          <View className="px-6 mt-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-bold text-slate-900">{displayTitle}</Text>
              <TouchableOpacity 
                onPress={() => setActiveFilter(null)}
                className="bg-gray-200 px-4 py-2 rounded-full"
              >
                <Text className="text-xs font-semibold text-slate-700">Back</Text>
              </TouchableOpacity>
            </View>

            {displayJobs.length > 0 ? (
              displayJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onPress={() => handleJobPress(job.id)}
                  onBookmark={() => {}}
                  onApply={() => router.push(`/students/job-details?id=${job.id}`)}
                />
              ))
            ) : (
              <Text className="text-slate-500 text-center mt-10">No jobs found in this category.</Text>
            )}
          </View>
        ) : (
          /* Normal Home View (Kapag walang pinipili) */
          <>
            {/* Featured Jobs */}
            <View className="flex-row justify-between items-center px-6 mt-4 mb-2">
              <Text className="text-lg font-bold text-slate-900">Featured Jobs</Text>
              <TouchableOpacity onPress={() => setActiveFilter('featured')}>
                <Text className="text-sm font-semibold text-red-600">See All</Text>
              </TouchableOpacity>
            </View>
            {featuredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                variant="featured"
                onPress={() => handleJobPress(job.id)}
                onBookmark={() => {}}
                onApply={() => router.push(`/students/job-details?id=${job.id}`)}
              />
            ))}

            {/* Nearby Jobs */}
            <View className="flex-row justify-between items-center px-6 mt-4 mb-2">
              <Text className="text-lg font-bold text-slate-900">Nearby Jobs</Text>
              <TouchableOpacity onPress={() => setActiveFilter('nearby')}>
                <Text className="text-sm font-semibold text-red-600">See All</Text>
              </TouchableOpacity>
            </View>
            {nearbyJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                variant="compact"
                onPress={() => handleJobPress(job.id)}
              />
            ))}

            {/* Recommended Jobs */}
            <View className="flex-row justify-between items-center px-6 mt-4 mb-2">
              <Text className="text-lg font-bold text-slate-900">Recommended For You</Text>
              <TouchableOpacity onPress={() => setActiveFilter('recommended')}>
                <Text className="text-sm font-semibold text-red-600">See All</Text>
              </TouchableOpacity>
            </View>
            {recommendedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPress={() => handleJobPress(job.id)}
                onBookmark={() => {}}
                onApply={() => router.push(`/students/job-details?id=${job.id}`)}
              />
            ))}

            {/* Recent Jobs */}
            <View className="flex-row justify-between items-center px-6 mt-4 mb-2">
              <Text className="text-lg font-bold text-slate-900">Recent Jobs</Text>
              <TouchableOpacity onPress={() => setActiveFilter('recent')}>
                <Text className="text-sm font-semibold text-red-600">See All</Text>
              </TouchableOpacity>
            </View>
            {recentJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                variant="compact"
                onPress={() => handleJobPress(job.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}