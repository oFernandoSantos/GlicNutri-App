import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function useKeyboardAwareScroll({ topOffset = 120, delay } = {}) {
  const scrollViewRef = useRef(null);
  const containerYRef = useRef(0);
  const fieldsYRef = useRef({});
  const scrollTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    },
    []
  );

  const registerScrollContainer = useCallback((event) => {
    containerYRef.current = event?.nativeEvent?.layout?.y || 0;
  }, []);

  const registerFieldLayout = useCallback(
    (campo) => (event) => {
      fieldsYRef.current[campo] = event?.nativeEvent?.layout?.y || 0;
    },
    []
  );

  const scrollToField = useCallback(
    (campo, options = {}) => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }

      const wait =
        options.delay ??
        delay ??
        (Platform.OS === 'ios'
          ? 340
          : Platform.OS === 'android'
            ? 220
            : Platform.OS === 'web'
              ? 260
              : 80);

      scrollTimerRef.current = setTimeout(() => {
        const fieldY = fieldsYRef.current[campo];
        const scrollView = scrollViewRef.current;

        if (typeof fieldY !== 'number' || !scrollView?.scrollTo) {
          return;
        }

        const targetY = Math.max(
          containerYRef.current + fieldY - (options.topOffset ?? topOffset),
          0
        );

        scrollView.scrollTo({ y: targetY, animated: true });
      }, wait);
    },
    [delay, topOffset]
  );

  return {
    scrollViewRef,
    registerScrollContainer,
    registerFieldLayout,
    scrollToField,
  };
}
