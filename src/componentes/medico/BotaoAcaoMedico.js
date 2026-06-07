import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { medicoTheme } from '../../temas/temaVisualNutricionista';

export const medicoActionColors = {
  normal: '#278EF5',
  pressed: '#1D6FCC',
  hover: '#2080E0',
};

export function getMedicoActionButtonStyle(compact = false) {
  return {
    minHeight: compact ? 32 : 44,
    borderRadius: medicoTheme.radius.pill,
    paddingHorizontal: compact ? 12 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: compact ? 6 : 8,
    backgroundColor: medicoActionColors.normal,
  };
}

export default function BotaoAcaoMedico({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  compact = false,
  iconOnly = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.button,
        compact && styles.buttonCompact,
        iconOnly && styles.buttonIconOnly,
        (pressed || (Platform.OS === 'web' && hovered)) && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={medicoTheme.colors.onPrimary} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              name={icon}
              size={compact || iconOnly ? 16 : 18}
              color={medicoTheme.colors.onPrimary}
            />
          ) : null}
          {!iconOnly && label ? (
            <Text style={[styles.text, compact && styles.textCompact, textStyle]}>{label}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    ...getMedicoActionButtonStyle(false),
    alignSelf: 'stretch',
  },
  buttonCompact: {
    ...getMedicoActionButtonStyle(true),
    alignSelf: 'flex-start',
  },
  buttonIconOnly: {
    width: 44,
    height: 44,
    minHeight: 44,
    paddingHorizontal: 0,
    alignSelf: 'flex-end',
  },
  buttonPressed: {
    backgroundColor: medicoActionColors.pressed,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: medicoTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  textCompact: {
    fontSize: 11,
    fontWeight: '700',
  },
});
