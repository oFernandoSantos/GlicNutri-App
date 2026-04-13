import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { inputFocusBorder, inputWebFocusReset } from '../theme/inputFocusTheme';

let webPasswordStyleInjected = false;

function injectWebPasswordStyle() {
  if (
    webPasswordStyleInjected ||
    Platform.OS !== 'web' ||
    typeof document === 'undefined'
  ) {
    return;
  }

  const styleId = 'glicnutri-campo-senha-hide-native-reveal';

  if (document.getElementById(styleId)) {
    webPasswordStyleInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    input[type="password"]::-webkit-contacts-auto-fill-button,
    input[type="password"]::-webkit-credentials-auto-fill-button,
    input::-ms-reveal,
    input::-ms-clear {
      display: none !important;
      height: 0 !important;
      margin: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
      visibility: hidden !important;
      width: 0 !important;
    }
  `;
  document.head.appendChild(style);
  webPasswordStyleInjected = true;
}

export default function CampoSenha({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = '#999',
  wrapperStyle,
  inputStyle,
  toggleStyle,
  invalid = false,
  invalidStyle,
  eyeColor = '#6B7280',
  autoCapitalize = 'none',
  autoComplete = 'password',
  autoCorrect = false,
  textContentType = 'password',
  secureTextEntry: _secureTextEntry,
  focusedStyle,
  ...textInputProps
}) {
  const [visivel, setVisivel] = useState(false);
  const [focado, setFocado] = useState(false);
  const editable = textInputProps.editable !== false;

  useEffect(() => {
    injectWebPasswordStyle();
  }, []);

  useEffect(() => {
    if (!value) {
      setVisivel(false);
    }
  }, [value]);

  function handleFocus(event) {
    setFocado(true);
    textInputProps.onFocus?.(event);
  }

  function handleBlur(event) {
    setFocado(false);
    textInputProps.onBlur?.(event);
  }

  return (
    <View
      style={[
        styles.wrapper,
        wrapperStyle,
        invalid ? [styles.invalid, invalidStyle] : null,
        focado ? [styles.focused, focusedStyle] : null,
      ]}
    >
      <TextInput
        {...textInputProps}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        secureTextEntry={Platform.OS !== 'web' && !visivel}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          inputStyle,
          inputWebFocusReset,
          Platform.OS === 'web' && !visivel ? styles.webHiddenPassword : null,
        ]}
      />

      <TouchableOpacity
        style={[styles.toggle, toggleStyle]}
        onPress={() => setVisivel((atual) => !atual)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        disabled={!editable}
      >
        <Ionicons
          name={visivel ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={eyeColor}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#ffffff',
    borderColor: '#DDD',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 15,
    position: 'relative',
  },
  invalid: {
    borderColor: '#d96666',
  },
  focused: {
    ...inputFocusBorder,
  },
  input: {
    color: '#333',
    paddingHorizontal: 14,
    paddingRight: 48,
    paddingVertical: 12,
  },
  webHiddenPassword: {
    WebkitTextSecurity: 'disc',
  },
  toggle: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 48,
  },
});
