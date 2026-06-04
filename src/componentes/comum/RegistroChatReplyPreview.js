import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../temas/temaVisualPaciente';
import { resolveMealPhotoDisplayUri } from '../../servicos/servicoRefeicaoIA';

/**
 * Faixa compacta estilo “respondendo” (WhatsApp) acima do campo de mensagem.
 */
export default function RegistroChatReplyPreview({ context, onDismiss }) {
  const [displayPhotoUri, setDisplayPhotoUri] = useState(context?.photoUrl || null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  useEffect(() => {
    let active = true;
    const photoRef = context?.photoRef || null;
    const inlineUrl = context?.photoUrl || null;

    if (!photoRef) {
      setDisplayPhotoUri(inlineUrl);
      setLoadingPhoto(false);
      return undefined;
    }

    setLoadingPhoto(true);
    resolveMealPhotoDisplayUri(photoRef)
      .then((resolved) => {
        if (active) setDisplayPhotoUri(resolved || inlineUrl || null);
      })
      .catch(() => {
        if (active) setDisplayPhotoUri(inlineUrl || null);
      })
      .finally(() => {
        if (active) setLoadingPhoto(false);
      });

    return () => {
      active = false;
    };
  }, [context?.photoRef, context?.photoUrl]);

  if (!context) return null;

  const typeLabel = context.typeLabel || 'Registro';
  const title = context.title || typeLabel;
  const detail = context.detail || '';
  const showPhoto = Boolean(context.photoRef || context.photoUrl);

  return (
    <View style={styles.wrap}>
      <View style={styles.accent} />
      <View style={styles.body}>
        {showPhoto ? (
          <View style={styles.thumbWrap}>
            {loadingPhoto || !displayPhotoUri ? (
              <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
            ) : (
              <Image source={{ uri: displayPhotoUri }} style={styles.thumb} resizeMode="cover" />
            )}
          </View>
        ) : null}
        <View style={styles.copy}>
          <Text style={styles.typeLabel} numberOfLines={1}>
            {typeLabel}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Remover registro da resposta"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: patientTheme.colors.surface,
    borderTopColor: patientTheme.colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accent: {
    backgroundColor: patientTheme.colors.primary,
    width: 4,
  },
  body: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thumbWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  thumb: {
    height: 48,
    width: 48,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  typeLabel: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  detail: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
});
