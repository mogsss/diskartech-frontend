import { useRef } from 'react';
import { findNodeHandle, Keyboard, TextInput } from 'react-native';
import type { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

type JobPostingInput = 'title' | 'description' | 'salary' | 'category' | 'requirements' | 'skills';

export function useJobPostingKeyboard() {
  const inputs = useRef<Partial<Record<JobPostingInput, TextInput | null>>>({});
  const formScrollRef = useRef<KeyboardAwareScrollView>(null);

  const inputNavigation = (field: JobPostingInput, next?: JobPostingInput) => ({
    inputRef: (input: TextInput | null) => { inputs.current[field] = input; },
    onFocus: () => {
      const input = inputs.current[field];
      const node = input ? findNodeHandle(input) : null;
      // Focus can move without another keyboardDidShow event (Next or a direct tap).
      if (node !== null) formScrollRef.current?.scrollToFocusedInput(node, 24, 0);
    },
    returnKeyType: next ? 'next' as const : 'done' as const,
    submitBehavior: next ? 'submit' as const : 'blurAndSubmit' as const,
    onSubmitEditing: () => {
      const nextInput = next ? inputs.current[next] : null;
      if (nextInput) nextInput.focus();
      else Keyboard.dismiss();
    },
  });

  return { inputNavigation, formScrollRef };
}

export type JobPostingInputNavigation = ReturnType<typeof useJobPostingKeyboard>['inputNavigation'];
export type JobPostingInputProps = ReturnType<JobPostingInputNavigation>;
