import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const READER_HEADER_HEIGHT = 58;
export const READER_HEADER_TOAST_GAP = 8;

/** Posicao Y do toast flutuante logo abaixo do CabecalhoLeitor. */
export function getToastTopAbaixoHeaderLeitor(insets = {}) {
  if (Platform.OS === 'web') {
    return READER_HEADER_HEIGHT + READER_HEADER_TOAST_GAP;
  }

  return READER_HEADER_TOAST_GAP;
}

export function getKeyboardVerticalOffset(insets = {}) {
  if (Platform.OS === 'web') {
    return 0;
  }

  return (insets.top || 0) + READER_HEADER_HEIGHT;
}

function subscribeKeyboardHeight(onHeight) {
  const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
  const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

  const showSub = Keyboard.addListener(showEvent, (event) => {
    onHeight(Number(event?.endCoordinates?.height || 0));
  });

  const hideSub = Keyboard.addListener(hideEvent, () => {
    onHeight(0);
  });

  return () => {
    showSub.remove();
    hideSub.remove();
  };
}

/** Altura atual do teclado (0 quando fechado). */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => subscribeKeyboardHeight(setHeight), []);

  return height;
}

function getAlturaUtilModal(keyboardHeight, insets, extraReserva = 100) {
  const windowHeight = Dimensions.get('window').height;
  const top = insets.top || 0;
  const bottom = insets.bottom || 0;

  if (!keyboardHeight) {
    return null;
  }

  return Math.max(
    200,
    windowHeight - keyboardHeight - top - bottom - extraReserva
  );
}

/** Espaço extra no fim do scroll enquanto o teclado está aberto. */
export function useKeyboardBottomInset(basePadding = 32) {
  const [paddingBottom, setPaddingBottom] = useState(basePadding);

  useEffect(() => {
    return subscribeKeyboardHeight((height) => {
      setPaddingBottom(height ? Math.max(basePadding, height + basePadding) : basePadding);
    });
  }, [basePadding]);

  return paddingBottom;
}

export function WrapperTeclado({
  children,
  style,
  keyboardVerticalOffset,
  enabled = true,
  behavior,
}) {
  const insets = useSafeAreaInsets();
  const offset =
    typeof keyboardVerticalOffset === 'number'
      ? keyboardVerticalOffset
      : getKeyboardVerticalOffset(insets);

  if (!enabled || Platform.OS === 'web') {
    return <>{children}</>;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : 'padding')}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/** ScrollView para modais com campos de texto (cadastros, formulários). */
export function RolagemModalTeclado({
  children,
  style,
  contentContainerStyle,
  keyboardBottomBase = 40,
  ...scrollProps
}) {
  const keyboardPadding = useKeyboardBottomInset(keyboardBottomBase);
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const alturaScroll = getAlturaUtilModal(keyboardHeight, insets, 160);

  return (
    <ScrollView
      style={[
        styles.modalScroll,
        style,
        alturaScroll ? { maxHeight: alturaScroll } : null,
      ]}
      contentContainerStyle={[
        styles.modalScrollContent,
        keyboardHeight ? { paddingBottom: keyboardPadding } : null,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      nestedScrollEnabled
      {...scrollProps}
    >
      {children}
    </ScrollView>
  );
}

export function RolagemComTeclado({
  children,
  style,
  contentContainerStyle,
  keyboardBottomBase = 32,
  keyboardVerticalOffset,
  keyboardEnabled = true,
  scrollViewRef,
  ...scrollProps
}) {
  const keyboardPadding = useKeyboardBottomInset(keyboardBottomBase);

  return (
    <WrapperTeclado
      style={styles.flex}
      keyboardVerticalOffset={keyboardVerticalOffset}
      enabled={keyboardEnabled}
    >
      <ScrollView
        ref={scrollViewRef}
        style={[styles.flex, style]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardPadding },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        nestedScrollEnabled
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </WrapperTeclado>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minHeight: 0,
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
