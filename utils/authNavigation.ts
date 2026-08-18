import { router } from 'expo-router';

export const redirectUserByRole = (role: string) => {
  if (role === 'student') {
    router.replace('/students/(tabs)/home');
  } else if (role === 'employer') {
    router.replace('/employer/(tabs)/dashboard?type=business');
  } else if (role === 'household') {
    router.replace('/employer/(tabs)/dashboard?type=household');
  } else {
    // Fallback kung sakaling may ibang role
    router.replace('/'); 
  }
};