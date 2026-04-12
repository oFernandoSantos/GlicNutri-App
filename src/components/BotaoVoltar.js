import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../theme/patientTheme';

export default function BotaoVoltar({
  navigation,
  onPress,
  fallbackRoute,
  fallbackParams,
  label = 'Voltar',
  iconName = 'chevron-back-outline',
  showIcon = true,
  variant = 'default',
  style,
  textStyle,
  iconColor,
  disabled = false,
}) {
  const isPrimary = variant === 'primary';
  const textColor = isPrimary ? patientTheme.colors.onPrimary : patientTheme.colors.text;
  const resolvedIconColor = iconColor || textColor;

  function handlePress() {
    if (disabled) return;

    if (typeof onPress === 'function') {
      onPress();
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
      {showIcon ? (
        <Ionicons name={iconName} size={20} color={resolvedIconColor} />
      ) : null}
      <Text
        style={[
          styles.text,
          isPrimary && styles.primaryText,
          showIcon && styles.textWithIcon,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minHeight: 40,
    minWidth: 92,
    paddingHorizontal: 14,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  primaryButton: {
    alignSelf: 'stretch',
    minHeight: 52,
    marginTop: 24,
    backgroundColor: patientTheme.colors.primary,
    borderWidth: 0,
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 16,
  },
  textWithIcon: {
    marginLeft: 4,
  },
});
