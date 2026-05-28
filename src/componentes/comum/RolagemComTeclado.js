import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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

/** Espaço extra no fim do scroll enquanto o teclado está aberto. */
export function useKeyboardBottomInset(basePadding = 32) {
  const [paddingBottom, setPaddingBottom] = useState(basePadding);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = Number(event?.endCoordinates?.height || 0);
      setPaddingBottom(Math.max(basePadding, height + basePadding));
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setPaddingBottom(basePadding);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
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
      behavior={
        behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height')
      }
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * ScrollView com ajuste para teclado (Android + iOS).
 * Use em telas que não passam pelo LayoutPaciente/LayoutNutricionista.
 */
/** ScrollView para modais com campos de texto (cadastros, formulários). */
export function RolagemModalTeclado({
  children,
  style,
  contentContainerStyle,
  keyboardBottomBase = 24,
  ...scrollProps
}) {
  const keyboardPadding = useKeyboardBottomInset(keyboardBottomBase);

  return (
    <WrapperTeclado
      enabled={Platform.OS !== 'web'}
      style={styles.modalWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={style}
        contentContainerStyle={[
          { paddingBottom: keyboardPadding },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        nestedScrollEnabled
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </WrapperTeclado>
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
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
  modalWrap: {
    flexGrow: 0,
    maxHeight: '100%',
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
});
