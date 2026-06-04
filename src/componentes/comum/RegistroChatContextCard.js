import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../temas/temaVisualPaciente';
import { resolveMealPhotoDisplayUri } from '../../servicos/servicoRefeicaoIA';
import { getRegistroChatTypeLabel } from '../../utilitarios/registrosProntuarioNutri';

function resolveContextShape(source) {
  if (!source) return null;
  if (source.type || source.typeLabel || source.dateLabel) return source;
  return null;
}

export default function RegistroChatContextCard({
  context,
  parsedMessage = null,
  compact = false,
  loadingPhoto = false,
}) {
  const data = resolveContextShape(context) || parsedMessage;
  const [displayPhotoUri, setDisplayPhotoUri] = useState(data?.photoUrl || null);
  const [loadingResolvedPhoto, setLoadingResolvedPhoto] = useState(false);

  useEffect(() => {
    let active = true;

    async function resolvePhoto() {
      const inlineUrl = data?.photoUrl || null;
      const photoRef = data?.photoRef || null;

      if (!photoRef) {
        if (active) {
          setDisplayPhotoUri(inlineUrl);
          setLoadingResolvedPhoto(false);
        }
        return;
      }

      if (inlineUrl && !loadingPhoto) {
        if (active) {
          setDisplayPhotoUri(inlineUrl);
          setLoadingResolvedPhoto(false);
        }
      }

      setLoadingResolvedPhoto(true);
      try {
        const resolved = await resolveMealPhotoDisplayUri(photoRef);
        if (active) {
          setDisplayPhotoUri(resolved || inlineUrl || null);
        }
      } catch (_) {
        if (active) {
          setDisplayPhotoUri(inlineUrl || null);
        }
      } finally {
        if (active) {
          setLoadingResolvedPhoto(false);
        }
      }
    }

    resolvePhoto();
    return () => {
      active = false;
    };
  }, [data?.photoRef, data?.photoUrl, loadingPhoto]);

  if (!data) return null;

  const typeLabel = data.typeLabel || getRegistroChatTypeLabel(data.type);
  const dateLabel = data.dateLabel || '—';
  const timeLabel = data.timeLabel || '';
  const title = data.title || typeLabel;
  const detail = data.detail || '';
  const showPhotoSlot = Boolean(data.photoRef || data.photoUrl);
  const photoBusy = loadingPhoto || loadingResolvedPhoto;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, compact && styles.badgeCompact]}>
          <Ionicons
            name="document-text-outline"
            size={compact ? 12 : 14}
            color={patientTheme.colors.primaryDark}
          />
          <Text style={[styles.badgeText, compact && styles.badgeTextCompact]}>{typeLabel}</Text>
        </View>
        <View style={styles.dateTimeCol}>
          <Text style={[styles.dateText, compact && styles.dateTextCompact]}>{dateLabel}</Text>
          {timeLabel ? (
            <Text style={[styles.timeText, compact && styles.timeTextCompact]}>{timeLabel}</Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={compact ? 2 : 3}>
        {title}
      </Text>
      {detail ? (
        <Text style={[styles.detail, compact && styles.detailCompact]} numberOfLines={compact ? 2 : 6}>
          {detail}
        </Text>
      ) : null}

      {showPhotoSlot ? (
        <View style={[styles.photoWrap, compact && styles.photoWrapCompact]}>
          {photoBusy || !displayPhotoUri ? (
            <View style={[styles.photoPlaceholder, compact && styles.photoPlaceholderCompact]}>
              <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
            </View>
          ) : (
            <Image
              source={{ uri: displayPhotoUri }}
              style={[styles.photo, compact && styles.photoCompact]}
              resizeMode="contain"
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.primaryLight,
    borderColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardCompact: {
    gap: 6,
    padding: 8,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  badge: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTextCompact: {
    fontSize: 10,
  },
  dateTimeCol: {
    alignItems: 'flex-end',
  },
  dateText: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  dateTextCompact: {
    fontSize: 11,
  },
  timeText: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  timeTextCompact: {
    fontSize: 10,
  },
  title: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  titleCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  detail: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  detailCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  photoWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.md,
    justifyContent: 'center',
    marginTop: 4,
    overflow: 'hidden',
  },
  photoWrapCompact: {
    marginTop: 2,
    maxHeight: 108,
    minHeight: 88,
  },
  photo: {
    height: 140,
    width: '100%',
  },
  photoCompact: {
    height: 100,
    maxHeight: 100,
    width: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    height: 140,
    justifyContent: 'center',
    width: '100%',
  },
  photoPlaceholderCompact: {
    height: 100,
  },
});
