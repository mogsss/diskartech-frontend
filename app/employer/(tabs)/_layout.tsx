import { Colors } from '@/constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { router, Tabs, useGlobalSearchParams } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

export default function EmployerTabLayout() {
  const { type } = useGlobalSearchParams<{ type?: string }>();
  const queryParam = type ? `?type=${type}` : '';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#DC2626',
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: Platform.OS === 'ios' ? 85 : 60,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
        initialParams={{ type }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="work" size={size} color={color} />
          ),
        }}
        initialParams={{ type }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="chat" size={size} color={color} />
          ),
        }}
        initialParams={{ type }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
        initialParams={{ type }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push(`/employer/profile${queryParam}` as any);
          },
        }}
      />
    </Tabs>
  );
}