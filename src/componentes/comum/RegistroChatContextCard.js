import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme } from '../../temas/temaVisualPaciente';
import {
  getMealEntryPhotoRef,
  isMealPhotoRefResolvable,
  resolveMealPhotoDisplayUri,
} from '../../servicos/servicoRefeicaoIA';
import {
  getRegistroChatTypeLabel,
  sanitizeRegistroObservacao,
} from '../../utilitarios/registrosProntuarioNutri';

function resolveContextShape(source) {
  if (!source) return null;
  if (source.type || source.typeLabel || source.dateLabel) return source;
  return null;
}

function MetaLine({ label, value, compact, stacked }) {
  if (!value) return null;
  return (
    <View style={[styles.metaLine, stacked && styles.metaLineStacked]}>
      <Text style={[styles.metaLabel, compact && styles.metaLabelCompact]}>{label}</Text>
      <Text
        style={[styles.metaValue, compact && styles.metaValueCompact, stacked && styles.metaValueStacked]}
      >
        {value}
      </Text>
    </View>
  );
}

function ChatInfoLine({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.chatInfoLine}>
      <Text style={styles.chatInfoLabel}>{label}</Text>
      <Text style={styles.chatInfoValue}>{value}</Text>
    </View>
  );
}

function ChatPhotoThumb({ busy, uri, failed }) {
  return (
    <View style={styles.chatThumbWrap}>
      {busy ? (
        <View style={styles.chatThumbPlaceholder}>
          <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
        </View>
      ) : uri ? (
        <Image source={{ uri }} style={styles.chatThumb} resizeMode="cover" />
      ) : (
        <View style={styles.chatThumbPlaceholder}>
          <Ionicons
            name={failed ? 'image-outline' : 'restaurant-outline'}
            size={28}
            color={patientTheme.colors.textMuted}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Card de registro clínico no chat (refeição, glicemia, etc.).
 * variant: chat = foto à esquerda + dados à direita (estilo WhatsApp); preview = faixa antes de enviar.
 */
export default function RegistroChatContextCard({
  context,
  parsedMessage = null,
  compact = false,
  variant,
}) {
  const resolvedVariant = variant || (compact ? 'compact' : 'chat');
  const data = resolveContextShape(context) || parsedMessage;
  const inlinePhotoUrl =
    data?.photoUrl && /^(https?:|file:|data:|blob:)/i.test(String(data.photoUrl))
      ? data.photoUrl
      : null;
  const resolvablePhotoRef = (() => {
    const candidates = [
      data?.photoRef,
      data?.entrySnapshot ? getMealEntryPhotoRef(data.entrySnapshot) : null,
      data?.entry ? getMealEntryPhotoRef(data.entry) : null,
    ];
    for (const candidate of candidates) {
      if (isMealPhotoRefResolvable(candidate)) {
        return String(candidate).trim();
      }
    }
    return null;
  })();
  const [displayPhotoUri, setDisplayPhotoUri] = useState(inlinePhotoUrl);
  const [loadingResolvedPhoto, setLoadingResolvedPhoto] = useState(false);
  const [photoResolveFailed, setPhotoResolveFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function resolvePhoto() {
      if (!resolvablePhotoRef) {
        if (active) {
          setDisplayPhotoUri(inlinePhotoUrl);
          setLoadingResolvedPhoto(false);
          setPhotoResolveFailed(false);
        }
        return;
      }

      setLoadingResolvedPhoto(true);
      setPhotoResolveFailed(false);
      const resolved = await resolveMealPhotoDisplayUri(resolvablePhotoRef);
      if (active) {
        setDisplayPhotoUri(resolved || inlinePhotoUrl || null);
        setPhotoResolveFailed(!resolved && !inlinePhotoUrl);
        setLoadingResolvedPhoto(false);
      }
    }

    resolvePhoto();
    return () => {
      active = false;
    };
  }, [resolvablePhotoRef, inlinePhotoUrl]);

  if (!data) return null;

  const isChat = resolvedVariant === 'chat';
  const isPreview = resolvedVariant === 'preview';
  const isCompact = resolvedVariant === 'compact';

  const typeLabel = data.typeLabel || getRegistroChatTypeLabel(data.type);
  const dateLabel = data.dateLabel || '—';
  const timeLabel = data.timeLabel || '';
  const title = String(data.title || '').trim();
  const alimentos = String(
    data.alimentos || (data.type === 'refeicoes' ? data.detail : '') || ''
  ).trim();
  const detail = data.type === 'refeicoes' ? alimentos : String(data.detail || '').trim();
  const observacao = sanitizeRegistroObservacao(data.observacao || '');
  const nutritionSummary = String(data.nutritionSummary || '').trim();
  const kcalLabel = String(data.kcalLabel || '').trim();
  const showPhotoSlot = Boolean(
    resolvablePhotoRef ||
      inlinePhotoUrl ||
      (data.type === 'refeicoes' && String(data.photoRef || data.foto || '').trim())
  );
  const showObservacao = Boolean(observacao) && !/storage:\/\//i.test(observacao);
  const photoBusy = loadingResolvedPhoto;
  const dateTimeLabel = [dateLabel, timeLabel].filter(Boolean).join(' · ');

  const mealChatLines =
    data.type === 'refeicoes' ? (
      <>
        <ChatInfoLine label="Refeição" value={title} />
        <ChatInfoLine label="Alimentos" value={detail} />
        <ChatInfoLine label="Calorias" value={kcalLabel} />
        <ChatInfoLine label="Nutrição" value={nutritionSummary} />
        <ChatInfoLine label="Observação" value={showObservacao ? observacao : ''} />
      </>
    ) : null;

  const genericChatLines = data.type !== 'refeicoes' ? (
    <>
      {title ? <ChatInfoLine label="Registro" value={title} /> : null}
      {detail ? <ChatInfoLine label="Detalhe" value={detail} /> : null}
      <ChatInfoLine label="Observação" value={showObservacao ? observacao : ''} />
    </>
  ) : null;

  if (isPreview) {
    return (
      <View style={styles.previewRoot}>
        {showPhotoSlot ? (
          <View style={styles.previewThumbWrap}>
            {photoBusy || !displayPhotoUri ? (
              <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
            ) : (
              <Image source={{ uri: displayPhotoUri }} style={styles.previewThumb} resizeMode="cover" />
            )}
          </View>
        ) : null}
        <View style={styles.previewCopy}>
          <Text style={styles.previewType}>{typeLabel}</Text>
          <Text style={styles.previewDate}>{dateTimeLabel}</Text>
          <Text style={styles.previewTitle}>{title}</Text>
          {detail ? <Text style={styles.previewDetail}>{detail}</Text> : null}
          {kcalLabel ? <Text style={styles.previewDetail}>{kcalLabel}</Text> : null}
          {nutritionSummary ? <Text style={styles.previewDetail}>{nutritionSummary}</Text> : null}
        </View>
      </View>
    );
  }

  if (isChat) {
    const chatLines = mealChatLines || genericChatLines;

    return (
      <View style={[styles.card, styles.cardChat]}>
        <View style={[styles.headerRow, styles.headerRowChat]}>
          <View style={styles.badge}>
            <Ionicons name="restaurant-outline" size={14} color={patientTheme.colors.primaryDark} />
            <Text style={styles.badgeText}>{typeLabel}</Text>
          </View>
          {dateTimeLabel ? <Text style={[styles.dateTimeInline, styles.dateTimeInlineChat]}>{dateTimeLabel}</Text> : null}
        </View>

        <View style={styles.chatBodyRow}>
          {showPhotoSlot ? (
            <ChatPhotoThumb busy={photoBusy} uri={displayPhotoUri} failed={photoResolveFailed} />
          ) : null}
          <View style={[styles.chatCopyCol, !showPhotoSlot && styles.chatCopyColFull]}>{chatLines}</View>
        </View>
      </View>
    );
  }

  const mealFields =
    data.type === 'refeicoes' ? (
      <>
        {title ? <MetaLine label="Refeição" value={title} compact={isCompact} stacked /> : null}
        {detail ? <MetaLine label="Alimentos" value={detail} compact={isCompact} stacked /> : null}
        {kcalLabel ? <MetaLine label="Calorias" value={kcalLabel} compact={isCompact} stacked /> : null}
        {nutritionSummary ? (
          <MetaLine label="Nutrição" value={nutritionSummary} compact={isCompact} stacked />
        ) : null}
        {showObservacao ? (
          <MetaLine label="Observação" value={observacao} compact={isCompact} stacked />
        ) : null}
      </>
    ) : null;

  return (
    <View style={[styles.card, isCompact && styles.cardCompact]}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, isCompact && styles.badgeCompact]}>
          <Ionicons
            name="restaurant-outline"
            size={isCompact ? 12 : 14}
            color={patientTheme.colors.primaryDark}
          />
          <Text style={[styles.badgeText, isCompact && styles.badgeTextCompact]}>{typeLabel}</Text>
        </View>
        {dateTimeLabel ? (
          <Text style={[styles.dateTimeInline, isCompact && styles.dateTimeInlineCompact]}>{dateTimeLabel}</Text>
        ) : null}
      </View>

      {mealFields ? (
        <View style={styles.fieldsBlock}>{mealFields}</View>
      ) : (
        <>
          {title ? (
            <Text style={[styles.title, isCompact && styles.titleCompact]} numberOfLines={isCompact ? 2 : 3}>
              {title}
            </Text>
          ) : null}
          {detail ? (
            <Text style={[styles.detail, isCompact && styles.detailCompact]} numberOfLines={isCompact ? 4 : 8}>
              {detail}
            </Text>
          ) : null}
          {showObservacao ? (
            <MetaLine label="Observação" value={observacao} compact={isCompact} stacked />
          ) : null}
        </>
      )}

      {showPhotoSlot && !isChat ? (
        <View style={[styles.photoWrap, isCompact && styles.photoWrapCompact]}>
          {photoBusy || !displayPhotoUri ? (
            <View style={[styles.photoPlaceholder, isCompact && styles.photoPlaceholderCompact]}>
              <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
            </View>
          ) : (
            <Image
              source={{ uri: displayPhotoUri }}
              style={[styles.photo, isCompact && styles.photoCompact]}
              resizeMode="contain"
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const CHAT_THUMB_SIZE = 92;

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.primaryLight,
    borderColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    gap: 10,
    padding: 12,
    width: '100%',
  },
  cardChat: {
    alignSelf: 'stretch',
    gap: 8,
    maxWidth: 340,
    minWidth: 220,
    padding: 10,
    width: '100%',
  },
  cardCompact: {
    gap: 6,
    padding: 8,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerRowChat: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  chatBodyRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  chatThumbWrap: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
    height: CHAT_THUMB_SIZE,
    overflow: 'hidden',
    width: CHAT_THUMB_SIZE,
  },
  chatThumb: {
    height: CHAT_THUMB_SIZE,
    width: CHAT_THUMB_SIZE,
  },
  chatThumbPlaceholder: {
    alignItems: 'center',
    height: CHAT_THUMB_SIZE,
    justifyContent: 'center',
    width: CHAT_THUMB_SIZE,
  },
  chatCopyCol: {
    flex: 1,
    flexShrink: 1,
    gap: 5,
    minWidth: 120,
    paddingTop: 1,
  },
  chatCopyColFull: {
    paddingTop: 0,
  },
  chatInfoLine: {
    gap: 1,
  },
  chatInfoLabel: {
    color: patientTheme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  chatInfoValue: {
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  fieldsBlock: {
    gap: 10,
    width: '100%',
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
  dateTimeInline: {
    color: patientTheme.colors.textMuted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  dateTimeInlineChat: {
    flexShrink: 0,
    fontSize: 11,
    maxWidth: '100%',
  },
  dateTimeInlineCompact: {
    fontSize: 11,
  },
  title: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  titleCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  metaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaLineStacked: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    flexWrap: 'nowrap',
    gap: 4,
  },
  metaLabel: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  metaLabelCompact: {
    fontSize: 11,
  },
  metaValue: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  metaValueStacked: {
    flex: 0,
    width: '100%',
  },
  metaValueCompact: {
    fontSize: 11,
    lineHeight: 15,
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
    width: '100%',
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
  previewRoot: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  previewThumbWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderRadius: 10,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  previewThumb: {
    height: 72,
    width: 72,
  },
  previewCopy: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  previewType: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  previewDate: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  previewTitle: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  previewDetail: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
});
