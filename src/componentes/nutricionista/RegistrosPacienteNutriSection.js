import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FilterTabs,
  SearchInput,
  SectionCard,
} from './NutriDesktopUI';
import { nutriTheme as defaultTheme } from '../../temas/temaVisualNutricionista';
import {
  getMealEntryPhotoRef,
  resolveMealPhotoDisplayUri,
} from '../../servicos/servicoRefeicaoIA';
import {
  buildRegistroChatContext,
  formatRegistroDateParts,
  matchesRegistroSearch,
} from '../../utilitarios/registrosProntuarioNutri';
import { abrirChatNutriComRegistro } from '../../utilitarios/navegacaoChatRegistroNutri';

const registrosTabs = [
  { value: 'glicemia', label: 'Glicemia' },
  { value: 'medicacao', label: 'Medicação' },
  { value: 'insulina', label: 'Insulina' },
  { value: 'refeicoes', label: 'Refeições' },
];

function getGlucoseStyle(val) {
  const v = Number(val);
  if (v >= 250) return styles.glucoseHigh;
  if (v >= 180) return styles.glucoseModerate;
  if (v < 70) return styles.glucoseLow;
  return styles.glucoseNormal;
}

function RegistroDateTime({ entry }) {
  const { dateLabel, timeLabel } = formatRegistroDateParts(entry);
  return (
    <View style={styles.registroDataCol}>
      <Text style={styles.registroData}>{dateLabel}</Text>
      {timeLabel ? <Text style={styles.registroHora}>{timeLabel}</Text> : null}
    </View>
  );
}

