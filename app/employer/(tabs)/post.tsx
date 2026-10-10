import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

// Also route direct links to the existing form and its verification check.
export default function PostJobTab() {
  const { type } = useLocalSearchParams<{ type?: string }>();

  return (
    <Redirect
      href={{
        pathname: '/employer/job-posting',
        params: { type: type === 'household' ? 'household' : 'business' },
      }}
    />
  );
}
