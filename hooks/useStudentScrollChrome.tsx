import React, { createContext, useContext, useMemo } from 'react';
import { DerivedValue, SharedValue, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

interface StudentScrollChrome {
  hidden: SharedValue<number>;
  progress: DerivedValue<number>;
}

const StudentScrollChromeContext = createContext<StudentScrollChrome | null>(null);

export function StudentScrollChromeProvider({ children }: { children: React.ReactNode }) {
  const hidden = useSharedValue(0);
  const progress = useDerivedValue(() => withTiming(hidden.value, { duration: 180 }));
  const value = useMemo(() => ({ hidden, progress }), [hidden, progress]);

  return (
    <StudentScrollChromeContext.Provider value={value}>
      {children}
    </StudentScrollChromeContext.Provider>
  );
}

export function useStudentScrollChrome() {
  const chrome = useContext(StudentScrollChromeContext);
  if (!chrome) throw new Error('Student scroll chrome requires its provider.');
  return chrome;
}