function RegistroChatButton({ onPress, disabled, loading, theme = defaultTheme }) {
  const palette = theme?.colors || defaultTheme.colors;
  return (
    <TouchableOpacity
      style={[styles.chatButton, { borderColor: palette.primary }]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel="Abrir chat sobre este registro"
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.primary} />
      ) : (
        <>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={palette.primary} />
          <Text style={[styles.chatButtonLabel, { color: palette.primary }]}>Chat</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function MealPhotoThumb({ entry, onOpen, theme = defaultTheme }) {
  const palette = theme?.colors || defaultTheme.colors;
  const photoRef = getMealEntryPhotoRef(entry);
  const [thumbUri, setThumbUri] = useState(null);
  const [loadingThumb, setLoadingThumb] = useState(false);

  useEffect(() => {
    let active = true;
    if (!photoRef) {
      setThumbUri(null);
      return undefined;
    }
    setLoadingThumb(true);
    resolveMealPhotoDisplayUri(photoRef)
      .then((uri) => {
        if (active) setThumbUri(uri);
      })
      .catch(() => {
        if (active) setThumbUri(null);
      })
      .finally(() => {
        if (active) setLoadingThumb(false);
      });
    return () => {
      active = false;
    };
  }, [photoRef]);

  if (!photoRef) {
    return <Text style={styles.semFotoText}>Sem foto</Text>;
  }

  if (loadingThumb) {
    return (
      <View style={styles.mealThumbPlaceholder}>
        <ActivityIndicator size="small" color={palette.primaryDark} />
      </View>
    );
  }

  if (!thumbUri) {
    return <Text style={styles.semFotoText}>Sem foto</Text>;
  }

  return (
    <TouchableOpacity onPress={() => onOpen(entry, thumbUri)} activeOpacity={0.85}>
      <Image source={{ uri: thumbUri }} style={styles.mealThumb} resizeMode="cover" />
    </TouchableOpacity>
  );
}

export default function RegistrosPacienteNutriSection({
  glicemias = [],
  medicacoes = [],
  insulinas = [],
  refeicoes = [],
  loadingRegistros = false,
  loadError = '',
  pacienteId,
  navigation = null,
  patientName = 'Paciente',
  usuarioLogado = null,
  onReloadRegistros = null,
  theme = defaultTheme,
}) {
  const palette = theme?.colors || defaultTheme.colors;
  const [registrosTab, setRegistrosTab] = useState('glicemia');
  const [searchQuery, setSearchQuery] = useState('');
  const [openingChatKey, setOpeningChatKey] = useState(null);
  const [chatFeedback, setChatFeedback] = useState(null);
  const [mealPhotoViewer, setMealPhotoViewer] = useState(null);

  useEffect(() => {
    if (!chatFeedback) return undefined;
    const timer = setTimeout(() => setChatFeedback(null), 3200);
    return () => clearTimeout(timer);
  }, [chatFeedback]);

  const filteredGlicemias = useMemo(
    () => glicemias.filter((g) => matchesRegistroSearch(g, 'glicemia', searchQuery)),
    [glicemias, searchQuery]
  );
  const filteredMedicacoes = useMemo(
    () => medicacoes.filter((m) => matchesRegistroSearch(m, 'medicacao', searchQuery)),
    [medicacoes, searchQuery]
  );
  const filteredInsulinas = useMemo(
    () => insulinas.filter((m) => matchesRegistroSearch(m, 'insulina', searchQuery)),
    [insulinas, searchQuery]
  );
  const filteredRefeicoes = useMemo(
    () => refeicoes.filter((r) => matchesRegistroSearch(r, 'refeicoes', searchQuery)),
    [refeicoes, searchQuery]
  );

  const openMealPhoto = useCallback(async (entry, knownUri = null) => {
    const title = entry.title || entry.mealLabel || entry.tipo_refeicao || 'Refeição';
    if (knownUri) {
      setMealPhotoViewer({ title, uri: knownUri, loading: false });
      return;
    }
    const photoRef = getMealEntryPhotoRef(entry);
    if (!photoRef) return;
    setMealPhotoViewer({ title, uri: null, loading: true });
    try {
      const uri = await resolveMealPhotoDisplayUri(photoRef);
      setMealPhotoViewer({ title, uri, loading: false });
    } catch (_) {
      setMealPhotoViewer(null);
    }
  }, []);

  const handleOpenRegistroChat = useCallback(
    async (type, entry, rowKey) => {
      if (!pacienteId || !navigation) {
        setChatFeedback({
          type: 'error',
          text: 'Não foi possível abrir o chat deste paciente.',
        });
        return;
      }
      setOpeningChatKey(rowKey);
      try {
        let photoUrl = null;
        if (type === 'refeicoes') {
          const ref = getMealEntryPhotoRef(entry);
          if (ref) {
            photoUrl = await resolveMealPhotoDisplayUri(ref).catch(() => null);
          }
        }
        const registroContext = buildRegistroChatContext(type, entry, {
          photoUrl,
          photoRef: type === 'refeicoes' ? getMealEntryPhotoRef(entry) : null,
        });
        const opened = abrirChatNutriComRegistro(navigation, {
          usuarioLogado,
          pacienteId,
          registroContext,
        });
        if (!opened) {
          setChatFeedback({
            type: 'error',
            text: 'Não foi possível abrir o chat deste paciente.',
          });
        }
      } catch (_) {
        setChatFeedback({
          type: 'error',
          text: 'Não foi possível abrir o chat deste paciente.',
        });
      } finally {
        setOpeningChatKey(null);
      }
    },
    [navigation, pacienteId, usuarioLogado]
  );

  const sectionTitles = {
    glicemia: 'Histórico de Glicemia',
    medicacao: 'Medicações',
    insulina: 'Registros de Insulina',
    refeicoes: 'Histórico Alimentar',
  };

  const emptyMessages = {
    glicemia: 'Nenhum registro de glicemia encontrado.',
    medicacao: 'Nenhum registro de medicação encontrado.',
    insulina: 'Nenhum registro de insulina encontrado.',
    refeicoes: 'Nenhum registro alimentar encontrado.',
  };

  const activeList =
    registrosTab === 'glicemia'
      ? filteredGlicemias
      : registrosTab === 'medicacao'
        ? filteredMedicacoes
        : registrosTab === 'insulina'
          ? filteredInsulinas
          : filteredRefeicoes;

  const sourceCount =
    registrosTab === 'glicemia'
      ? glicemias.length
      : registrosTab === 'medicacao'
        ? medicacoes.length
        : registrosTab === 'insulina'
          ? insulinas.length
          : refeicoes.length;

  return (
    <View style={styles.pageGap}>
      <FilterTabs
        scrollable
        fill={false}
        items={registrosTabs}
        active={registrosTab}
        onChange={(tab) => {
          setRegistrosTab(tab);
        }}
        compact
        theme={theme}
      />

      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Pesquisar registros..."
      />

      {chatFeedback ? (
        <Text
          style={[
            styles.chatFeedback,
            chatFeedback.type === 'error' ? styles.chatFeedbackError : styles.chatFeedbackSuccess,
          ]}
        >
          {chatFeedback.text}
        </Text>
      ) : null}

      {loadingRegistros ? (
        <View style={styles.inlineStatus}>
          <ActivityIndicator color={palette.primaryDark} />
          <Text style={styles.inlineStatusText}>Carregando registros...</Text>
        </View>
      ) : null}

      {!loadingRegistros && loadError ? (
        <View style={styles.loadErrorWrap}>
          <Text style={styles.loadErrorText}>{loadError}</Text>
          {typeof onReloadRegistros === 'function' ? (
            <TouchableOpacity
              style={[styles.reloadButton, { backgroundColor: palette.primary }]}
              onPress={onReloadRegistros}
            >
              <Text style={styles.reloadButtonText}>Recarregar registros</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <SectionCard>
        <Text style={styles.sectionTitle}>{sectionTitles[registrosTab]}</Text>

        {!loadingRegistros && sourceCount > 0 && activeList.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum registro corresponde à pesquisa.</Text>
        ) : null}

        {!loadingRegistros && !loadError && sourceCount === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>{emptyMessages[registrosTab]}</Text>
            {typeof onReloadRegistros === 'function' ? (
              <TouchableOpacity
                style={[styles.reloadButton, { backgroundColor: palette.primary }]}
                onPress={onReloadRegistros}
              >
                <Text style={styles.reloadButtonText}>Recarregar registros</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {registrosTab === 'glicemia'
          ? activeList.map((g, i) => {
              const rowKey = `g-${g.id || i}`;
              const obs = String(g.sintomas_associados || g.observacao || '').trim();
              const contexto = g.contexto || g.context || g.glucoseType;
              return (
                <View key={rowKey} style={styles.registroRow}>
                  <RegistroDateTime entry={g} />
                  <View style={styles.registroBody}>
                    <View style={[styles.glucoseBadge, getGlucoseStyle(g.valor_mgdl ?? g.value)]}>
                      <Text style={styles.glucoseBadgeText}>
                        {g.valor_mgdl ?? g.value} mg/dL
                      </Text>
                    </View>
                    {contexto ? <Text style={styles.registroMeta}>{contexto}</Text> : null}
                    {obs && obs !== contexto ? (
                      <Text style={styles.registroMeta} numberOfLines={4}>
                        {obs}
                      </Text>
                    ) : null}
                  </View>
                  <RegistroChatButton
                    theme={theme}
                    loading={openingChatKey === rowKey}
                    onPress={() => handleOpenRegistroChat('glicemia', g, rowKey)}
                  />
                </View>
              );
            })
          : null}

        {registrosTab === 'medicacao'
          ? activeList.map((m, i) => {
              const rowKey = `m-${m.id || i}`;
              const dose = [m.medicineQuantity || m.dosagem || m.dose, m.medicineUnit]
                .filter(Boolean)
                .join(' ');
              return (
                <View key={rowKey} style={styles.registroRow}>
                  <RegistroDateTime entry={m} />
                  <View style={styles.registroBody}>
                    <Text style={styles.registroNome}>
                      {m.medicineName || m.nome_medicamento || 'Medicamento'}
                    </Text>
                    {dose ? <Text style={styles.registroMeta}>{dose}</Text> : null}
                    {m.observation ? (
                      <Text style={styles.registroMeta} numberOfLines={4}>
                        {m.observation}
                      </Text>
                    ) : null}
                  </View>
                  <RegistroChatButton
                    theme={theme}
                    loading={openingChatKey === rowKey}
                    onPress={() => handleOpenRegistroChat('medicacao', m, rowKey)}
                  />
                </View>
              );
            })
          : null}

        {registrosTab === 'insulina'
          ? activeList.map((m, i) => {
              const rowKey = `i-${m.id || i}`;
              const dose = [m.medicineQuantity || m.dosagem || m.dose, m.medicineUnit || 'UI']
                .filter(Boolean)
                .join(' ');
              return (
                <View key={rowKey} style={styles.registroRow}>
                  <RegistroDateTime entry={m} />
                  <View style={styles.registroBody}>
                    <Text style={styles.registroNome}>
                      {m.medicineName || m.nome_medicamento || 'Insulina'}
                    </Text>
                    {dose ? <Text style={styles.registroMeta}>{dose}</Text> : null}
                    {m.insulinCategory || m.categoria_insulina ? (
                      <Text style={styles.registroMeta}>
                        {m.insulinCategory || m.categoria_insulina}
                      </Text>
                    ) : null}
                  </View>
                  <RegistroChatButton
                    theme={theme}
                    loading={openingChatKey === rowKey}
                    onPress={() => handleOpenRegistroChat('insulina', m, rowKey)}
                  />
                </View>
              );
            })
          : null}

        {registrosTab === 'refeicoes'
          ? activeList.map((r, i) => {
              const rowKey = `r-${r.id || i}`;
              const kcal = r.calorias_estimadas ?? r.kcal;
              return (
                <View key={rowKey} style={styles.registroRow}>
                  <RegistroDateTime entry={r} />
                  <View style={styles.registroBody}>
                    <Text style={styles.registroNome}>
                      {r.title || r.nome || r.tipo_refeicao || r.mealLabel || 'Refeição'}
                    </Text>
                    {kcal ? <Text style={styles.registroMeta}>{kcal} kcal</Text> : null}
                    {r.description ? (
                      <Text style={styles.registroMeta} numberOfLines={4}>
                        {r.description}
                      </Text>
                    ) : null}
                    {r.resumo_ia ? (
                      <Text style={styles.registroMeta} numberOfLines={4}>
                        {r.resumo_ia}
                      </Text>
                    ) : null}
                    <View style={styles.mealPhotoSlot}>
                      <MealPhotoThumb entry={r} onOpen={openMealPhoto} theme={theme} />
                    </View>
                  </View>
                  <RegistroChatButton
                    theme={theme}
                    loading={openingChatKey === rowKey}
                    onPress={() => handleOpenRegistroChat('refeicoes', r, rowKey)}
                  />
                </View>
              );
            })
          : null}
      </SectionCard>

      <Modal
        visible={Boolean(mealPhotoViewer)}
        transparent
        animationType="fade"
        onRequestClose={() => setMealPhotoViewer(null)}
      >
        <TouchableWithoutFeedback onPress={() => setMealPhotoViewer(null)}>
          <View style={styles.photoModalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.photoModalCard}>
                <View style={styles.photoModalHeader}>
                  <Text style={styles.photoModalTitle} numberOfLines={4}>
                    {mealPhotoViewer?.title || 'Foto da refeição'}
                  </Text>
                  <TouchableOpacity onPress={() => setMealPhotoViewer(null)}>
                    <Ionicons name="close" size={22} color={palette.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.photoModalImageWrap}>
                  {mealPhotoViewer?.loading ? (
                    <ActivityIndicator size="large" color={palette.primaryDark} />
                  ) : mealPhotoViewer?.uri ? (
                    <Image
                      source={{ uri: mealPhotoViewer.uri }}
                      style={styles.photoModalImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.photoModalFallback}>
                      Não foi possível carregar a imagem.
                    </Text>
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageGap: { gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: defaultTheme.colors.text, marginBottom: 8 },
  emptyText: { color: defaultTheme.colors.textMuted, lineHeight: 20 },
  inlineStatus: { alignItems: 'center', flexDirection: 'row', gap: 8, marginVertical: 4 },
  inlineStatusText: { color: defaultTheme.colors.textMuted, fontWeight: '700' },
  chatFeedback: { fontSize: 12, fontWeight: '700', marginTop: -4 },
  chatFeedbackSuccess: { color: defaultTheme.colors.primaryDark },
  chatFeedbackError: { color: defaultTheme.colors.danger },
  loadErrorWrap: {
    gap: 8,
    marginBottom: 8,
  },
  loadErrorText: {
    color: defaultTheme.colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyWrap: {
    gap: 10,
    marginTop: 4,
  },
  reloadButton: {
    alignSelf: 'flex-start',
    backgroundColor: defaultTheme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reloadButtonText: {
    color: defaultTheme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  registroRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: defaultTheme.colors.border,
    alignItems: 'flex-start',
  },
  registroDataCol: { minWidth: 88 },
  registroData: { fontSize: 12, color: defaultTheme.colors.textMuted },
  registroHora: { fontSize: 11, color: defaultTheme.colors.textMuted, marginTop: 2 },
  registroBody: { flex: 1, minWidth: 0, gap: 4 },
  registroNome: { fontWeight: '700', color: defaultTheme.colors.text },
  registroMeta: { fontSize: 12, color: defaultTheme.colors.textMuted },
  chatButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    gap: 2,
  },
  chatButtonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: defaultTheme.colors.primary,
  },
  glucoseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  glucoseBadgeText: { fontWeight: '900', fontSize: 13 },
  glucoseNormal: { backgroundColor: '#DCFCE7' },
  glucoseModerate: { backgroundColor: '#FEF3C7' },
  glucoseHigh: { backgroundColor: '#FEE2E2' },
  glucoseLow: { backgroundColor: '#E0F2FE' },
  mealPhotoSlot: { marginTop: 4 },
  mealThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: defaultTheme.colors.backgroundSoft },
  mealThumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: defaultTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semFotoText: { fontSize: 11, color: defaultTheme.colors.textMuted, fontStyle: 'italic' },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: defaultTheme.colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  photoModalCard: {
    backgroundColor: defaultTheme.colors.surface,
    borderRadius: defaultTheme.radius.lg,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  photoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: defaultTheme.colors.border,
  },
  photoModalTitle: { flex: 1, fontWeight: '800', color: defaultTheme.colors.text, marginRight: 8 },
  photoModalImageWrap: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  photoModalImage: { width: '100%', height: 360 },
  photoModalFallback: { color: defaultTheme.colors.textMuted, textAlign: 'center' },
});
