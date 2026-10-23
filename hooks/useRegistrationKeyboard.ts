import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, TextInput } from 'react-native';
import type { ScrollViewProps } from 'react-native';

export function useRegistrationKeyboard<Field extends string>() {
  const formScrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Partial<Record<Field, TextInput | null>>>({});
  const focusedInput = useRef<Field | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const frame = useRef<number | null>(null);

  const scrollToActiveInput = useCallback(() => {
    const field = focusedInput.current;
    if (field === null) return;
    const input = inputRefs.current[field];
    const scroll = formScrollRef.current;
    const viewport = scroll?.getNativeScrollRef();
    if (!input || !scroll || !viewport) return;

    // Measure both views in window coordinates: the form starts below the
    // status bar and Android may already have resized it above the keyboard.
    viewport.measureInWindow((_x: number, viewportY: number, _width: number, viewportHeight: number) => {
      input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
        if (focusedInput.current !== field || inputRefs.current[field] !== input || viewportHeight <= 0 || inputHeight <= 0) return;
        const keyboardY = Keyboard.metrics?.()?.screenY ?? keyboardTop.current ?? Infinity;
        const visibleBottom = Math.min(viewportY + viewportHeight, keyboardY);
        const below = inputY + inputHeight + 24 - visibleBottom;
        const above = inputY - viewportY - 24;
        if (below > 0) scroll.scrollTo({ y: Math.max(0, scrollY.current + below), animated: true });
        else if (above < 0) scroll.scrollTo({ y: Math.max(0, scrollY.current + above), animated: true });
      });
    });
  }, []);

  const scheduleScroll = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      scrollToActiveInput();
    });
  }, [scrollToActiveInput]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      scheduleScroll();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboardTop.current = null; });
    return () => {
      show.remove();
      hide.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [scheduleScroll]);

  const resetKeyboard = useCallback(() => {
    focusedInput.current = null;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    Keyboard.dismiss();
  }, []);

  const inputNavigation = (field: Field, next?: Field | (() => void)) => ({
    inputRef: (input: TextInput | null) => { inputRefs.current[field] = input; },
    onFocus: () => {
      focusedInput.current = field;
      scrollToActiveInput();
    },
    returnKeyType: next ? 'next' as const : 'done' as const,
    submitBehavior: next ? 'submit' as const : 'blurAndSubmit' as const,
    onSubmitEditing: () => {
      if (typeof next === 'string') inputRefs.current[next]?.focus();
      else { resetKeyboard(); next?.(); }
    },
  });

  const formScrollProps: Pick<ScrollViewProps, 'onScroll' | 'onLayout' | 'onContentSizeChange' | 'scrollEventThrottle'> = {
    onScroll: event => { scrollY.current = event.nativeEvent.contentOffset.y; },
    onLayout: scheduleScroll,
    onContentSizeChange: scheduleScroll,
    scrollEventThrottle: 16,
  };

  return { formScrollRef, formScrollProps, inputNavigation, resetKeyboard };
}
