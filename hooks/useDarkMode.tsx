import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme as nwColorScheme } from 'nativewind';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  /** Brand foreground for icons and text, matching the primary action color. */
  accent: string;
}

interface DarkModeContextType {
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
  colors: ThemeColors;
}

const THEME_STORAGE_KEY = '@diskartech_theme_mode';

const DarkModeContext = createContext<DarkModeContextType>({
  isDark: false,
  themeMode: 'system',
  setThemeMode: async () => {},
  setDarkMode: async () => {},
  toggleDarkMode: async () => {},
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    primary: '#DC2626',
    accent: '#DC2626',
  },
});

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch (err) {
        console.warn('Failed to load theme preference from storage:', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Compute if currently dark
  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  // Synchronize with NativeWind
  useEffect(() => {
    try {
      if (themeMode === 'system') {
        nwColorScheme.set('system');
      } else {
        nwColorScheme.set(isDark ? 'dark' : 'light');
      }
    } catch {
      // In case NativeWind is operating in media mode or SSR
    }
  }, [isDark, themeMode]);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to save theme preference:', err);
    }
  };

  const setDarkMode = async (enabled: boolean) => {
    await setThemeMode(enabled ? 'dark' : 'light');
  };

  const toggleDarkMode = async () => {
    await setDarkMode(!isDark);
  };

  const colors = useMemo<ThemeColors>(() => {
    return isDark
      ? {
          background: '#0F172A',
          surface: '#1E293B',
          card: '#1E293B',
          text: '#F8FAFC',
          textSecondary: '#94A3B8',
          border: '#334155',
          primary: '#DC2626',
          accent: '#DC2626',
        }
      : {
          background: '#F8FAFC',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          text: '#0F172A',
          textSecondary: '#64748B',
          border: '#E2E8F0',
          primary: '#DC2626',
          accent: '#DC2626',
        };
  }, [isDark]);

  const value = useMemo(
    () => ({
      isDark,
      themeMode,
      setThemeMode,
      setDarkMode,
      toggleDarkMode,
      colors,
    }),
    [isDark, themeMode, colors]
  );

  return <DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>;
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}

export default useDarkMode;
