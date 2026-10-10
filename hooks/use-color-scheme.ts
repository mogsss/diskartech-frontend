import { useDarkMode } from './useDarkMode';
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' {
  try {
    const { isDark } = useDarkMode();
    return isDark ? 'dark' : 'light';
  } catch {
    const rn = useRNColorScheme();
    return rn === 'dark' ? 'dark' : 'light';
  }
}

export default useColorScheme;
