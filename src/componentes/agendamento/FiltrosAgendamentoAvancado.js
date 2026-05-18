import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  CONVENIOS_OPCOES,
  ESPECIALIDADES_NUTRICAO,
  TIPOS_CONSULTA_OPCOES,
} from '../../constantes/especialidadesTeleconsulta';
import { ChipFiltro } from './uiAgendamento';

const PRECO_RAPIDO_OPCOES = ['100', '150', '200', '250'];
const AVALIACAO_MINIMA_OPCOES = ['4.2', '4.5', '4.8'];

export function parseDateBrToKey(value) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function formatDateKeyToBr(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

function FilterSection({ title, subtitle, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>{title}</Text>
        {subtitle ? <Text style={styles.sectionHint}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function DrilldownSelect({
  title,
  value,
  placeholder,
  open,
  onToggle,
  children,
}) {
  return (
    <View style={styles.drilldownBlock}>
      <TouchableOpacity style={[styles.drilldownTrigger, open && styles.drilldownTriggerOpen]} onPress={onToggle}>
        <View style={styles.drilldownCopy}>
          <Text style={styles.drilldownTitle}>{title}</Text>
          <Text style={styles.drilldownValue} numberOfLines={1}>
            {value || placeholder}
          </Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={patientTheme.colors.textMuted}
        />
      </TouchableOpacity>
      {open ? <View style={styles.drilldownPanel}>{children}</View> : null}
    </View>
  );
}

export default function FiltrosAgendamentoAvancado({
  tipoConsulta,
  onTipoConsultaChange,
  convenio,
  onConvenioChange,
  especialidade,
  onEspecialidadeChange,
  dateFromBr,
  dateToBr,
  onDateFromBrChange,
  onDateToBrChange,
  maxValorReais,
  onMaxValorReaisChange,
  ordenacao,
  onOrdenacaoChange,
  ratingMinimo,
  onRatingMinimoChange,
  somenteConvenio,
  onSomenteConvenioChange,
  filtrosAtivos = 0,
  onLimpar,
  abertoExterno,
  onAbertoChange,
  ocultarToggle = false,
}) {
  const [aberto, setAberto] = useState(false);
  const [secaoAberta, setSecaoAberta] = useState('');
  const abertoControlado = typeof abertoExterno === 'boolean';
  const abertoAtual = abertoControlado ? abertoExterno : aberto;

  function setAbertoAtual(value) {
    if (!abertoControlado) {
      setAberto(value);
    }
    onAbertoChange?.(value);
  }

  function alternarSecao(secao) {
    setSecaoAberta((atual) => (atual === secao ? '' : secao));
  }

  const resumoAtivo = useMemo(() => {
    const tags = [];
    if (tipoConsulta && tipoConsulta !== TIPOS_CONSULTA_OPCOES[0]) tags.push(tipoConsulta);
    if (convenio && convenio !== CONVENIOS_OPCOES[0]) tags.push(convenio);
    if (especialidade && especialidade !== 'Todas') tags.push(especialidade);
    if (ratingMinimo) tags.push(`${ratingMinimo}+ estrelas`);
    if (maxValorReais) tags.push(`Até R$ ${maxValorReais}`);
    if (somenteConvenio) tags.push('Com convênio');
    if (dateFromBr || dateToBr) tags.push('Período definido');
    return tags.slice(0, 4);
  }, [
    tipoConsulta,
    convenio,
    especialidade,
    ratingMinimo,
    maxValorReais,
    somenteConvenio,
    dateFromBr,
    dateToBr,
  ]);

  return (
    <View style={[styles.wrap, ocultarToggle && !abertoAtual && styles.wrapCollapsed]}>
      {!ocultarToggle ? (
      <TouchableOpacity
        style={[styles.toggle, abertoAtual && styles.toggleOpen]}
        onPress={() => setAbertoAtual(!abertoAtual)}
        accessibilityRole="button"
        accessibilityLabel="Filtros avançados de teleconsulta"
      >
          <View style={styles.toggleLeading}>
            <View style={styles.toggleIconWrap}>
              <Ionicons name="funnel-outline" size={15} color={patientTheme.colors.primaryDark} />
            </View>
            <View style={styles.toggleCopy}>
            <Text style={styles.toggleText}>Filtros da teleconsulta</Text>
            <Text style={styles.toggleSubtext}>
              {filtrosAtivos > 0
                ? `${filtrosAtivos} filtro(s) ativo(s)`
                : 'Refine especialidade, valor, período e perfil'}
            </Text>
          </View>
        </View>

        <View style={styles.toggleActions}>
          {filtrosAtivos > 0 ? (
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>{filtrosAtivos}</Text>
            </View>
          ) : null}
          <Ionicons
            name={abertoAtual ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={patientTheme.colors.textMuted}
          />
        </View>
      </TouchableOpacity>
      ) : null}

      {!ocultarToggle && resumoAtivo.length ? (
        <View style={styles.summaryChips}>
          {resumoAtivo.map((item) => (
            <View key={item} style={styles.summaryChip}>
              <Text style={styles.summaryChipText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {abertoAtual ? (
        <View style={styles.panel}>
          <FilterSection title="Atendimento">
            <View style={styles.infoPillWrap}>
              <View style={styles.infoPill}>
                <Ionicons name="videocam-outline" size={15} color={patientTheme.colors.primaryDark} />
                <Text style={styles.infoPillText}>Teleconsulta online</Text>
              </View>
            </View>
          </FilterSection>

          <DrilldownSelect
            title="Tipo de consulta"
            value={tipoConsulta}
            placeholder="Selecione"
            open={secaoAberta === 'tipo'}
            onToggle={() => alternarSecao('tipo')}
          >
            <View style={styles.chips}>
              {TIPOS_CONSULTA_OPCOES.map((tipo) => (
                <ChipFiltro
                  key={tipo}
                  label={tipo}
                  active={tipoConsulta === tipo}
                  style={styles.optionChip}
                  textStyle={styles.optionChipText}
                  onPress={() => {
                    onTipoConsultaChange(tipo);
                    setSecaoAberta('');
                  }}
                />
              ))}
            </View>
          </DrilldownSelect>

          <DrilldownSelect
            title="Convênio ou pagamento"
            value={somenteConvenio ? `${convenio} + com convênio` : convenio}
            placeholder="Selecione"
            open={secaoAberta === 'convenio'}
            onToggle={() => alternarSecao('convenio')}
          >
            <View style={styles.chips}>
              {CONVENIOS_OPCOES.map((item) => (
                <ChipFiltro
                  key={item}
                  label={item}
                  active={convenio === item}
                  style={styles.optionChip}
                  textStyle={styles.optionChipText}
                  onPress={() => onConvenioChange(item)}
                />
              ))}
              <ChipFiltro
                label="Somente com convênio"
                icon="shield-checkmark-outline"
                active={somenteConvenio}
                style={styles.optionChip}
                textStyle={styles.optionChipText}
                onPress={() => onSomenteConvenioChange(!somenteConvenio)}
              />
            </View>
          </DrilldownSelect>

          <FilterSection title="Período">
            <View style={styles.compactDateRow}>
              <View style={styles.compactDateField}>
                <TextInput
                  style={styles.input}
                  placeholder="De"
                  placeholderTextColor={patientTheme.colors.textMuted}
                  value={dateFromBr}
                  onChangeText={onDateFromBrChange}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <View style={styles.compactDateField}>
                <TextInput
                  style={styles.input}
                  placeholder="Até"
                  placeholderTextColor={patientTheme.colors.textMuted}
                  value={dateToBr}
                  onChangeText={onDateToBrChange}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>
          </FilterSection>

          <DrilldownSelect
            title="Nota mínima"
            value={ratingMinimo ? `${ratingMinimo}+ estrelas` : ''}
            placeholder="Qualquer nota"
            open={secaoAberta === 'rating'}
            onToggle={() => alternarSecao('rating')}
          >
            <View style={styles.chips}>
              {AVALIACAO_MINIMA_OPCOES.map((item) => (
                <ChipFiltro
                  key={item}
                  label={`${item}+`}
                  icon="star-outline"
                  active={ratingMinimo === item}
                  style={styles.optionChip}
                  textStyle={styles.optionChipText}
                  onPress={() => {
                    onRatingMinimoChange(ratingMinimo === item ? '' : item);
                    setSecaoAberta('');
                  }}
                />
              ))}
            </View>
          </DrilldownSelect>

          <DrilldownSelect
            title="Especialidade"
            value={especialidade}
            placeholder="Todas"
            open={secaoAberta === 'especialidade'}
            onToggle={() => alternarSecao('especialidade')}
          >
            <View style={styles.chips}>
              <ChipFiltro
                label="Todas"
                active={!especialidade || especialidade === 'Todas'}
                style={styles.optionChip}
                textStyle={styles.optionChipText}
                onPress={() => {
                  onEspecialidadeChange('Todas');
                  setSecaoAberta('');
                }}
              />
              {ESPECIALIDADES_NUTRICAO.map((item) => (
                <ChipFiltro
                  key={item}
                  label={item}
                  active={especialidade === item}
                  style={styles.optionChip}
                  textStyle={styles.optionChipText}
                  onPress={() => {
                    onEspecialidadeChange(item);
                    setSecaoAberta('');
                  }}
                />
              ))}
            </View>
          </DrilldownSelect>

          <FilterSection title="Valor máximo (R$)">
            <TextInput
              style={styles.inputFull}
              placeholder="Ex.: 150"
              placeholderTextColor={patientTheme.colors.textMuted}
              value={maxValorReais}
              onChangeText={onMaxValorReaisChange}
              keyboardType="numeric"
            />
            <View style={[styles.chips, styles.quickPriceRow]}>
              {PRECO_RAPIDO_OPCOES.map((item) => (
                <ChipFiltro
                  key={item}
                  label={`R$ ${item}`}
                  active={maxValorReais === item}
                  style={styles.priceChip}
                  textStyle={styles.priceChipText}
                  onPress={() => onMaxValorReaisChange(maxValorReais === item ? '' : item)}
                />
              ))}
            </View>
          </FilterSection>

          <DrilldownSelect
            title="Ordenar por"
            value={
              ordenacao === 'preco'
                ? 'Menor preço'
                : ordenacao === 'avaliacao'
                  ? 'Melhor avaliação'
                  : 'Relevância'
            }
            placeholder="Relevância"
            open={secaoAberta === 'ordenacao'}
            onToggle={() => alternarSecao('ordenacao')}
          >
            <View style={styles.chips}>
              <ChipFiltro
                label="Relevância"
                active={ordenacao === 'relevancia'}
                style={styles.optionChip}
                textStyle={styles.optionChipText}
                onPress={() => {
                  onOrdenacaoChange('relevancia');
                  setSecaoAberta('');
                }}
              />
              <ChipFiltro
                label="Menor preço"
                active={ordenacao === 'preco'}
                style={styles.optionChip}
                textStyle={styles.optionChipText}
                onPress={() => {
                  onOrdenacaoChange('preco');
                  setSecaoAberta('');
                }}
              />
              <ChipFiltro
                label="Melhor avaliação"
                active={ordenacao === 'avaliacao'}
                style={styles.optionChip}
                textStyle={styles.optionChipText}
                onPress={() => {
                  onOrdenacaoChange('avaliacao');
                  setSecaoAberta('');
                }}
              />
            </View>
          </DrilldownSelect>

          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={onLimpar}>
              <Text style={styles.clearText}>Limpar filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export { CONVENIOS_OPCOES };

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
  wrapCollapsed: {
    marginBottom: 0,
  },
  toggle: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...patientShadow,
  },
  toggleOpen: {
    borderColor: patientTheme.colors.primary,
  },
  toggleLeading: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  toggleIconWrap: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  toggleCopy: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  toggleText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  toggleSubtext: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  toggleActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 10,
  },
  counterBadge: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
  },
  counterBadgeText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  summaryChip: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  summaryChipText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
    ...patientShadow,
  },
  section: {
    marginTop: 10,
    width: '100%',
  },
  drilldownBlock: {
    alignSelf: 'stretch',
    marginTop: 10,
    width: '100%',
  },
  drilldownTrigger: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  drilldownTriggerOpen: {
    borderColor: patientTheme.colors.primary,
  },
  drilldownCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  drilldownTitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  drilldownValue: {
    color: patientTheme.colors.text,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  drilldownPanel: {
    marginTop: 6,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: patientTheme.colors.text,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionHint: {
    color: patientTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  infoPill: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoPillWrap: {
    alignItems: 'flex-end',
    marginTop: -30,
  },
  infoPillText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
  },
  compactDateRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  compactDateField: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 0,
    width: '100%',
  },
  inputFull: {
    backgroundColor: patientTheme.colors.background,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: patientTheme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 0,
    width: '100%',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickPriceRow: {
    marginTop: 8,
  },
  footerActions: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  clearBtn: {
    paddingVertical: 4,
  },
  clearText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  optionChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  priceChip: {
    minHeight: 30,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  priceChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
