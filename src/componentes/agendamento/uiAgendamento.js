import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { getConsultaStatusMeta } from '../../utilitarios/slotsTeleconsulta';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function CartaoAgendamento({ children, style, onPress, active }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.01 : 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      friction: 8,
    }).start();
  }, [active, scale]);

  const content = (
    <Animated.View
      style={[
        styles.card,
        active && styles.cardActive,
        style,
        { transform: [{ scale }] },
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

export function BotaoAgendamento({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const isDangerGhost = variant === 'dangerGhost';
  const isUnlink = variant === 'unlink';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary && styles.buttonPrimary,
        isGhost && styles.buttonGhost,
        isDanger && styles.buttonDanger,
        isDangerGhost && styles.buttonDangerGhost,
        isUnlink && styles.buttonUnlink,
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator
          color={
            isPrimary || isDanger
              ? patientTheme.colors.onPrimary
              : isUnlink || isDangerGhost
                ? patientTheme.colors.danger
                : patientTheme.colors.primaryDark
          }
        />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={
                disabled && isPrimary
                  ? '#6B7280'
                  : isPrimary || isDanger
                    ? patientTheme.colors.onPrimary
                    : isUnlink || isDangerGhost
                      ? patientTheme.colors.danger
                      : patientTheme.colors.primaryDark
              }
            />
          ) : null}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={[
              styles.buttonText,
              isPrimary && styles.buttonTextPrimary,
              isGhost && styles.buttonTextGhost,
              isDanger && styles.buttonTextDanger,
              isDangerGhost && styles.buttonTextDangerGhost,
              isUnlink && styles.buttonTextUnlink,
              disabled && isPrimary && styles.buttonTextDisabled,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function BadgeAgendamento({ label, tone = 'default' }) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function BadgeStatusConsulta({ status }) {
  const meta = getConsultaStatusMeta(status);
  return <BadgeAgendamento label={meta.label} tone={meta.tone} />;
}

export function ChipFiltro({ label, active, onPress, icon, style, textStyle, inactiveStyle }) {
  const { width } = useWindowDimensions();
  const compact = width < 420;

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        compact && styles.chipCompact,
        !active && inactiveStyle,
        style,
        active && styles.chipActive,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={compact ? 12 : 14}
          color={active ? patientTheme.colors.onPrimary : patientTheme.colors.primaryDark}
        />
      ) : null}
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[
          styles.chipText,
          compact && styles.chipTextCompact,
          active && styles.chipTextActive,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CampoBuscaAgendamento({
  value,
  onChangeText,
  placeholder,
  trailingIcon,
  onTrailingPress,
  trailingAccessibilityLabel,
  trailingActive,
}) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={18} color={patientTheme.colors.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={patientTheme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {trailingIcon ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onTrailingPress}
          accessibilityRole="button"
          accessibilityLabel={trailingAccessibilityLabel || 'Abrir filtros'}
          style={[styles.searchAction, trailingActive && styles.searchActionActive]}
        >
          <Ionicons
            name={trailingIcon}
            size={16}
            color={trailingActive ? patientTheme.colors.onPrimary : patientTheme.colors.primaryDark}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.searchActionPlaceholder} />
      )}
    </View>
  );
}

export function EsqueletoAgendamento({ rows = 3 }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View key={index} style={[styles.skeletonCard, { opacity }]} />
      ))}
    </View>
  );
}

export function AvatarProfissional({ name, size = 48, online, imageUri }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = String(name || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {imageUri && !imageFailed ? (
        <Image
          source={{ uri: imageUri }}
          style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
        </View>
      )}
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  cardActive: {
    backgroundColor: patientTheme.colors.surface,
  },
  button: {
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  buttonGhost: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1.5,
    borderColor: patientTheme.colors.border,
  },
  buttonDangerGhost: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1.5,
    borderColor: patientTheme.colors.danger,
  },
  buttonUnlink: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  buttonDanger: {
    backgroundColor: patientTheme.colors.danger,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonTextDisabled: {
    color: '#6B7280',
  },
  buttonText: {
    fontWeight: '800',
    fontSize: 13,
    flexShrink: 1,
    includeFontPadding: false,
  },
  buttonTextPrimary: {
    color: patientTheme.colors.onPrimary,
  },
  buttonTextGhost: {
    color: patientTheme.colors.primaryDark,
  },
  buttonTextDangerGhost: {
    color: patientTheme.colors.danger,
  },
  buttonTextUnlink: {
    color: patientTheme.colors.danger,
  },
  buttonTextDanger: {
    color: patientTheme.colors.onPrimary,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badge_default: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  badge_confirmed: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  badge_pending: {
    backgroundColor: 'rgba(244, 200, 108, 0.25)',
  },
  badge_cancelled: {
    backgroundColor: 'rgba(239, 154, 154, 0.22)',
  },
  badge_done: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeText_default: { color: patientTheme.colors.primaryDark },
  badgeText_confirmed: { color: patientTheme.colors.primaryDark },
  badgeText_pending: { color: patientTheme.colors.text },
  badgeText_cancelled: { color: patientTheme.colors.text },
  badgeText_done: { color: patientTheme.colors.primaryDark },
  chip: {
    ...patientShadow,
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipCompact: {
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
  },
  chipText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
    flexShrink: 1,
  },
  chipTextCompact: {
    fontSize: 10,
  },
  chipTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  searchWrap: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    paddingHorizontal: 14,
    minHeight: Platform.OS === 'web' ? 44 : 42,
    paddingVertical: Platform.OS === 'web' ? 5 : 5,
    width: '100%',
    ...patientShadow,
  },
  searchInput: {
    flex: 1,
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  searchAction: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.pill,
    height: 32,
    justifyContent: 'center',
    marginRight: -8,
    width: 32,
  },
  searchActionActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  searchActionPlaceholder: {
    height: 32,
    marginRight: -8,
    width: 32,
  },
  skeletonWrap: { gap: 12, marginTop: 12 },
  skeletonCard: {
    height: 108,
    borderRadius: patientTheme.radius.xl,
    backgroundColor: patientTheme.colors.surface,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    justifyContent: 'center',
  },
  avatarImage: {
    backgroundColor: patientTheme.colors.surface,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: patientTheme.colors.primaryDark,
    borderWidth: 2,
    borderColor: patientTheme.colors.background,
  },
});
