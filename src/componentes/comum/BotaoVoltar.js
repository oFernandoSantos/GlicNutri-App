import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

const BACK_ICON_PNG_URL =
  'https://img.icons8.com/ios-glyphs/60/4fdfa3/chevron-left.png';

export default function BotaoVoltar({
  navigation,
  onPress,
  fallbackRoute,
  fallbackParams,
  label = 'Voltar',
  variant = 'default',
  style,
  textStyle,
  disabled = false,
  preferFallback = false,
}) {
  const isPrimary = variant === 'primary';

  function handlePress() {
    if (disabled) return;

    if (typeof onPress === 'function') {
      onPress();
      return;
    }

    if (preferFallback && fallbackRoute && navigation?.navigate) {
      navigation.navigate(fallbackRoute, fallbackParams);
      return;
    }

    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    if (fallbackRoute && navigation?.navigate) {
      navigation.navigate(fallbackRoute, fallbackParams);
      return;
    }

    navigation?.goBack?.();
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.78}
      disabled={disabled}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      onPress={handlePress}
      style={[
        styles.button,
        isPrimary && styles.primaryButton,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={{ uri: BACK_ICON_PNG_URL }}
        style={[
          styles.icon,
          textStyle,
        ]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    height: 40,
    width: 40,
    padding: 0,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#f4f4f4',
    borderWidth: 1,
    borderColor: '#f4f4f4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  primaryButton: {
    height: 52,
    width: 52,
    marginTop: 24,
    backgroundColor: patientTheme.colors.primary,
    borderWidth: 0,
  },
  disabled: {
    opacity: 0.55,
  },
  icon: {
    height: 18,
    width: 18,
  },
});
