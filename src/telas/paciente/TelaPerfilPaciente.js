import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { inputFocusBorder } from '../../temas/temaFocoCampo';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';
import {
  fetchPatientById,
  getPatientDisplayName,
  getPatientId,
  updatePatientProfile,
} from '../../servicos/servicoDadosPaciente';
import {
  buildPatientProfileSections,
  getOnboardingAnswers,
} from '../../utilitarios/camposPerfilPaciente';
import { useKeyboardAwareScroll } from '../../utilitarios/rolagemComTeclado';
import {
  getPatientLocalOnboardingData,
  mergePatientOnboardingData,
} from '../../servicos/servicoOnboardingPaciente';
import {
  confirmarCodigoValidacaoEmailCadastro,
  solicitarCodigoValidacaoEmailCadastro,
} from '../../servicos/servicoVerificacaoEmail';

const EMPTY_PROFILE_FORM = {
  nome_completo: '',
  cpf_paciente: '',
  email_pac: '',
  telefone: '',
  data_nascimento: '',
  sexo_biologico: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
};

const GENDER_OPTIONS = ['Masculino', 'Feminino', 'NÃ£o binÃ¡rio', 'Prefiro nÃ£o informar'];
const DIABETES_TYPE_OPTIONS = ['Tipo 1', 'Tipo 2', 'Lada', 'Mody', 'Gestacional', 'Outros Tipos'];
const INSULIN_CATEGORY_OPTIONS = [
  { id: 'basal', label: 'Insulina basal' },
  { id: 'prandial', label: 'Insulina bolus' },
];
const INSULIN_TYPE_OPTIONS = {
  basal: ['NPH', 'Glargina U100', 'Glargina U300', 'Detemir', 'Degludeca', 'Icodec'],
  prandial: ['Regular', 'Lispro', 'Asparte', 'Glulisina', 'Asparte ultrarrapida'],
  premixed: ['NPH/Regular 70/30', 'NPL/Lispro 75/25', 'NPL/Lispro 50/50', 'NPA/Asparte 70/30'],
  inhaled: ['Insulina humana inalavel'],
};
const BASAL_INSULIN_PROFILE_OPTIONS = [
  {
    label: 'Basaglar — Glargina (U-100)',
    brand: 'Basaglar',
    molecule: 'Glargina',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    actionProfileKey: 'longa',
    onsetLabel: '~1–2 horas',
    peakLabel: 'sem pico definido',
    durationLabel: '~20–24 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia'],
  },
  {
    label: 'Densulin N — NPH (U-100)',
    brand: 'Densulin N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    actionProfileKey: 'intermediaria',
    onsetLabel: '~1–2 horas',
    peakLabel: '4–12 horas',
    durationLabel: '~12–18 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco'],
    suggestedFrequency: '2x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia', '3x_ao_dia'],
  },
  {
    label: 'Glargilin — Glargina (U-100)',
    brand: 'Glargilin',
    molecule: 'Glargina',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    actionProfileKey: 'longa',
    onsetLabel: '~1–2 horas',
    peakLabel: 'sem pico definido',
    durationLabel: '~20–24 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia'],
  },
  {
    label: 'Humulin N — NPH (U-100)',
    brand: 'Humulin N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    actionProfileKey: 'intermediaria',
    onsetLabel: '~1–2 horas',
    peakLabel: '4–12 horas',
    durationLabel: '~12–18 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta'],
    suggestedFrequency: '2x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia', '3x_ao_dia'],
  },
  {
    label: 'Insulatard — NPH (U-100)',
    brand: 'Insulatard',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    actionProfileKey: 'intermediaria',
    onsetLabel: '~1–2 horas',
    peakLabel: '4–12 horas',
    durationLabel: '~12–18 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta', 'Cartucho/refil'],
    suggestedFrequency: '2x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia', '3x_ao_dia'],
  },
  {
    label: 'Insulex N — NPH (U-100)',
    brand: 'Insulex N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    actionProfileKey: 'intermediaria',
    onsetLabel: '~1–2 horas',
    peakLabel: '4–12 horas',
    durationLabel: '~12–18 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco'],
    suggestedFrequency: '2x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia', '3x_ao_dia'],
  },
  {
    label: 'Insuman Basal — NPH (U-100)',
    brand: 'Insuman Basal',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    actionProfileKey: 'intermediaria',
    onsetLabel: '~1–2 horas',
    peakLabel: '4–12 horas',
    durationLabel: '~12–18 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta'],
    suggestedFrequency: '2x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia', '3x_ao_dia'],
  },
  {
    label: 'Lantus — Glargina (U-100)',
    brand: 'Lantus',
    molecule: 'Glargina',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    actionProfileKey: 'longa',
    onsetLabel: '~1–2 horas',
    peakLabel: 'sem pico definido',
    durationLabel: '~20–24 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta', 'Cartucho/refil'],
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia'],
  },
  {
    label: 'Levemir — Detemir (U-100)',
    brand: 'Levemir',
    molecule: 'Detemir',
    concentration: 'U-100',
    actionClass: 'Longa duração',
    actionProfileKey: 'longa',
    onsetLabel: '~1–2 horas',
    peakLabel: 'baixo ou sem pico definido',
    durationLabel: '~18–24 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia'],
  },
  {
    label: 'Novolin N — NPH (U-100)',
    brand: 'Novolin N',
    molecule: 'NPH / Insulina humana isofana',
    concentration: 'U-100',
    actionClass: 'Intermediária',
    actionProfileKey: 'intermediaria',
    onsetLabel: '~1–2 horas',
    peakLabel: '4–12 horas',
    durationLabel: '~12–18 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Seringa + frasco', 'Caneta', 'Cartucho/refil'],
    suggestedFrequency: '2x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia', '3x_ao_dia'],
  },
  {
    label: 'Semglee — Glargina (U-100)',
    brand: 'Semglee',
    molecule: 'Glargina',
    concentration: 'U-100',
    backendPresentation: 'Caneta preenchida 3 mL',
    actionClass: 'Longa duração',
    actionProfileKey: 'longa',
    onsetLabel: '~1–2 horas',
    peakLabel: 'sem pico definido',
    durationLabel: '~20–24 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta'],
    scaleUnit: '1 UI',
    doseStep: 1,
    defaultUsage: 'Diário',
    status: 'ativo',
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia', '2x_ao_dia'],
  },
  {
    label: 'Toujeo — Glargina (U-300)',
    brand: 'Toujeo',
    molecule: 'Glargina',
    concentration: 'U-300',
    actionClass: 'Longa duração (concentrada)',
    actionProfileKey: 'ultralonga',
    onsetLabel: '~6 horas',
    peakLabel: 'sem pico definido',
    durationLabel: '~30–36 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta'],
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia'],
  },
  {
    label: 'Tresiba — Degludeca (U-100)',
    brand: 'Tresiba',
    molecule: 'Degludeca',
    concentration: 'U-100',
    actionClass: 'Ultra longa duração',
    actionProfileKey: 'ultralonga',
    onsetLabel: '~1 hora',
    peakLabel: 'sem pico definido',
    durationLabel: '~36–42 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta', 'Cartucho/refil'],
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia'],
  },
  {
    label: 'Tresiba — Degludeca (U-200)',
    brand: 'Tresiba',
    molecule: 'Degludeca',
    concentration: 'U-200',
    actionClass: 'Ultra longa duração',
    actionProfileKey: 'ultralonga',
    onsetLabel: '~1 hora',
    peakLabel: 'sem pico definido',
    durationLabel: '~36–42 horas',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta'],
    suggestedFrequency: '1x_ao_dia',
    allowedFrequencies: ['1x_ao_dia'],
  },
  {
    label: 'Awiqli — Icodeca (U-700)',
    brand: 'Awiqli',
    molecule: 'Icodeca',
    concentration: 'U-700',
    actionClass: 'Ultra longa duração',
    actionProfileKey: 'ultralonga',
    suggestedRoute: 'Subcutânea',
    allowedDevices: ['Caneta'],
    suggestedFrequency: '1x_por_semana',
    allowedFrequencies: ['1x_por_semana'],
  },
];
const BASAL_FREQUENCY_OPTIONS = [
  { label: '1x ao dia', value: '1x_ao_dia', rows: 1, scheduleType: 'daily' },
  { label: '2x ao dia', value: '2x_ao_dia', rows: 2, scheduleType: 'daily' },
  { label: '3x ao dia', value: '3x_ao_dia', rows: 3, scheduleType: 'daily' },
  { label: '1x por semana', value: '1x_por_semana', rows: 1, scheduleType: 'weekly' },
];
const BOLUS_INSULIN_OPTIONS = [
  {
    label: 'Apidra — Glulisina (U-100)',
    brand: 'Apidra',
    molecule: 'Glulisina',
    concentration: 'U-100',
    actionClass: 'Análogo rápido',
    actionProfileKey: 'rapida',
    allowedDevices: ['Caneta', 'Seringa + frasco', 'Cartucho/refil', 'Bomba de insulina'],
    backendPresentation: 'Caneta, frasco ou refil conforme disponibilidade',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '5–15 minutos',
    peakLabel: '30 minutos–2 horas',
    durationLabel: '3–5 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: '0–15 minutos antes da refeição ou conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Fiasp — Asparte ultrarrápida / faster aspart (U-100)',
    brand: 'Fiasp',
    molecule: 'Asparte ultrarrápida / faster aspart',
    concentration: 'U-100',
    actionClass: 'Análogo ultrarrápido',
    actionProfileKey: 'ultrarrapida',
    allowedDevices: ['Caneta', 'Seringa + frasco', 'Cartucho/refil', 'Bomba de insulina'],
    backendPresentation: 'Caneta, frasco ou Penfill conforme disponibilidade',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '2–5 minutos',
    peakLabel: '1–3 horas',
    durationLabel: '~5 horas',
    suggestedUsage: 'inicio_refeicao',
    administrationTimingLabel:
      'No início da refeição ou até 20 minutos após iniciar a refeição, conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Humalog — Lispro (U-100)',
    brand: 'Humalog',
    molecule: 'Lispro',
    concentration: 'U-100',
    actionClass: 'Análogo rápido',
    actionProfileKey: 'rapida',
    allowedDevices: ['Caneta', 'Seringa + frasco', 'Cartucho/refil', 'Bomba de insulina'],
    backendPresentation: 'Caneta, frasco ou refil conforme disponibilidade',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '~15 minutos',
    peakLabel: '30 minutos–2 horas',
    durationLabel: '3–5 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: '0–15 minutos antes da refeição ou conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Humulin R — Regular humana (U-100)',
    brand: 'Humulin R',
    molecule: 'Insulina humana regular',
    concentration: 'U-100',
    actionClass: 'Curta duração / Regular',
    actionProfileKey: 'rapida',
    allowedDevices: ['Seringa + frasco', 'Caneta'],
    backendPresentation: 'Frasco ou caneta conforme disponibilidade',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '30–60 minutos',
    peakLabel: '2–3 horas',
    durationLabel: '5–8 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: '30 minutos antes da refeição ou conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Novolin R — Regular humana (U-100)',
    brand: 'Novolin R',
    molecule: 'Insulina humana regular',
    concentration: 'U-100',
    actionClass: 'Curta duração / Regular',
    actionProfileKey: 'rapida',
    allowedDevices: ['Seringa + frasco', 'Caneta', 'Cartucho/refil'],
    backendPresentation: 'Frasco, FlexPen ou Penfill conforme disponibilidade',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '30–60 minutos',
    peakLabel: '2–3 horas',
    durationLabel: '5–8 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: '30 minutos antes da refeição ou conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'NovoRapid — Asparte (U-100)',
    brand: 'NovoRapid',
    molecule: 'Asparte',
    concentration: 'U-100',
    actionClass: 'Análogo rápido',
    actionProfileKey: 'rapida',
    allowedDevices: ['Caneta', 'Seringa + frasco', 'Cartucho/refil', 'Bomba de insulina'],
    backendPresentation: 'Frasco, FlexPen ou Penfill conforme disponibilidade',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '10–20 minutos',
    peakLabel: '1–3 horas',
    durationLabel: '3–5 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: 'Imediatamente antes da refeição ou logo após, conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Lispro genérica/biossimilar — Lispro (U-100)',
    brand: 'Lispro genérica/biossimilar',
    molecule: 'Lispro',
    concentration: 'U-100',
    actionClass: 'Análogo rápido',
    actionProfileKey: 'rapida',
    allowedDevices: ['Caneta', 'Seringa + frasco', 'Cartucho/refil', 'Bomba de insulina'],
    backendPresentation: 'Conforme fabricante',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '5–15 minutos',
    peakLabel: '30 minutos–2 horas',
    durationLabel: '3–5 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: '0–15 minutos antes da refeição ou conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Asparte genérica/biossimilar — Asparte (U-100)',
    brand: 'Asparte genérica/biossimilar',
    molecule: 'Asparte',
    concentration: 'U-100',
    actionClass: 'Análogo rápido',
    actionProfileKey: 'rapida',
    allowedDevices: ['Caneta', 'Seringa + frasco', 'Cartucho/refil', 'Bomba de insulina'],
    backendPresentation: 'Conforme fabricante',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '5–15 minutos',
    peakLabel: '30 minutos–2 horas',
    durationLabel: '3–5 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: '0–15 minutos antes da refeição ou conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Glulisina genérica/biossimilar — Glulisina (U-100)',
    brand: 'Glulisina genérica/biossimilar',
    molecule: 'Glulisina',
    concentration: 'U-100',
    actionClass: 'Análogo rápido',
    actionProfileKey: 'rapida',
    allowedDevices: ['Caneta', 'Seringa + frasco', 'Cartucho/refil', 'Bomba de insulina'],
    backendPresentation: 'Conforme fabricante',
    suggestedRoute: 'Subcutânea',
    scaleUnit: '1 UI',
    doseStep: 1,
    doseUnit: 'UI',
    onsetLabel: '5–15 minutos',
    peakLabel: '30 minutos–2 horas',
    durationLabel: '3–5 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: '0–15 minutos antes da refeição ou conforme prescrição',
    status: 'ativo',
  },
  {
    label: 'Afrezza — Insulina humana inalável',
    brand: 'Afrezza',
    molecule: 'Insulina humana inalável',
    concentration: 'Cartuchos de dose fixa',
    actionClass: 'Ultrarrápida inalável',
    actionProfileKey: 'inalavel',
    allowedDevices: ['Inalador'],
    backendPresentation: 'Pó inalável em cartuchos',
    suggestedRoute: 'Inalatória',
    scaleUnit: 'Cartucho',
    doseStep: null,
    doseUnit: 'UI por cartucho',
    onsetLabel: 'Imediato',
    peakLabel: '~50 minutos',
    durationLabel: '2–3 horas',
    suggestedUsage: 'antes_refeicoes',
    administrationTimingLabel: 'Imediatamente antes da refeição, conforme prescrição',
    status: 'opcional_disponibilidade_limitada',
    enabledByDefault: false,
  },
];
const BOLUS_MODE_OPTIONS = [
  { label: 'Antes das refeições', value: 'antes_refeicoes' },
  { label: 'No início da refeição', value: 'inicio_refeicao' },
  { label: 'Após iniciar a refeição', value: 'apos_inicio_refeicao' },
  { label: 'Correção de glicemia', value: 'correcao_glicemia' },
  { label: 'Contagem de carboidratos', value: 'contagem_carboidratos' },
  { label: 'Dose fixa por refeição', value: 'dose_fixa_refeicao' },
  { label: 'Conforme prescrição', value: 'conforme_prescricao' },
];
const BOLUS_MEAL_OPTIONS = [
  { label: 'Café da manhã', value: 'cafe_manha' },
  { label: 'Almoço', value: 'almoco' },
  { label: 'Jantar', value: 'jantar' },
  { label: 'Lanche', value: 'lanche' },
  { label: 'Ceia', value: 'ceia' },
  { label: 'Correção', value: 'correcao' },
  { label: 'Outro', value: 'outro' },
];
const BOLUS_DOSE_TYPE_OPTIONS = [
  { label: 'Dose fixa', value: 'dose_fixa' },
  { label: 'Dose por carboidrato', value: 'dose_carboidrato' },
  { label: 'Dose de correção', value: 'dose_correcao' },
  { label: 'Dose variável', value: 'dose_variavel' },
];
const BASAL_INTEGER_DOSE_ERROR_MESSAGE = 'A dose deve ser um número inteiro (UI).';
const BASAL_DUPLICATE_TIME_ERROR_MESSAGE = 'Já existe uma aplicação cadastrada nesse horário.';
const BASAL_INCOMPATIBLE_FREQUENCY_ERROR_MESSAGE =
  'Essa frequência não é compatível com a insulina selecionada.';
const THERAPY_WEEKDAY_OPTIONS = [
  { label: 'Segunda-feira', value: 'Segunda-feira' },
  { label: 'Terça-feira', value: 'Terça-feira' },
  { label: 'Quarta-feira', value: 'Quarta-feira' },
  { label: 'Quinta-feira', value: 'Quinta-feira' },
  { label: 'Sexta-feira', value: 'Sexta-feira' },
  { label: 'Sábado', value: 'Sábado' },
  { label: 'Domingo', value: 'Domingo' },
];
const INSULIN_USAGE_OPTIONS = {
  basal: ['Rotina da manha', 'Rotina da noite', 'Semanal', 'Outro horario fixo'],
  prandial: ['Antes da refeicao', 'Correcao', 'Antes da refeicao e correcao'],
  premixed: ['Antes da refeicao', 'Rotina prescrita', 'Outro horario fixo'],
  inhaled: ['Antes da refeicao', 'Correcao', 'Antes da refeicao e correcao'],
};
const PHARMACOLOGY_CATEGORY_OPTIONS = [
  {
    label: 'Basal',
    value: 'basal',
    descricao: 'Insulina de fundo, usada para manter a glicemia estável ao longo do dia/noite',
  },
  {
    label: 'Bolus',
    value: 'bolus',
    descricao: 'Insulina usada para refeições ou correção de glicemia alta',
  },
  {
    label: 'Mista',
    value: 'mista',
    descricao: 'Insulina pré-misturada, combinando ação rápida/regular com intermediária',
  },
];
const PHARMACOLOGY_BRAND_OPTIONS = {
  bolus: [
    { marca: 'Humalog', molecula: 'insulina lispro', classe_acao: 'rapida', categoria_funcional: 'bolus' },
    { marca: 'Lyumjev', molecula: 'insulina lispro-aabc', classe_acao: 'ultrarrapida', categoria_funcional: 'bolus' },
    { marca: 'NovoRapid', molecula: 'insulina asparte', classe_acao: 'rapida', categoria_funcional: 'bolus' },
    { marca: 'Fiasp', molecula: 'insulina asparte', classe_acao: 'ultrarrapida', categoria_funcional: 'bolus' },
    { marca: 'Apidra', molecula: 'insulina glulisina', classe_acao: 'rapida', categoria_funcional: 'bolus' },
    { marca: 'Humulin R', molecula: 'insulina humana regular', classe_acao: 'rapida', categoria_funcional: 'bolus' },
    { marca: 'Novolin R', molecula: 'insulina humana regular', classe_acao: 'rapida', categoria_funcional: 'bolus' },
    { marca: 'Afrezza', molecula: 'insulina humana', classe_acao: 'inalavel', categoria_funcional: 'bolus' },
  ],
  basal: [
    { marca: 'Basaglar', molecula: 'Glargina', classe_acao: 'longa', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Densulin N', molecula: 'NPH / Insulina humana isofana', classe_acao: 'intermediaria', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Glargilin', molecula: 'Glargina', classe_acao: 'longa', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Humulin N', molecula: 'NPH / Insulina humana isofana', classe_acao: 'intermediaria', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Insulatard', molecula: 'NPH / Insulina humana isofana', classe_acao: 'intermediaria', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Insulex N', molecula: 'NPH / Insulina humana isofana', classe_acao: 'intermediaria', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Insuman Basal', molecula: 'NPH / Insulina humana isofana', classe_acao: 'intermediaria', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Lantus', molecula: 'Glargina', classe_acao: 'longa', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Levemir', molecula: 'Detemir', classe_acao: 'longa', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Novolin N', molecula: 'NPH / Insulina humana isofana', classe_acao: 'intermediaria', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    {
      marca: 'Semglee',
      molecula: 'Glargina',
      classe_acao: 'longa',
      categoria_funcional: 'basal',
      concentracao: 'U-100',
      apresentacao: 'Caneta preenchida 3 mL',
      via: 'subcutanea',
    },
    { marca: 'Toujeo', molecula: 'Glargina', classe_acao: 'ultralonga', categoria_funcional: 'basal', apresentacao: 'U300', via: 'subcutanea' },
    { marca: 'Tresiba', molecula: 'Degludeca', classe_acao: 'ultralonga', categoria_funcional: 'basal', apresentacao: 'U100', via: 'subcutanea' },
    { marca: 'Awiqli', molecula: 'Icodeca', classe_acao: 'ultralonga', categoria_funcional: 'basal', apresentacao: 'U700', via: 'subcutanea' },
  ],
  mista: [
    { marca: 'NovoMix 30', molecula: 'insulina asparte + insulina asparte protaminada', classe_acao: 'premisturada', categoria_funcional: 'mista' },
    { marca: 'Humalog Mix 25', molecula: 'insulina lispro + insulina lispro protamina', classe_acao: 'premisturada', categoria_funcional: 'mista' },
    { marca: 'Humalog Mix 50', molecula: 'insulina lispro + insulina lispro protamina', classe_acao: 'premisturada', categoria_funcional: 'mista' },
    { marca: 'Humulin 70N/30R', molecula: 'insulina humana NPH + insulina humana regular', classe_acao: 'premisturada', categoria_funcional: 'mista' },
    { marca: 'Novolin 70/30', molecula: 'insulina humana NPH + insulina humana regular', classe_acao: 'premisturada', categoria_funcional: 'mista' },
  ],
};
const PHARMACOLOGY_DEVICE_OPTIONS = [
  { label: 'Caneta', value: 'caneta' },
  { label: 'Seringa + frasco', value: 'seringa_frasco' },
  { label: 'Cartucho/refil', value: 'cartucho_refil' },
  { label: 'Bomba de insulina', value: 'bomba' },
  { label: 'Inalador', value: 'inalador' },
];
const PHARMACOLOGY_PRESENTATION_OPTIONS = [
  { label: 'U100', value: 'U100' },
  { label: 'U200', value: 'U200' },
  { label: 'U300', value: 'U300' },
  { label: 'U700', value: 'U700' },
  { label: '4 UI', value: '4UI' },
  { label: '8 UI', value: '8UI' },
  { label: '12 UI', value: '12UI' },
];
const PHARMACOLOGY_VIA_OPTIONS = [
  { label: 'Subcutânea', value: 'subcutanea' },
  { label: 'InalatÃ³ria', value: 'inalatoria' },
];
const PHARMACOLOGY_SCALE_OPTIONS = [
  { label: '0,25', value: '0,25', descricao: 'Escala de dose com incremento de 0,25 unidade' },
  { label: '0,5', value: '0,5', descricao: 'Escala de dose com incremento de 0,5 unidade' },
  { label: '1', value: '1', descricao: 'Escala de dose com incremento de 1 unidade' },
  { label: '2', value: '2', descricao: 'Escala de dose com incremento de 2 unidades' },
];
const PHARMACOLOGY_ACTION_PROFILE = {
  inalavel: { inicio_acao: 'muito rÃ¡pido', pico: 'curto', duracao: 'curta' },
  ultrarrapida: { inicio_acao: 'muito rÃ¡pido', pico: 'rÃ¡pido', duracao: 'curta' },
  rapida: { inicio_acao: 'rÃ¡pido', pico: 'presente', duracao: 'curta' },
  intermediaria: { inicio_acao: 'moderado', pico: 'presente', duracao: 'intermediÃ¡ria' },
  longa: { inicio_acao: 'lento', pico: 'baixo ou sem pico definido', duracao: 'longa' },
  ultralonga: { inicio_acao: 'lento', pico: 'sem pico importante', duracao: 'muito longa' },
  semanal: { inicio_acao: 'lento', pico: 'sem pico importante', duracao: 'semanal' },
  premisturada: { inicio_acao: 'variÃ¡vel', pico: 'presente', duracao: 'mista' },
};
const PHARMACOLOGY_STATUS_OPTIONS = [
  { label: 'Ativo', value: 'ativo' },
  { label: 'Inativo', value: 'inativo' },
];

function findBasalProfileOption(value) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) return null;

  return (
    BASAL_INSULIN_PROFILE_OPTIONS.find((option) => option.label === normalizedValue) ||
    BASAL_INSULIN_PROFILE_OPTIONS.find((option) => option.brand === normalizedValue) ||
    null
  );
}

function findBasalTherapyOption(brandOrLabel, presentation = '') {
  const normalizedValue = String(brandOrLabel || '').trim();
  const normalizedPresentation = String(presentation || '').trim().toUpperCase();

  if (!normalizedValue) return null;

  const exactLabelMatch = BASAL_INSULIN_PROFILE_OPTIONS.find((option) => option.label === normalizedValue);
  if (exactLabelMatch) return exactLabelMatch;

  const brandMatches = BASAL_INSULIN_PROFILE_OPTIONS.filter((option) => option.brand === normalizedValue);
  if (!brandMatches.length) return null;

  if (normalizedPresentation) {
    const presentationMatch = brandMatches.find(
      (option) => String(option.concentration || '').trim().toUpperCase().replace('-', '') === normalizedPresentation
    );
    if (presentationMatch) return presentationMatch;
  }

  return brandMatches[0] || null;
}

function getBasalDisplayMetadata(brandOrLabel, presentation = '') {
  const basalOption = findBasalTherapyOption(brandOrLabel, presentation);

  if (!basalOption) {
    return {
      actionClass: '',
      onsetLabel: '',
      peakLabel: '',
      durationLabel: '',
      actionProfileKey: '',
    };
  }

  return {
    actionClass: basalOption.actionClass || '',
    onsetLabel: basalOption.onsetLabel || '',
    peakLabel: basalOption.peakLabel || '',
    durationLabel: basalOption.durationLabel || '',
    actionProfileKey: basalOption.actionProfileKey || '',
  };
}

function findBolusProfileOption(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return null;

  return (
    BOLUS_INSULIN_OPTIONS.find((option) => option.label === normalizedValue) ||
    BOLUS_INSULIN_OPTIONS.find((option) => option.brand === normalizedValue) ||
    null
  );
}

function findBolusTherapyOption(brandOrLabel, presentation = '') {
  const normalizedValue = String(brandOrLabel || '').trim();
  const normalizedPresentation = String(presentation || '').trim().toUpperCase();

  if (!normalizedValue) return null;

  const exactLabelMatch = BOLUS_INSULIN_OPTIONS.find((option) => option.label === normalizedValue);
  if (exactLabelMatch) return exactLabelMatch;

  const brandMatches = BOLUS_INSULIN_OPTIONS.filter((option) => option.brand === normalizedValue);
  if (!brandMatches.length) return null;

  if (normalizedPresentation) {
    const presentationMatch = brandMatches.find(
      (option) => String(option.concentration || '').trim().toUpperCase().replace('-', '') === normalizedPresentation
    );
    if (presentationMatch) return presentationMatch;
  }

  return brandMatches[0] || null;
}

function getBolusDisplayMetadata(brandOrLabel, presentation = '') {
  const bolusOption = findBolusTherapyOption(brandOrLabel, presentation);

  if (!bolusOption) {
    return {
      actionClass: '',
      onsetLabel: '',
      peakLabel: '',
      durationLabel: '',
      administrationTimingLabel: '',
      actionProfileKey: '',
    };
  }

  return {
    actionClass: bolusOption.actionClass || '',
    onsetLabel: bolusOption.onsetLabel || '',
    peakLabel: bolusOption.peakLabel || '',
    durationLabel: bolusOption.durationLabel || '',
    administrationTimingLabel: bolusOption.administrationTimingLabel || '',
    actionProfileKey: bolusOption.actionProfileKey || '',
  };
}

function getBolusUsageOptions() {
  return BOLUS_MODE_OPTIONS;
}

function normalizeBolusUsageValue(value) {
  const match = BOLUS_MODE_OPTIONS.find((option) => option.value === value || option.label === value);
  return match?.value || String(value || '').trim();
}

function getBolusUsageConfig(value) {
  return BOLUS_MODE_OPTIONS.find((option) => option.value === value || option.label === value) || null;
}

function buildBolusScheduleRowsForUsage(_usageValue, existingRows = []) {
  if (Array.isArray(existingRows) && existingRows.length) {
    return existingRows.map((item) => ({
      ...createEmptyTherapyScheduleRow(),
      ...item,
      dia_semana: '',
      refeicao: String(item?.refeicao || '').trim(),
      horario: String(item?.horario || '').trim(),
      dose: String(item?.dose ?? '').trim(),
      dose_unidade: String(item?.dose_unidade || 'UI').trim(),
      tipo_dose: String(item?.tipo_dose || '').trim(),
      observacao: String(item?.observacao || '').trim(),
    }));
  }

  return [createEmptyTherapyScheduleRow()];
}

function getBasalFrequencyOptions(brandOrLabel, presentation = '') {
  const basalOption = findBasalTherapyOption(brandOrLabel, presentation);
  const allowedFrequencies = basalOption?.allowedFrequencies || [];

  if (!allowedFrequencies.length) return [];

  return BASAL_FREQUENCY_OPTIONS.filter((option) => allowedFrequencies.includes(option.value));
}

function normalizeBasalFrequencyValue(value) {
  const match = BASAL_FREQUENCY_OPTIONS.find(
    (option) => option.value === value || option.label === value
  );
  return match?.value || String(value || '').trim();
}

function getBasalFrequencyConfig(value) {
  return BASAL_FREQUENCY_OPTIONS.find(
    (option) => option.value === value || option.label === value
  ) || null;
}

function getOptionLabelByValue(options, value) {
  return options.find((option) => option.value === value || option.label === value)?.label || value || '';
}

function buildTherapyScheduleRowsForFrequency(frequencyValue, existingRows = []) {
  const frequencyConfig = getBasalFrequencyConfig(frequencyValue);

  if (!frequencyConfig) return [createEmptyTherapyScheduleRow()];

  return Array.from({ length: frequencyConfig.rows }, (_, index) => {
    const existing = existingRows[index] || {};
    const isWeekly = frequencyConfig.scheduleType === 'weekly';

    return {
      ...createEmptyTherapyScheduleRow(),
      ...existing,
      dia_semana: isWeekly ? String(existing?.dia_semana || '').trim() : '',
      horario: String(existing?.horario || '').trim(),
      dose: String(existing?.dose ?? '').trim(),
      dose_unidade: 'UI',
      observacao: String(existing?.observacao || '').trim(),
    };
  });
}

function sanitizeIntegerInput(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function isPositiveIntegerString(value) {
  return /^[1-9]\d*$/.test(String(value || '').trim());
}

function isPositiveDoseString(value) {
  return /^(?:[1-9]\d*)(?:,\d+)?$/.test(String(value || '').trim());
}

function normalizeDoseStepValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  if (number === 1 || number === 0.5 || number === 0.1) return number;
  return number;
}

function resolveDoseStepForPlan(plan) {
  if (String(plan?.categoria_funcional || '').trim() === 'basal') return 1;
  return normalizeDoseStepValue(plan?.doseStep);
}

function isDoseCompatibleWithStep(value, doseStep) {
  const normalizedDose = normalizeNumber(value);
  const normalizedStep = normalizeDoseStepValue(doseStep);

  if (!Number.isFinite(normalizedDose) || normalizedDose <= 0) return false;
  if (!normalizedStep) return true;

  const scaledDose = Math.round(normalizedDose / normalizedStep);
  const reconstructedDose = scaledDose * normalizedStep;

  return Math.abs(reconstructedDose - normalizedDose) < 1e-9;
}

function getDoseStepValidationMessage(doseStep) {
  const normalizedStep = normalizeDoseStepValue(doseStep);

  if (normalizedStep === 1) return 'A dose deve ser um número inteiro (UI).';
  if (normalizedStep === 0.5) return 'A dose deve respeitar incrementos de 0,5 UI.';
  if (normalizedStep === 0.1) return 'A dose deve respeitar incrementos de 0,1 UI.';

  return 'A dose informada não é compatível com o incremento permitido.';
}

function getTherapyScheduleSummaryItem(item, doseUnit = 'UI') {
  return [
    String(item?.dia_semana || '').trim(),
    getOptionLabelByValue(BOLUS_MEAL_OPTIONS, item?.refeicao),
    String(item?.horario || '').trim(),
    item?.dose ? `${item.dose} ${item?.dose_unidade || doseUnit}` : '',
    getOptionLabelByValue(BOLUS_DOSE_TYPE_OPTIONS, item?.tipo_dose),
    String(item?.observacao || '').trim(),
  ]
    .filter(Boolean)
    .join(' • ');
}

function isValidTime24h(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim());
}

const ONBOARDING_OBJECTIVE_OPTIONS = [
  'Perder peso',
  'Ganhar peso',
  'Melhorar a alimentaÃ§Ã£o',
  'Controle do diabetes',
  'Controle da hipertensÃ£o arterial',
  'Melhorar o colesterol',
  'Cuidar da saÃºde mental',
  'Melhorar a qualidade de vida',
  'Cuidar de condiÃ§Ãµes de saÃºde',
];

const ONBOARDING_CONDITION_OPTIONS = [
  'Colesterol alto',
  'Diabetes',
  'DoenÃ§as cardiovasculares',
  'DoenÃ§a hepÃ¡tica (fÃ­gado)',
  'DoenÃ§as renais',
  'Obesidade',
  'SÃ­ndrome dos ovÃ¡rios policÃ­sticos',
  'Tireoide',
  'TriglicerÃ­deos altos',
  'NÃ£o possuo',
];

const ONBOARDING_SITUATION_OPTIONS = [
  'Acidente vascular cerebral (AVC)',
  'CandidÃ­ase recorrente',
  'Infarto prÃ©vio',
  'Neuropatia diabÃ©tica',
  'PÃ© diabÃ©tico',
  'Retinopatia diabÃ©tica',
  'Ãšlcera em alguma parte do corpo',
  'NÃ£o tive',
];

const ONBOARDING_PROCEDURE_OPTIONS = [
  'AmputaÃ§Ã£o de membro',
  'Cateterismo prÃ©vio',
  'Cirurgia de revascularizaÃ§Ã£o (ponte de safena)',
  'Portador de marcapasso',
  'NÃ£o realizei',
  'Outros',
];

const ONBOARDING_OBJECTIVE_MAX = 3;
const ONBOARDING_CONDITION_NONE = 'NÃ£o possuo';
const ONBOARDING_SITUATION_NONE = 'NÃ£o tive';
const ONBOARDING_PROCEDURE_NONE = 'NÃ£o realizei';

const EMPTY_CLINICAL_FORM = {
  objetivos: '',
  condicoes: '',
  situacoes: '',
  procedimentos: '',
  procedimento_outros: '',
  diabetes: '',
  diabetes_status: '',
  diabetes_tipo: '',
  insulinoterapia_atual: '',
  basal_insulin_type: '',
  basal_insulin_device: '',
  basal_insulin_usage: '',
  basal_insulin_dose: '',
  basal_insulin_notes: '',
  bolus_insulin_type: '',
  bolus_insulin_usage: '',
  bolus_insulin_dose: '',
  bolus_insulin_notes: '',
  nivel_atividade_fisica_atual: '',
  qualidade_sono_media: '',
  altura_cm: '',
  peso_atual_kg: '',
  imc_calculado: '',
  alergias_texto: '',
  comorbidades_texto: '',
  historico_familiar_doencas: '',
};

const PATIENT_PROFILE_FIELDS = [
  {
    key: 'nome_completo',
    label: 'Nome completo',
    placeholder: 'Ex: Ana Silva',
    autoCapitalize: 'words',
  },
  {
    key: 'cpf_paciente',
    label: 'CPF',
    placeholder: '000.000.000-00',
    keyboardType: 'numeric',
    maxLength: 14,
    formatter: formatCpfInput,
  },
  {
    key: 'email_pac',
    label: 'E-mail',
    placeholder: 'email@exemplo.com',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
  },
  {
    key: 'telefone',
    label: 'Telefone',
    placeholder: '(00) 00000-0000',
    keyboardType: 'phone-pad',
    maxLength: 15,
    formatter: formatPhoneInput,
  },
  {
    key: 'data_nascimento',
    label: 'Data de nascimento',
    placeholder: 'DD/MM/AAAA',
    keyboardType: 'numeric',
    maxLength: 10,
    formatter: formatDateInput,
  },
  {
    key: 'sexo_biologico',
    label: 'GÃªnero',
    placeholder: 'Selecione',
    type: 'select',
  },
  {
    key: 'cep',
    label: 'CEP',
    placeholder: '00000-000',
    keyboardType: 'numeric',
    maxLength: 9,
    formatter: formatCepInput,
  },
  {
    key: 'logradouro',
    label: 'Logradouro',
    placeholder: 'Ex: Rua das Flores',
    autoCapitalize: 'words',
  },
  {
    key: 'numero',
    label: 'NÃºmero',
    placeholder: 'Ex: 123',
    keyboardType: 'numeric',
  },
  {
    key: 'bairro',
    label: 'Bairro',
    placeholder: 'Ex: Centro',
    autoCapitalize: 'words',
  },
  {
    key: 'cidade',
    label: 'Cidade',
    placeholder: 'Ex: Curitiba',
    autoCapitalize: 'words',
  },
  {
    key: 'uf',
    label: 'UF',
    placeholder: 'Ex: PR',
    autoCapitalize: 'characters',
    maxLength: 2,
    formatter: (value) => String(value || '').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
  },
];

const CLINICAL_PROFILE_FIELDS = [
  {
    key: 'objetivos',
    label: 'Objetivos nutricionais',
    placeholder: 'Ex: Perder peso, Controle do diabetes',
    multiline: true,
  },
  {
    key: 'condicoes',
    label: 'CondiÃ§Ãµes clÃ­nicas',
    placeholder: 'Ex: Colesterol alto, Diabetes',
    multiline: true,
  },
  {
    key: 'situacoes',
    label: 'ComplicaÃ§Ãµes clÃ­nicas',
    placeholder: 'Ex: Neuropatia diabÃ©tica',
    multiline: true,
  },
  {
    key: 'procedimentos',
    label: 'Procedimentos clÃ­nicos',
    placeholder: 'Ex: Cateterismo prÃ©vio',
    multiline: true,
  },
  {
    key: 'procedimento_outros',
    label: 'Outro procedimento',
    placeholder: 'Descreva outro procedimento',
    multiline: true,
  },
  {
    key: 'diabetes',
    label: 'Diabetes',
    placeholder: 'Selecione',
    type: 'diabetes',
  },
  {
    key: 'insulinoterapia_atual',
    label: 'Uso de insulina',
    placeholder: 'Ex: Basal e ultrarrapida, bomba de insulina, nao usa, em ajuste',
    multiline: true,
  },
  {
    key: 'nivel_atividade_fisica_atual',
    label: 'Atividade fÃ­sica atual',
    placeholder: 'Ex: Caminhada 3x por semana',
  },
  {
    key: 'qualidade_sono_media',
    label: 'Qualidade mÃ©dia do sono',
    placeholder: 'Ex: Boa',
  },
  {
    key: 'altura_cm',
    label: 'Altura',
    placeholder: 'Ex: 170',
    keyboardType: 'decimal-pad',
    formatter: formatDecimalInput,
  },
  {
    key: 'peso_atual_kg',
    label: 'Peso atual',
    placeholder: 'Ex: 72,5',
    keyboardType: 'decimal-pad',
    formatter: formatDecimalInput,
  },
  {
    key: 'imc_calculado',
    label: 'IMC calculado',
    placeholder: 'Calculado automaticamente',
    readOnly: true,
  },
  {
    key: 'alergias_texto',
    label: 'Alergias',
    placeholder: 'Ex: Lactose, frutos do mar',
    multiline: true,
  },
  {
    key: 'comorbidades_texto',
    label: 'Comorbidades',
    placeholder: 'Ex: HipertensÃ£o arterial',
    multiline: true,
  },
  {
    key: 'historico_familiar_doencas',
    label: 'HistÃ³rico familiar/doenÃ§as',
    placeholder: 'Ex: Diabetes na famÃ­lia',
    multiline: true,
  },
];

function onlyDigits(value, maxLength) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

function formatCpfInput(value) {
  const numbers = onlyDigits(value, 11);

  return numbers
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function formatCepInput(value) {
  const numbers = onlyDigits(value, 8);
  return numbers.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatPhoneInput(value) {
  const numbers = onlyDigits(value, 11);

  if (numbers.length <= 2) return numbers ? `(${numbers}` : '';

  const ddd = numbers.slice(0, 2);
  const rest = numbers.slice(2);

  if (rest.length <= 4) return `(${ddd}) ${rest}`;

  const firstPartLength = numbers.length > 10 ? 5 : 4;
  const firstPart = rest.slice(0, firstPartLength);
  const secondPart = rest.slice(firstPartLength);

  return secondPart ? `(${ddd}) ${firstPart}-${secondPart}` : `(${ddd}) ${firstPart}`;
}

function formatDecimalInput(value) {
  const text = String(value || '').replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const [integerPart, ...decimalParts] = text.split(',');
  const integer = integerPart.slice(0, 4);
  const decimal = decimalParts.join('').slice(0, 2);

  return decimalParts.length ? `${integer},${decimal}` : integer;
}

function formatTimeInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function formatSingleDecimalDoseInput(value) {
  const text = String(value || '').replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const [integerPart = '', decimalPart = ''] = text.split(',');
  const integer = integerPart.slice(0, 4);
  const decimal = decimalPart.replace(/\D/g, '').slice(0, 1);

  if (!integer) return '';
  if (text.includes(',')) return `${integer},${decimal}`;
  if (integer.length >= 2) return `${integer},0`;

  return integer;
}

function ensureSingleDecimalDoseInput(value) {
  const text = String(value || '').trim();

  if (!text) return '';

  if (text.includes(',')) {
    const [integerPart = '', decimalPart = ''] = text.split(',');
    const integer = integerPart.replace(/\D/g, '').slice(0, 4);
    const decimal = decimalPart.replace(/\D/g, '').slice(0, 1) || '0';

    return integer ? `${integer},${decimal}` : '';
  }

  const integer = text.replace(/\D/g, '').slice(0, 4);
  return integer ? `${integer},0` : '';
}

function normalizeNumber(value) {
  const text = String(value || '').trim().replace(',', '.');
  if (!text) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function formatNumberForInput(value) {
  if (value === null || value === undefined || value === '') return '';

  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);

  return String(number).replace('.', ',');
}

function formatImcValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';

  return number.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 1,
  });
}

function calculateImcNumber(heightValue, weightValue) {
  const heightCm = normalizeNumber(heightValue);
  const weightKg = normalizeNumber(weightValue);

  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;

  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

function formatDateInput(value) {
  const text = String(value || '').trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  const numbers = onlyDigits(text, 8);

  return numbers
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

function buildIsoDate(year, month, day) {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const date = new Date(yearNumber, monthNumber - 1, dayNumber);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (
    yearNumber < 1900 ||
    date.getFullYear() !== yearNumber ||
    date.getMonth() !== monthNumber - 1 ||
    date.getDate() !== dayNumber ||
    date > today
  ) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

function isValidCpf(value) {
  const cpf = onlyDigits(value, 11);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf.charAt(index)) * (10 - index);
  }

  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number(cpf.charAt(9))) return false;

  sum = 0;
  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf.charAt(index)) * (11 - index);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;

  return remainder === Number(cpf.charAt(10));
}

function normalizeDateForSave(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return buildIsoDate(year, month, day);
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return buildIsoDate(year, month, day);
  }

  return undefined;
}

function buildEditableProfileForm(patient) {
  return {
    ...EMPTY_PROFILE_FORM,
    nome_completo: patient?.nome_completo || '',
    cpf_paciente: formatCpfInput(patient?.cpf_paciente || ''),
    email_pac: patient?.email_pac || patient?.email || '',
    telefone: formatPhoneInput(patient?.telefone || ''),
    data_nascimento: formatDateInput(patient?.data_nascimento || ''),
    sexo_biologico: patient?.sexo_biologico || '',
    cep: formatCepInput(patient?.cep || ''),
    logradouro: patient?.logradouro || '',
    numero: patient?.numero || '',
    bairro: patient?.bairro || '',
    cidade: patient?.cidade || '',
    uf: (patient?.uf || '').toUpperCase(),
  };
}

function buildProfilePatch(form) {
  return {
    nome_completo: form.nome_completo.trim() || null,
    cpf_paciente: onlyDigits(form.cpf_paciente, 11) || null,
    email_pac: form.email_pac.trim().toLowerCase() || null,
    telefone: onlyDigits(form.telefone, 11) || null,
    data_nascimento: normalizeDateForSave(form.data_nascimento),
    sexo_biologico: form.sexo_biologico.trim() || null,
    cep: onlyDigits(form.cep, 8) || null,
    logradouro: form.logradouro.trim() || null,
    numero: form.numero.trim() || null,
    bairro: form.bairro.trim() || null,
    cidade: form.cidade.trim() || null,
    uf: form.uf.trim().toUpperCase() || null,
  };
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value || '').trim();
}

function normalizeDisplayText(value) {
  const text = String(value || '');

  if (!text) return '';

  const replacements = [
    ['NÃ£o', 'Não'],
    ['nÃ£o', 'não'],
    ['Ã¡', 'á'],
    ['Ã ', 'à'],
    ['Ã¢', 'â'],
    ['Ã£', 'ã'],
    ['Ã©', 'é'],
    ['Ãª', 'ê'],
    ['Ã­', 'í'],
    ['Ã³', 'ó'],
    ['Ã´', 'ô'],
    ['Ãµ', 'õ'],
    ['Ãº', 'ú'],
    ['Ã§', 'ç'],
    ['Ã‰', 'É'],
    ['ÃŠ', 'Ê'],
    ['Ã“', 'Ó'],
    ['Ãš', 'Ú'],
    ['Ã‡', 'Ç'],
    ['â€¢', '•'],
    ['â€”', '—'],
    ['ÃƒÂ³', 'ó'],
    ['ÃƒÂ£', 'ã'],
    ['ÃƒÂ§', 'ç'],
  ];

  return replacements.reduce((current, [from, to]) => current.replaceAll(from, to), text);
}

function splitListText(value) {
  return ensureArray(value);
}

function buildFullAddressText(form) {
  const streetParts = [
    form.logradouro.trim(),
    form.numero.trim(),
  ].filter(Boolean);
  const cityState = buildCityStateText(form);
  const cep = formatCepInput(form.cep);
  const addressParts = [
    streetParts.length ? streetParts.join(', ') : '',
    form.bairro.trim(),
    cityState,
    cep,
  ].filter(Boolean);

  return addressParts.join(' - ');
}

function buildTherapyPlanId() {
  return `therapy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyTherapyScheduleRow() {
  return {
    dia_semana: '',
    refeicao: '',
    horario: '',
    dose: '',
    dose_unidade: 'UI',
    tipo_dose: '',
    observacao: '',
  };
}

function createEmptyTherapyPlan() {
  return {
    id: buildTherapyPlanId(),
    categoria_funcional: '',
    frequencia_uso: '',
    modo_uso: '',
    marca: '',
    molecula: '',
    classe_acao: '',
    dispositivo: '',
    concentracao: '',
    apresentacao: '',
    via: '',
    escala_unidade: 'UI',
    doseStep: null,
    dose: '',
    dose_unidade: 'UI',
    observacoes: '',
    tabela_horarios: [createEmptyTherapyScheduleRow()],
    inicio_acao: '',
    pico: '',
    duracao: '',
    tempo_aplicacao_sugerido: '',
    status: 'ativo',
    criado_em: '',
    atualizado_em: '',
  };
}

function inferViaFromDevice(device) {
  return device === 'inalador' ? 'inalatoria' : device ? 'subcutanea' : '';
}

function getBasalLookupValue(plan) {
  return String(plan?.concentracao || plan?.apresentacao || '').trim();
}

function getBolusLookupValue(plan) {
  return String(plan?.concentracao || plan?.apresentacao || '').trim();
}

function getActionProfileByClass(classeAcao) {
  return PHARMACOLOGY_ACTION_PROFILE[String(classeAcao || '').trim()] || {
    inicio_acao: '',
    pico: '',
    duracao: '',
  };
}

function hydrateTherapyPlanWithBrand(plan, brandOption) {
  if (brandOption?.categoria_funcional === 'bolus') {
    return hydrateBolusTherapyPlanWithBrand(plan, brandOption);
  }

  const resolvedBasalOption =
    brandOption?.categoria_funcional === 'basal'
      ? findBasalTherapyOption(
          brandOption?.label || brandOption?.marca,
          brandOption?.concentracao || brandOption?.apresentacao
        )
      : null;
  const resolvedActionClass = resolvedBasalOption
    ? resolvedBasalOption.actionProfileKey || ''
    : brandOption?.classe_acao;
  const actionProfile = getActionProfileByClass(resolvedActionClass);
  const nextDevice = resolvedBasalOption?.allowedDevices?.includes(plan?.dispositivo)
    ? plan?.dispositivo || ''
    : plan?.dispositivo || '';
  const nextVia = resolvedBasalOption ? 'subcutanea' : inferViaFromDevice(nextDevice) || plan?.via || '';

  return {
    ...plan,
    marca: resolvedBasalOption?.label || brandOption?.marca || '',
    molecula: resolvedBasalOption?.molecule || brandOption?.molecula || '',
    classe_acao: resolvedActionClass || '',
    categoria_funcional: brandOption?.categoria_funcional || plan?.categoria_funcional || '',
    dispositivo:
      resolvedBasalOption && !resolvedBasalOption.allowedDevices.includes(nextDevice) ? '' : nextDevice,
    concentracao:
      resolvedBasalOption?.concentration || brandOption?.concentracao || plan?.concentracao || '',
    apresentacao: resolvedBasalOption?.backendPresentation || brandOption?.apresentacao || plan?.apresentacao || '',
    via: nextVia,
    inicio_acao: resolvedBasalOption?.onsetLabel || actionProfile.inicio_acao,
    pico: resolvedBasalOption?.peakLabel || actionProfile.pico,
    duracao: resolvedBasalOption?.durationLabel || actionProfile.duracao,
    escala_unidade: resolvedBasalOption?.scaleUnit || plan?.escala_unidade || 'UI',
    doseStep:
      resolvedBasalOption?.doseStep ||
      resolveDoseStepForPlan({
        ...plan,
        categoria_funcional: brandOption?.categoria_funcional || plan?.categoria_funcional || '',
      }),
    dose_unidade: plan?.dose_unidade || 'UI',
    status: plan?.status || resolvedBasalOption?.status || 'ativo',
  };
}

function hydrateBolusTherapyPlanWithBrand(plan, brandOption) {
  const resolvedBolusOption =
    brandOption?.categoria_funcional === 'bolus'
      ? findBolusTherapyOption(
          brandOption?.label || brandOption?.marca,
          brandOption?.concentracao || brandOption?.apresentacao
        )
      : null;
  const resolvedActionClass = resolvedBolusOption
    ? resolvedBolusOption.actionProfileKey || ''
    : brandOption?.classe_acao;
  const actionProfile = getActionProfileByClass(resolvedActionClass);
  const allowedDevices = resolvedBolusOption?.allowedDevices || [];
  const nextDevice = allowedDevices.includes(plan?.dispositivo) ? plan?.dispositivo || '' : plan?.dispositivo || '';
  const nextVia = resolvedBolusOption
    ? resolvedBolusOption.suggestedRoute === 'Inalatória'
      ? 'inalatoria'
      : 'subcutanea'
    : inferViaFromDevice(nextDevice) || plan?.via || '';

  return {
    ...plan,
    marca: resolvedBolusOption?.label || brandOption?.marca || '',
    molecula: resolvedBolusOption?.molecule || brandOption?.molecula || '',
    classe_acao: resolvedActionClass || '',
    categoria_funcional: 'bolus',
    dispositivo:
      resolvedBolusOption && !allowedDevices.includes(nextDevice) ? '' : nextDevice,
    concentracao:
      resolvedBolusOption?.concentration || brandOption?.concentracao || plan?.concentracao || '',
    apresentacao:
      resolvedBolusOption?.backendPresentation || brandOption?.apresentacao || plan?.apresentacao || '',
    via: nextVia,
    escala_unidade: resolvedBolusOption?.scaleUnit || plan?.escala_unidade || 'UI',
    doseStep:
      resolvedBolusOption?.doseStep === null
        ? null
        : resolvedBolusOption?.doseStep || resolveDoseStepForPlan(plan),
    dose_unidade: resolvedBolusOption?.doseUnit || plan?.dose_unidade || 'UI',
    modo_uso: normalizeBolusUsageValue(plan?.modo_uso || resolvedBolusOption?.suggestedUsage || ''),
    inicio_acao: resolvedBolusOption?.onsetLabel || actionProfile.inicio_acao,
    pico: resolvedBolusOption?.peakLabel || actionProfile.pico,
    duracao: resolvedBolusOption?.durationLabel || actionProfile.duracao,
    tempo_aplicacao_sugerido:
      resolvedBolusOption?.administrationTimingLabel || plan?.tempo_aplicacao_sugerido || '',
    status: plan?.status || resolvedBolusOption?.status || 'ativo',
    tabela_horarios: buildBolusScheduleRowsForUsage(plan?.modo_uso, plan?.tabela_horarios),
  };
}

function normalizeTherapyPlan(plan, index = 0) {
  const base = createEmptyTherapyPlan();
  const actionProfile = getActionProfileByClass(plan?.classe_acao);
  const basalOption =
    String(plan?.categoria_funcional || '').trim() === 'basal'
      ? findBasalTherapyOption(plan?.marca, getBasalLookupValue(plan))
      : null;
  const bolusOption =
    String(plan?.categoria_funcional || '').trim() === 'bolus'
      ? findBolusTherapyOption(plan?.marca, getBolusLookupValue(plan))
      : null;

  return {
    ...base,
    ...plan,
    id: plan?.id || `therapy-imported-${index}`,
    categoria_funcional: String(plan?.categoria_funcional || '').trim(),
    frequencia_uso: normalizeBasalFrequencyValue(plan?.frequencia_uso),
    modo_uso: normalizeBolusUsageValue(plan?.modo_uso),
    marca: String(plan?.marca || '').trim(),
    molecula: String(plan?.molecula || '').trim(),
    classe_acao: String(plan?.classe_acao || '').trim(),
    dispositivo: String(plan?.dispositivo || '').trim(),
    concentracao: String(plan?.concentracao || basalOption?.concentration || bolusOption?.concentration || '').trim(),
    apresentacao: String(plan?.apresentacao || '').trim(),
    via: String(plan?.via || inferViaFromDevice(plan?.dispositivo) || '').trim(),
    escala_unidade: String(plan?.escala_unidade || basalOption?.scaleUnit || bolusOption?.scaleUnit || 'UI').trim(),
    doseStep: resolveDoseStepForPlan(plan),
    dose: String(plan?.dose ?? '').trim(),
    dose_unidade: String(plan?.dose_unidade || bolusOption?.doseUnit || plan?.escala_unidade || 'UI').trim(),
    observacoes: String(plan?.observacoes || '').trim(),
    tabela_horarios: Array.isArray(plan?.tabela_horarios) && plan.tabela_horarios.length
      ? plan.tabela_horarios.map((item) => ({
          dia_semana: String(item?.dia_semana || '').trim(),
          refeicao: String(item?.refeicao || '').trim(),
          horario: String(item?.horario || '').trim(),
          dose: String(item?.dose ?? '').trim(),
          dose_unidade: String(item?.dose_unidade || plan?.dose_unidade || plan?.escala_unidade || 'UI').trim(),
          tipo_dose: String(item?.tipo_dose || '').trim(),
          observacao: String(item?.observacao || '').trim(),
        }))
      : [createEmptyTherapyScheduleRow()],
    inicio_acao: String(plan?.inicio_acao || actionProfile.inicio_acao || '').trim(),
    pico: String(plan?.pico || actionProfile.pico || '').trim(),
    duracao: String(plan?.duracao || actionProfile.duracao || '').trim(),
    tempo_aplicacao_sugerido:
      String(plan?.tempo_aplicacao_sugerido || bolusOption?.administrationTimingLabel || '').trim(),
    status: String(plan?.status || 'ativo').trim(),
    criado_em: String(plan?.criado_em || '').trim(),
    atualizado_em: String(plan?.atualizado_em || '').trim(),
  };
}

function buildEditablePharmacologyPlans(patient) {
  const onboarding = getOnboardingAnswers(patient);
  const plans = Array.isArray(onboarding?.terapia_farmacologica_insulinas)
    ? onboarding.terapia_farmacologica_insulinas.map((plan, index) => normalizeTherapyPlan(plan, index))
    : [];

  if (plans.length) return plans;

  const insulinProfiles = onboarding?.insulin_profiles || {};
  const fallbackPlans = [];

  if (insulinProfiles?.basal?.type || insulinProfiles?.basal?.dose) {
    const basalProfileOption = findBasalProfileOption(insulinProfiles?.basal?.type);
    const brandOption = findBasalTherapyOption(
      insulinProfiles?.basal?.type,
      basalProfileOption?.concentration?.replace('-', '')
    );
    const basePlan = normalizeTherapyPlan(
      hydrateTherapyPlanWithBrand(
        {
          categoria_funcional: 'basal',
          frequencia_uso:
            normalizeBasalFrequencyValue(insulinProfiles.basal.frequency) ||
            basalProfileOption?.suggestedFrequency ||
            '',
          dose: insulinProfiles.basal.dose || '',
          dose_unidade: 'UI',
          escala_unidade: 'UI',
          dispositivo: insulinProfiles.basal.device || '',
          concentracao: basalProfileOption?.concentration || '',
          apresentacao: basalProfileOption?.backendPresentation || '',
          via: basalProfileOption?.suggestedRoute ? 'subcutanea' : '',
          tabela_horarios: Array.isArray(insulinProfiles.basal.schedules) && insulinProfiles.basal.schedules.length
            ? insulinProfiles.basal.schedules
            : [createEmptyTherapyScheduleRow()],
        },
        brandOption || {
          label: basalProfileOption?.label || insulinProfiles.basal.type || '',
          marca: basalProfileOption?.brand || insulinProfiles.basal.type || '',
          molecula: basalProfileOption?.molecule || '',
          classe_acao:
            basalProfileOption?.actionClass === 'Intermediária'
              ? 'intermediaria'
              : basalProfileOption?.actionClass?.toLowerCase().includes('ultra')
                ? 'ultralonga'
                : basalProfileOption?.actionClass
                  ? 'longa'
                  : '',
          categoria_funcional: 'basal',
          concentracao: basalProfileOption?.concentration || '',
          apresentacao: basalProfileOption?.backendPresentation || '',
        }
      ),
      0
    );
    basePlan.frequencia_uso =
      String(basePlan.frequencia_uso || basalProfileOption?.suggestedFrequency || '').trim();
    basePlan.tabela_horarios = buildTherapyScheduleRowsForFrequency(
      basePlan.frequencia_uso,
      basePlan.tabela_horarios
    );
    basePlan.tabela_horarios[0].observacao = insulinProfiles.basal.usage || '';
    basePlan.tabela_horarios[0].dose = String(insulinProfiles.basal.dose || '').trim();
    basePlan.tabela_horarios[0].dose_unidade = 'UI';
    basePlan.dose = String(insulinProfiles.basal.dose || '').trim();
    fallbackPlans.push(basePlan);
  }

  if (insulinProfiles?.bolus?.type || insulinProfiles?.bolus?.dose) {
    const brandOption = (PHARMACOLOGY_BRAND_OPTIONS.bolus || []).find(
      (item) => item.marca === insulinProfiles.bolus.type
    );
    const basePlan = normalizeTherapyPlan(
      hydrateTherapyPlanWithBrand(
        {
          categoria_funcional: 'bolus',
          modo_uso: normalizeBolusUsageValue(insulinProfiles.bolus.mode || insulinProfiles.bolus.usage),
          dose: insulinProfiles.bolus.dose || '',
          dose_unidade: 'UI',
          escala_unidade: 'UI',
          tabela_horarios: Array.isArray(insulinProfiles.bolus.schedules) && insulinProfiles.bolus.schedules.length
            ? insulinProfiles.bolus.schedules
            : [createEmptyTherapyScheduleRow()],
        },
        brandOption || {
          marca: insulinProfiles.bolus.type || '',
          molecula: '',
          classe_acao: '',
          categoria_funcional: 'bolus',
        }
      ),
      1
    );
    basePlan.tabela_horarios[0].observacao = insulinProfiles.bolus.usage || '';
    basePlan.tabela_horarios[0].dose = String(insulinProfiles.bolus.dose || '').trim();
    basePlan.tabela_horarios[0].dose_unidade = 'UI';
    basePlan.dose = String(insulinProfiles.bolus.dose || '').trim();
    basePlan.observacoes = String(insulinProfiles.bolus.notes || '').trim();
    fallbackPlans.push(basePlan);
  }

  return fallbackPlans;
}

function buildPharmacologyPatch(plans, patient) {
  const onboarding = {
    ...getOnboardingAnswers(patient),
  };
  const normalizedPlans = (plans || []).map((plan, index) => {
    const normalized = normalizeTherapyPlan(plan, index);
    const timestamp = new Date().toISOString();

    return {
      ...normalized,
      criado_em: normalized.criado_em || timestamp,
      atualizado_em: timestamp,
      doseStep: resolveDoseStepForPlan(normalized),
      dose: normalizeNumber(normalized.dose) ?? 0,
      modo_uso: normalizeBolusUsageValue(normalized.modo_uso),
      tabela_horarios: (normalized.tabela_horarios || []).map((item) => ({
        dia_semana: String(item?.dia_semana || '').trim(),
        refeicao: String(item?.refeicao || '').trim(),
        horario: String(item?.horario || '').trim(),
        dose: normalizeNumber(item?.dose) ?? 0,
        dose_unidade: String(item?.dose_unidade || normalized.dose_unidade || 'UI').trim(),
        tipo_dose: String(item?.tipo_dose || '').trim(),
        observacao: String(item?.observacao || '').trim(),
      })),
    };
  });

  const activeBasalPlan = normalizedPlans.find(
    (item) => item.categoria_funcional === 'basal' && item.status !== 'inativo'
  );
  const activeBolusPlan = normalizedPlans.find(
    (item) => item.categoria_funcional === 'bolus' && item.status !== 'inativo'
  );
  const activeCategories = Array.from(
    new Set(
      normalizedPlans
        .filter((item) => item.status !== 'inativo')
        .map((item) => String(item.categoria_funcional || '').trim())
        .filter(Boolean)
    )
  );

  onboarding.terapia_farmacologica_insulinas = normalizedPlans;
  onboarding.insulinoterapia_atual = activeCategories
    .map((item) => {
      if (item === 'basal') return 'Basal';
      if (item === 'bolus') return 'Bolus';
      if (item === 'mista') return 'Mista';
      return item;
    })
    .join(', ');
  onboarding.insulin_profiles = {
    basal: activeBasalPlan
      ? (() => {
          const basalOption = findBasalTherapyOption(activeBasalPlan.marca, getBasalLookupValue(activeBasalPlan));
          const normalizedSchedules = (activeBasalPlan.tabela_horarios || [])
            .map((item) => ({
              dia_semana: String(item?.dia_semana || '').trim(),
              horario: String(item?.horario || '').trim(),
              dose: normalizeNumber(item?.dose),
            }))
            .filter((item) => item.dia_semana || item.horario || item.dose !== null);
          const usageFallback =
            basalOption?.defaultUsage ||
            (getBasalFrequencyConfig(activeBasalPlan.frequencia_uso)?.scheduleType === 'weekly' ? 'Semanal' : 'Diário');

          return {
            category: 'Basal',
            type: activeBasalPlan.marca || '',
            device: getOptionLabelByValue(PHARMACOLOGY_DEVICE_OPTIONS, activeBasalPlan.dispositivo),
            doseStep: resolveDoseStepForPlan(activeBasalPlan),
            frequency: getOptionLabelByValue(BASAL_FREQUENCY_OPTIONS, activeBasalPlan.frequencia_uso),
            usage:
              activeBasalPlan.tabela_horarios?.[0]?.observacao || usageFallback,
            dose: String(activeBasalPlan.dose || '').trim() || null,
            schedules: normalizedSchedules,
            notes:
              activeBasalPlan.tabela_horarios
                ?.map((item) => String(item?.observacao || '').trim())
                .filter(Boolean)
                .join(' | ') || '',
          };
        })()
      : null,
    bolus: activeBolusPlan
      ? {
          category: 'Bolus',
          type: activeBolusPlan.marca || '',
          device: getOptionLabelByValue(PHARMACOLOGY_DEVICE_OPTIONS, activeBolusPlan.dispositivo),
          doseStep: resolveDoseStepForPlan(activeBolusPlan),
          usage: activeBolusPlan.observacoes || activeBolusPlan.tabela_horarios?.[0]?.observacao || '',
          mode: getOptionLabelByValue(BOLUS_MODE_OPTIONS, activeBolusPlan.modo_uso),
          dose: String(activeBolusPlan.dose || '').trim() || null,
          schedules: (activeBolusPlan.tabela_horarios || [])
            .map((item) => ({
              refeicao: getOptionLabelByValue(BOLUS_MEAL_OPTIONS, item?.refeicao),
              horario: String(item?.horario || '').trim(),
              dose: normalizeNumber(item?.dose),
              tipo_dose: getOptionLabelByValue(BOLUS_DOSE_TYPE_OPTIONS, item?.tipo_dose),
            }))
            .filter((item) => item.refeicao || item.horario || item.dose !== null || item.tipo_dose),
          notes:
            activeBolusPlan.observacoes ||
            activeBolusPlan.tabela_horarios
              ?.map((item) => String(item?.observacao || '').trim())
              .filter(Boolean)
              .join(' | ') || '',
        }
      : null,
  };

  return {
    onboarding_respostas: onboarding,
  };
}

function inferDiabetesStatus(onboarding, patient) {
  if (onboarding?.diabetes_status) return onboarding.diabetes_status;
  if (onboarding?.diabetes === 'NÃ£o' || onboarding?.diabetes === 'Sim') return onboarding.diabetes;
  if (onboarding?.tipo_diabetes || onboarding?.diabetes_tipo) return 'Sim';

  const clinicalText = [
    listToText(onboarding?.condicoes),
    patient?.comorbidades_texto,
    patient?.objetivo_principal_consulta,
  ]
    .join(' ')
    .toLowerCase();

  return clinicalText.includes('diabetes') ? 'Sim' : '';
}

function buildDiabetesDisplay(status, type) {
  if (status === 'NÃ£o') return 'NÃ£o';
  if (status === 'Sim' && type) return `Sim - ${type}`;
  if (status === 'Sim') return 'Sim';
  return '';
}

function buildEditableClinicalForm(patient) {
  const onboarding = getOnboardingAnswers(patient);
  const diabetesStatus = inferDiabetesStatus(onboarding, patient);
  const diabetesType = onboarding?.tipo_diabetes || onboarding?.diabetes_tipo || '';
  const insulinProfiles = onboarding?.insulin_profiles || {};
  const legacyCategory = String(onboarding?.insulin_category_default || '').trim();
  const legacyBaseProfile = {
    type: String(onboarding?.insulin_type_default || '').trim(),
    usage: String(onboarding?.insulin_usage_default || '').trim(),
    dose: String(onboarding?.insulin_dose_default || '').trim(),
    notes: String(onboarding?.insulin_notes_default || '').trim(),
  };
  const basalProfile = insulinProfiles?.basal || {};
  const basalOption = findBasalProfileOption(basalProfile?.type);
  const bolusProfile = insulinProfiles?.bolus || {};
  const altura = formatNumberForInput(patient?.altura_cm);
  const peso = formatNumberForInput(patient?.peso_atual_kg);
  const calculatedImc = calculateImcNumber(altura, peso);
  const storedImc = patient?.imc_calculado;

  return {
    ...EMPTY_CLINICAL_FORM,
    objetivos: listToText(onboarding?.objetivos) || String(patient?.objetivo_principal_consulta || '').trim(),
    condicoes: listToText(onboarding?.condicoes) || String(patient?.comorbidades_texto || '').trim(),
    situacoes: listToText(onboarding?.situacoes),
    procedimentos: listToText(onboarding?.procedimentos),
    procedimento_outros: String(onboarding?.procedimento_outros || '').trim(),
    diabetes: buildDiabetesDisplay(diabetesStatus, diabetesType),
    diabetes_status: diabetesStatus,
    diabetes_tipo: diabetesType,
    insulinoterapia_atual: String(onboarding?.insulinoterapia_atual || '').trim(),
    basal_insulin_type: String(
      basalOption?.label ||
        basalProfile?.type ||
        (legacyCategory === 'basal' ? legacyBaseProfile.type : '')
    ).trim(),
    basal_insulin_device: String(basalProfile?.device || '').trim(),
    basal_insulin_usage: String(
      basalProfile?.usage || (legacyCategory === 'basal' ? legacyBaseProfile.usage : '')
    ).trim(),
    basal_insulin_dose: String(
      basalProfile?.dose || (legacyCategory === 'basal' ? legacyBaseProfile.dose : '')
    ).trim(),
    basal_insulin_notes: String(
      basalProfile?.notes || (legacyCategory === 'basal' ? legacyBaseProfile.notes : '')
    ).trim(),
    bolus_insulin_type: String(
      bolusProfile?.type || (legacyCategory === 'prandial' ? legacyBaseProfile.type : '')
    ).trim(),
    bolus_insulin_usage: String(
      bolusProfile?.usage || (legacyCategory === 'prandial' ? legacyBaseProfile.usage : '')
    ).trim(),
    bolus_insulin_dose: String(
      bolusProfile?.dose || (legacyCategory === 'prandial' ? legacyBaseProfile.dose : '')
    ).trim(),
    bolus_insulin_notes: String(
      bolusProfile?.notes || (legacyCategory === 'prandial' ? legacyBaseProfile.notes : '')
    ).trim(),
    nivel_atividade_fisica_atual: patient?.nivel_atividade_fisica_atual || '',
    qualidade_sono_media: patient?.qualidade_sono_media || '',
    altura_cm: altura,
    peso_atual_kg: peso,
    imc_calculado: formatImcValue(calculatedImc || storedImc),
    alergias_texto: patient?.alergias_texto || '',
    comorbidades_texto: patient?.comorbidades_texto || listToText(onboarding?.condicoes),
    historico_familiar_doencas: patient?.historico_familiar_doencas || '',
  };
}

function createClinicalFieldErrors() {
  return CLINICAL_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: '',
    }),
    {}
  );
}

function validateClinicalField(fieldKey, form) {
  const value = String(form[fieldKey] || '').trim();

  switch (fieldKey) {
    case 'altura_cm': {
      const height = normalizeNumber(value);
      return value && (!height || height < 50 || height > 260)
        ? 'Digite uma altura vÃ¡lida em cm.'
        : '';
    }
    case 'peso_atual_kg': {
      const weight = normalizeNumber(value);
      return value && (!weight || weight < 2 || weight > 500)
        ? 'Digite um peso vÃ¡lido em kg.'
        : '';
    }
    default:
      return '';
  }
}

function getClinicalFieldErrors(form) {
  return CLINICAL_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: validateClinicalField(field.key, form),
    }),
    {}
  );
}

function buildClinicalPatch(form, patient) {
  const imc = calculateImcNumber(form.altura_cm, form.peso_atual_kg);
  const rawConditions = splitListText(form.condicoes);
  const hasDiabetesCondition = rawConditions.some((item) => item.toLowerCase() === 'diabetes');
  const condicoes =
    form.diabetes_status === 'Sim' && !hasDiabetesCondition
      ? [...rawConditions, 'Diabetes']
      : form.diabetes_status === 'NÃ£o'
        ? rawConditions.filter((item) => item.toLowerCase() !== 'diabetes')
        : rawConditions;
  const onboarding = {
    ...getOnboardingAnswers(patient),
    objetivos: splitListText(form.objetivos),
    condicoes,
    situacoes: splitListText(form.situacoes),
    procedimentos: splitListText(form.procedimentos),
    procedimento_outros: form.procedimento_outros.trim(),
    diabetes_status: form.diabetes_status || null,
    tipo_diabetes: form.diabetes_tipo || null,
    insulinoterapia_atual: form.insulinoterapia_atual.trim() || null,
    insulin_profiles: {
      basal: {
        category: 'basal',
        type: form.basal_insulin_type.trim() || null,
        device: form.basal_insulin_device.trim() || null,
        usage: form.basal_insulin_usage.trim() || null,
        dose: form.basal_insulin_dose.trim() || null,
        notes: form.basal_insulin_notes.trim() || null,
      },
      bolus: {
        category: 'prandial',
        type: form.bolus_insulin_type.trim() || null,
        usage: form.bolus_insulin_usage.trim() || null,
        dose: form.bolus_insulin_dose.trim() || null,
        notes: form.bolus_insulin_notes.trim() || null,
      },
    },
    insulin_category_default: null,
    insulin_type_default: null,
    insulin_usage_default: null,
    insulin_dose_default: null,
    insulin_notes_default: null,
  };

  return {
    onboarding_respostas: onboarding,
    objetivo_principal_consulta: form.objetivos.trim() || null,
    comorbidades_texto: form.comorbidades_texto.trim() || listToText(condicoes) || null,
    historico_familiar_doencas: form.historico_familiar_doencas.trim() || null,
    nivel_atividade_fisica_atual: form.nivel_atividade_fisica_atual.trim() || null,
    qualidade_sono_media: form.qualidade_sono_media.trim() || null,
    altura_cm: normalizeNumber(form.altura_cm),
    peso_atual_kg: normalizeNumber(form.peso_atual_kg),
    imc_calculado: imc,
    alergias_texto: form.alergias_texto.trim() || null,
  };
}

function createProfileFieldErrors() {
  return PATIENT_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: '',
    }),
    {}
  );
}

function validateProfileField(fieldKey, form) {
  const value = String(form[fieldKey] || '').trim();

  switch (fieldKey) {
    case 'nome_completo':
      return value && value.split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : '';
    case 'cpf_paciente':
      return value && !isValidCpf(value) ? 'Digite um CPF vÃ¡lido.' : '';
    case 'email_pac':
      return value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase())
        ? 'Digite um e-mail vÃ¡lido.'
        : '';
    case 'telefone': {
      const phoneDigits = onlyDigits(value, 11);
      return phoneDigits && phoneDigits.length < 10
        ? 'Digite um telefone com DDD.'
        : '';
    }
    case 'data_nascimento':
      return value && normalizeDateForSave(value) === undefined
        ? 'Digite uma data vÃ¡lida no formato DD/MM/AAAA.'
        : '';
    case 'cep': {
      const cepDigits = onlyDigits(value, 8);
      return cepDigits && cepDigits.length !== 8 ? 'Digite um CEP com 8 dÃ­gitos.' : '';
    }
    case 'uf':
      return value && value.length !== 2 ? 'Digite a UF com 2 letras.' : '';
    default:
      return '';
  }
}

function getProfileFieldErrors(form) {
  return PATIENT_PROFILE_FIELDS.reduce(
    (errors, field) => ({
      ...errors,
      [field.key]: validateProfileField(field.key, form),
    }),
    {}
  );
}

function hasProfileErrors(errors) {
  return Object.values(errors).some(Boolean);
}

function buildCityStateText(form) {
  const city = form.cidade.trim();
  const uf = form.uf.trim().toUpperCase();

  if (city && uf) return `${city}/${uf}`;
  return city || uf || '';
}

function SectionCard({ children, onLayout, style }) {
  return <View onLayout={onLayout} style={[styles.sectionCard, style]}>{children}</View>;
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DrilldownHeader({ title, helper, open, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.drilldownHeader}>
      <View style={styles.drilldownHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHelper}>{helper}</Text>
      </View>

      <Ionicons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={patientTheme.colors.primaryDark}
      />
    </TouchableOpacity>
  );
}

export default function PacientePerfilScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const fallbackName = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);

  const [paciente, setPaciente] = useState(usuarioLogado || null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({
    patient: false,
    clinical: false,
    pharmacology: false,
  });
  const [profileForm, setProfileForm] = useState(() => buildEditableProfileForm(usuarioLogado || {}));
  const [savedProfileForm, setSavedProfileForm] = useState(() =>
    buildEditableProfileForm(usuarioLogado || {})
  );
  const [profileFieldErrors, setProfileFieldErrors] = useState(createProfileFieldErrors);
  const [focusedProfileField, setFocusedProfileField] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [clinicalForm, setClinicalForm] = useState(() => buildEditableClinicalForm(usuarioLogado || {}));
  const [savedClinicalForm, setSavedClinicalForm] = useState(() =>
    buildEditableClinicalForm(usuarioLogado || {})
  );
  const [clinicalFieldErrors, setClinicalFieldErrors] = useState(createClinicalFieldErrors);
  const [focusedClinicalField, setFocusedClinicalField] = useState('');
  const [savingClinical, setSavingClinical] = useState(false);
  const [clinicalFeedback, setClinicalFeedback] = useState(null);
  const [therapyPlans, setTherapyPlans] = useState(() => buildEditablePharmacologyPlans(usuarioLogado || {}));
  const [savedTherapyPlans, setSavedTherapyPlans] = useState(() =>
    buildEditablePharmacologyPlans(usuarioLogado || {})
  );
  const [therapyEditorVisible, setTherapyEditorVisible] = useState(false);
  const [therapyDraft, setTherapyDraft] = useState(createEmptyTherapyPlan());
  const [editingTherapyId, setEditingTherapyId] = useState(null);
  const [therapyOptionModalVisible, setTherapyOptionModalVisible] = useState(false);
  const [therapyOptionField, setTherapyOptionField] = useState('');
  const [therapyOptionScheduleIndex, setTherapyOptionScheduleIndex] = useState(null);
  const [focusedTherapyField, setFocusedTherapyField] = useState('');
  const [savingTherapy, setSavingTherapy] = useState(false);
  const [therapyFeedback, setTherapyFeedback] = useState(null);
  const [bolusTechnicalExpanded, setBolusTechnicalExpanded] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFeedback, setCepFeedback] = useState(null);
  const [emailVerificationVisible, setEmailVerificationVisible] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailVerificationError, setEmailVerificationError] = useState('');
  const [emailVerificationLoading, setEmailVerificationLoading] = useState(false);
  const [emailPendingVerification, setEmailPendingVerification] = useState('');
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [diabetesModalVisible, setDiabetesModalVisible] = useState(false);
  const [diabetesTypeModalVisible, setDiabetesTypeModalVisible] = useState(false);
  const [insulinConfigModalVisible, setInsulinConfigModalVisible] = useState(false);
  const [activeInsulinProfileKey, setActiveInsulinProfileKey] = useState('basal');
  const [insulinCategoryModalVisible, setInsulinCategoryModalVisible] = useState(false);
  const [insulinTypeModalVisible, setInsulinTypeModalVisible] = useState(false);
  const [insulinDeviceModalVisible, setInsulinDeviceModalVisible] = useState(false);
  const [insulinUsageModalVisible, setInsulinUsageModalVisible] = useState(false);
  const [objectiveModalVisible, setObjectiveModalVisible] = useState(false);
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [situationModalVisible, setSituationModalVisible] = useState(false);
  const [procedureModalVisible, setProcedureModalVisible] = useState(false);
  const lastFetchedCepRef = useRef(onlyDigits(usuarioLogado?.cep || '', 8));
  const {
    scrollViewRef,
    registerScrollContainer,
    registerFieldLayout,
    scrollToField,
  } = useKeyboardAwareScroll({ topOffset: 95 });

  useEffect(() => {
    let active = true;

    async function carregarPerfil() {
      try {
        setLoading(true);

        const registro = await fetchPatientById(patientId, {
          patientContext: usuarioLogado,
          currentPatient: paciente,
        });
        const onboardingLocal = await getPatientLocalOnboardingData(registro || usuarioLogado);
        const registroComOnboarding = mergePatientOnboardingData(
          registro || usuarioLogado || null,
          onboardingLocal
        );

        if (active) {
          setPaciente(registroComOnboarding || usuarioLogado || null);
        }
      } catch (error) {
        console.log('Erro ao carregar perfil do paciente:', error);

        if (active) {
          const onboardingLocal = await getPatientLocalOnboardingData(usuarioLogado);
          setPaciente(mergePatientOnboardingData(usuarioLogado, onboardingLocal) || usuarioLogado || null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    carregarPerfil();

    return () => {
      active = false;
    };
  }, [patientId, usuarioLogado]);

  useEffect(() => {
    const basalOption = findBasalProfileOption(clinicalForm.basal_insulin_type);
    const allowedDevices = basalOption?.allowedDevices || [];

    if (
      clinicalForm.basal_insulin_device &&
      allowedDevices.length &&
      !allowedDevices.includes(clinicalForm.basal_insulin_device)
    ) {
      setClinicalForm((current) => ({
        ...current,
        basal_insulin_device: '',
      }));
    }
  }, [clinicalForm.basal_insulin_device, clinicalForm.basal_insulin_type]);

  useEffect(() => {
    const nextForm = buildEditableProfileForm(paciente || {});
    const nextClinicalForm = buildEditableClinicalForm(paciente || {});
    const nextTherapyPlans = buildEditablePharmacologyPlans(paciente || {});

    setProfileForm(nextForm);
    setSavedProfileForm(nextForm);
    setProfileFieldErrors(createProfileFieldErrors());
    setClinicalForm(nextClinicalForm);
    setSavedClinicalForm(nextClinicalForm);
    setClinicalFieldErrors(createClinicalFieldErrors());
    setTherapyPlans(nextTherapyPlans);
    setSavedTherapyPlans(nextTherapyPlans);
    setCepFeedback(null);
    lastFetchedCepRef.current = onlyDigits(nextForm.cep, 8);
  }, [paciente]);

  useEffect(() => {
    let active = true;
    const cepDigits = onlyDigits(profileForm.cep, 8);

    if (cepDigits.length < 8) {
      setCepFeedback(null);
      setCepLoading(false);
      return undefined;
    }

    if (cepDigits.length !== 8 || cepDigits === lastFetchedCepRef.current) {
      return undefined;
    }

    const timeout = setTimeout(async () => {
      lastFetchedCepRef.current = cepDigits;
      setCepLoading(true);
      setCepFeedback(null);

      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await response.json();

        if (!active) return;

        if (data.erro) {
          setCepFeedback({ type: 'error', message: 'CEP nÃ£o encontrado.' });
          return;
        }

        setProfileForm((current) => {
          if (onlyDigits(current.cep, 8) !== cepDigits) return current;

          return {
            ...current,
            logradouro: data.logradouro || current.logradouro,
            bairro: data.bairro || current.bairro,
            cidade: data.localidade || current.cidade,
            uf: (data.uf || current.uf).toUpperCase(),
          };
        });
        setCepFeedback({ type: 'success', message: 'EndereÃ§o preenchido pelo CEP.' });
      } catch (error) {
        console.log('Erro ao buscar CEP:', error);

        if (active) {
          setCepFeedback({ type: 'error', message: 'NÃ£o foi possÃ­vel buscar esse CEP agora.' });
        }
      } finally {
        if (active) {
          setCepLoading(false);
        }
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [profileForm.cep]);

  function handleProfileFieldChange(fieldKey, value) {
    const field = PATIENT_PROFILE_FIELDS.find((item) => item.key === fieldKey);
    const nextValue = field?.formatter ? field.formatter(value) : value;
    const nextForm = {
      ...profileForm,
      [fieldKey]: nextValue,
    };

    setProfileForm(nextForm);
    setProfileFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateProfileField(fieldKey, nextForm),
    }));
    setProfileFeedback(null);

    if (fieldKey !== 'cep') {
      return;
    }

    setCepFeedback(null);
  }

  function focusProfileField(fieldKey) {
    setFocusedProfileField(fieldKey);
    scrollToField(`profile-${fieldKey}`);
  }

  function blurProfileField(fieldKey) {
    setFocusedProfileField((current) => (current === fieldKey ? '' : current));
    setProfileFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateProfileField(fieldKey, profileForm),
    }));
  }

  function selectGenderOption(option) {
    handleProfileFieldChange('sexo_biologico', option);
    setGenderModalVisible(false);
  }

  function getNormalizedProfileEmail(form = profileForm) {
    return form.email_pac.trim().toLowerCase();
  }

  function hasEmailChanged() {
    return getNormalizedProfileEmail(profileForm) !== getNormalizedProfileEmail(savedProfileForm);
  }

  function validateProfileFormBeforeSave() {
    const errors = getProfileFieldErrors(profileForm);
    const emailChanged = hasEmailChanged();

    if (emailChanged && !getNormalizedProfileEmail()) {
      errors.email_pac = 'Informe o e-mail.';
    }

    setProfileFieldErrors(errors);

    if (hasProfileErrors(errors)) {
      setProfileFeedback({
        type: 'error',
        message: 'Revise os campos destacados antes de salvar.',
      });
      return false;
    }

    return true;
  }

  async function persistProfileData() {
    try {
      setSavingProfile(true);
      setProfileFeedback(null);

      const updatedPatient = await updatePatientProfile({
        patientId,
        currentPatient: paciente,
        patientContext: usuarioLogado,
        patch: buildProfilePatch(profileForm),
      });

      setPaciente(updatedPatient);
      setProfileFeedback({ type: 'success', message: 'Dados atualizados com sucesso.' });
    } catch (error) {
      console.log('Erro ao salvar dados do paciente:', error);
      setProfileFeedback({
        type: 'error',
        message: 'NÃ£o foi possÃ­vel salvar os dados agora. Tente novamente.',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function requestEmailVerification({ resend = false } = {}) {
    const emailToVerify = getNormalizedProfileEmail();

    try {
      setEmailVerificationLoading(true);
      setEmailVerificationError('');
      setProfileFeedback(null);
      setEmailPendingVerification(emailToVerify);
      setEmailVerificationCode('');
      setEmailVerificationVisible(true);

      await solicitarCodigoValidacaoEmailCadastro({
        role: 'Paciente',
        email: emailToVerify,
      });

      if (resend) {
        setEmailVerificationError('');
      }
    } catch (error) {
      const message = error?.message || 'NÃ£o foi possÃ­vel enviar o cÃ³digo de validaÃ§Ã£o.';
      setEmailVerificationError(message);
      setProfileFeedback({ type: 'error', message });
    } finally {
      setEmailVerificationLoading(false);
    }
  }

  async function saveProfileData() {
    if (!validateProfileFormBeforeSave()) return;

    if (hasEmailChanged()) {
      await requestEmailVerification();
      return;
    }

    await persistProfileData();
  }

  function cancelEmailVerification() {
    setEmailVerificationVisible(false);
    setEmailVerificationCode('');
    setEmailVerificationError('');
    setEmailPendingVerification('');
    setEmailVerificationLoading(false);
  }

  async function resendEmailVerificationCode() {
    await requestEmailVerification({ resend: true });
  }

  async function confirmEmailVerificationCode() {
    const code = emailVerificationCode.replace(/\D/g, '');
    const currentEmail = getNormalizedProfileEmail();
    const emailToVerify = emailPendingVerification || currentEmail;

    if (code.length !== 6) {
      setEmailVerificationError('Digite o cÃ³digo de 6 dÃ­gitos enviado por e-mail.');
      return;
    }

    if (currentEmail !== emailToVerify) {
      setEmailVerificationError(
        'O e-mail do formulÃ¡rio mudou. Solicite um novo cÃ³digo para validar o e-mail atual.'
      );
      return;
    }

    try {
      setEmailVerificationLoading(true);
      setEmailVerificationError('');

      await confirmarCodigoValidacaoEmailCadastro({
        role: 'Paciente',
        email: emailToVerify,
        code,
      });

      setEmailVerificationVisible(false);
      setEmailVerificationCode('');
      setEmailVerificationError('');
      setEmailPendingVerification('');

      await persistProfileData();
    } catch (error) {
      setEmailVerificationError(
        error?.message || 'CÃ³digo invÃ¡lido. Confira o cÃ³digo enviado por e-mail.'
      );
    } finally {
      setEmailVerificationLoading(false);
    }
  }

  function handleClinicalFieldChange(fieldKey, value) {
    const field = CLINICAL_PROFILE_FIELDS.find((item) => item.key === fieldKey);
    const nextValue = field?.formatter ? field.formatter(value) : value;
    const nextForm = {
      ...clinicalForm,
      [fieldKey]: nextValue,
    };
    const imc = calculateImcNumber(
      fieldKey === 'altura_cm' ? nextValue : nextForm.altura_cm,
      fieldKey === 'peso_atual_kg' ? nextValue : nextForm.peso_atual_kg
    );
    nextForm.imc_calculado = formatImcValue(imc);

    setClinicalForm(nextForm);
    setClinicalFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateClinicalField(fieldKey, nextForm),
    }));
    setClinicalFeedback(null);
  }

  function focusClinicalField(fieldKey) {
    setFocusedClinicalField(fieldKey);
    scrollToField(`clinical-${fieldKey}`);
  }

  function blurClinicalField(fieldKey) {
    setFocusedClinicalField((current) => (current === fieldKey ? '' : current));
    setClinicalFieldErrors((current) => ({
      ...current,
      [fieldKey]: validateClinicalField(fieldKey, clinicalForm),
    }));
  }

  function validateClinicalFormBeforeSave() {
    const errors = getClinicalFieldErrors(clinicalForm);
    setClinicalFieldErrors(errors);

    if (hasProfileErrors(errors)) {
      setClinicalFeedback({
        type: 'error',
        message: 'Revise os campos clÃ­nicos destacados antes de salvar.',
      });
      return false;
    }

    return true;
  }

  async function saveClinicalData() {
    if (!validateClinicalFormBeforeSave()) return;

    try {
      setSavingClinical(true);
      setClinicalFeedback(null);

      const updatedPatient = await updatePatientProfile({
        patientId,
        currentPatient: paciente,
        patientContext: usuarioLogado,
        patch: buildClinicalPatch(clinicalForm, paciente || {}),
      });

      setPaciente(updatedPatient);
      setClinicalFeedback({ type: 'success', message: 'Dados clÃ­nicos atualizados com sucesso.' });
    } catch (error) {
      console.log('Erro ao salvar dados clÃ­nicos do paciente:', error);
      setClinicalFeedback({
        type: 'error',
        message: 'NÃ£o foi possÃ­vel salvar os dados clÃ­nicos agora. Tente novamente.',
      });
    } finally {
      setSavingClinical(false);
    }
  }

  function openTherapyEditor(plan = null) {
    const normalizedPlan = plan ? normalizeTherapyPlan(plan) : createEmptyTherapyPlan();
    const nextDraft =
      normalizedPlan.categoria_funcional === 'basal'
        ? {
            ...normalizedPlan,
            frequencia_uso:
              normalizedPlan.frequencia_uso ||
              findBasalTherapyOption(normalizedPlan.marca, getBasalLookupValue(normalizedPlan))
                ?.suggestedFrequency ||
              '',
          }
        : normalizedPlan.categoria_funcional === 'bolus'
          ? {
              ...normalizedPlan,
              modo_uso:
                normalizedPlan.modo_uso ||
                findBolusTherapyOption(normalizedPlan.marca, getBolusLookupValue(normalizedPlan))
                  ?.suggestedUsage ||
                '',
            }
        : normalizedPlan;

    setEditingTherapyId(plan?.id || null);
    setTherapyDraft(
      nextDraft.categoria_funcional === 'basal'
        ? {
            ...nextDraft,
            tabela_horarios: buildTherapyScheduleRowsForFrequency(
              nextDraft.frequencia_uso,
              nextDraft.tabela_horarios
            ),
          }
        : nextDraft.categoria_funcional === 'bolus'
          ? {
              ...nextDraft,
              tabela_horarios: buildBolusScheduleRowsForUsage(nextDraft.modo_uso, nextDraft.tabela_horarios),
            }
        : nextDraft
    );
    setFocusedTherapyField('');
    setBolusTechnicalExpanded(false);
    setTherapyEditorVisible(true);
  }

  function closeTherapyEditor() {
    setTherapyEditorVisible(false);
    setEditingTherapyId(null);
    setTherapyDraft(createEmptyTherapyPlan());
    setFocusedTherapyField('');
    setBolusTechnicalExpanded(false);
    setTherapyOptionField('');
    setTherapyOptionScheduleIndex(null);
    setTherapyOptionModalVisible(false);
  }

  function openTherapyOptionModal(field, scheduleIndex = null) {
    setFocusedTherapyField(field);
    setTherapyOptionField(field);
    setTherapyOptionScheduleIndex(scheduleIndex);
    setTherapyOptionModalVisible(true);
  }

  function handleTherapyDraftChange(fieldKey, value) {
    setTherapyDraft((current) => ({
      ...current,
      [fieldKey]: value,
    }));
    setTherapyFeedback(null);
  }

  function handleTherapyScheduleChange(index, fieldKey, value) {
    setTherapyDraft((current) => ({
      ...current,
      tabela_horarios: (current.tabela_horarios || []).map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [fieldKey]: value,
            }
          : item
      ),
    }));
    setTherapyFeedback(null);
  }

  function validateBasalTherapyDraft(plan) {
    const basalOption = findBasalTherapyOption(plan.marca, getBasalLookupValue(plan));
    const allowedFrequencies = basalOption?.allowedFrequencies || [];
    const frequencyConfig = getBasalFrequencyConfig(plan.frequencia_uso);
    const rows = Array.isArray(plan.tabela_horarios) ? plan.tabela_horarios : [];
    const doseStep = resolveDoseStepForPlan(plan);

    if (!plan.frequencia_uso) {
      return { type: 'error', message: 'Selecione a frequência de uso da insulina basal.' };
    }

    if (!allowedFrequencies.includes(plan.frequencia_uso)) {
      return { type: 'error', message: BASAL_INCOMPATIBLE_FREQUENCY_ERROR_MESSAGE };
    }

    if (!frequencyConfig) {
      return { type: 'error', message: 'Selecione uma frequência de uso válida.' };
    }

    if (rows.length !== frequencyConfig.rows) {
      return {
        type: 'error',
        message: `A frequência selecionada exige exatamente ${frequencyConfig.rows} horário(s) de uso.`,
      };
    }

    const normalizedTimes = [];

    for (const item of rows) {
      const dayOfWeek = String(item?.dia_semana || '').trim();
      const time = String(item?.horario || '').trim();
      const dose = String(item?.dose || '').trim();

      if (frequencyConfig.scheduleType === 'weekly' && !dayOfWeek) {
        return { type: 'error', message: 'Selecione o dia da semana da aplicação.' };
      }

      if (!time) {
        return { type: 'error', message: 'Informe o horário de uso.' };
      }

      if (!isValidTime24h(time)) {
        return { type: 'error', message: 'Informe o horário no formato 24h (HH:mm).' };
      }

      if (!dose) {
        return { type: 'error', message: 'Informe a dose de uso.' };
      }

      if (!isPositiveDoseString(dose)) {
        return { type: 'error', message: getDoseStepValidationMessage(doseStep) };
      }

      if (!isDoseCompatibleWithStep(dose, doseStep)) {
        return { type: 'error', message: getDoseStepValidationMessage(doseStep) };
      }

      normalizedTimes.push(time);
    }

    if (new Set(normalizedTimes).size !== normalizedTimes.length) {
      return { type: 'error', message: BASAL_DUPLICATE_TIME_ERROR_MESSAGE };
    }

    return null;
  }

  function validateBolusTherapyDraft(plan) {
    const bolusOption = findBolusTherapyOption(plan.marca, getBolusLookupValue(plan));
    const rows = Array.isArray(plan.tabela_horarios) ? plan.tabela_horarios : [];

    if (!plan.modo_uso) {
      return { type: 'error', message: 'Selecione o modo de uso do bolus.' };
    }

    if (!getBolusUsageConfig(plan.modo_uso)) {
      return { type: 'error', message: 'Selecione um modo de uso válido.' };
    }

    if (!plan.dispositivo) {
      return { type: 'error', message: 'Selecione o dispositivo da insulina bolus.' };
    }

    const allowedDevices = bolusOption?.allowedDevices || [];
    const selectedDeviceLabel = getOptionLabelByValue(PHARMACOLOGY_DEVICE_OPTIONS, plan.dispositivo);

    if (selectedDeviceLabel && allowedDevices.length && !allowedDevices.includes(selectedDeviceLabel)) {
      return { type: 'error', message: 'O dispositivo selecionado não é compatível com esta insulina.' };
    }

    if (plan.dispositivo === 'inalador' && bolusOption?.brand !== 'Afrezza') {
      return { type: 'error', message: 'O dispositivo selecionado não é compatível com esta insulina.' };
    }

    if (bolusOption?.brand === 'Afrezza' && plan.dispositivo && plan.dispositivo !== 'inalador') {
      return { type: 'error', message: 'O dispositivo selecionado não é compatível com esta insulina.' };
    }

    for (const item of rows) {
      const meal = String(item?.refeicao || '').trim();
      const dayOfWeek = String(item?.dia_semana || '').trim();
      const time = String(item?.horario || '').trim();
      const dose = String(item?.dose || '').trim();
      const doseType = String(item?.tipo_dose || '').trim();

      if (!meal && !time && !dose && !doseType && !String(item?.observacao || '').trim()) {
        continue;
      }

      if (dayOfWeek) {
        return { type: 'error', message: 'Bolus não deve ser configurado como uso semanal.' };
      }

      if (!meal) {
        return { type: 'error', message: 'Selecione a refeição ou correção do bolus.' };
      }

      if (!doseType) {
        return { type: 'error', message: 'Selecione o tipo de dose do bolus.' };
      }

      if (time && !isValidTime24h(time)) {
        return { type: 'error', message: 'Informe o horário no formato 24h.' };
      }

      if (!dose) {
        return { type: 'error', message: 'A dose deve ser um número válido em UI.' };
      }

      if (!isPositiveDoseString(dose)) {
        return { type: 'error', message: 'A dose deve ser um número válido em UI.' };
      }
    }

    return null;
  }

  function validateTherapyDoseStep(plan) {
    const doseStep = resolveDoseStepForPlan(plan);

    if (!doseStep) return null;

    const dosesToValidate = [
      String(plan?.dose || '').trim(),
      ...(Array.isArray(plan?.tabela_horarios)
        ? plan.tabela_horarios.map((item) => String(item?.dose || '').trim())
        : []),
    ].filter(Boolean);

    const invalidDose = dosesToValidate.find((item) => !isDoseCompatibleWithStep(item, doseStep));

    if (!invalidDose) return null;

    return { type: 'error', message: getDoseStepValidationMessage(doseStep) };
  }

  function addTherapyScheduleRow() {
    setTherapyDraft((current) => ({
      ...current,
      tabela_horarios: [...(current.tabela_horarios || []), createEmptyTherapyScheduleRow()],
    }));
  }

  function removeTherapyScheduleRow(index) {
    setTherapyDraft((current) => {
      const nextRows = (current.tabela_horarios || []).filter((_, itemIndex) => itemIndex !== index);

      return {
        ...current,
        tabela_horarios: nextRows.length ? nextRows : [createEmptyTherapyScheduleRow()],
      };
    });
  }

  function getTherapyOptionsForField(field) {
    switch (field) {
      case 'categoria_funcional':
        return PHARMACOLOGY_CATEGORY_OPTIONS;
      case 'marca':
        if (therapyDraft.categoria_funcional === 'basal') {
          return BASAL_INSULIN_PROFILE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.label,
            marca: option.label,
            descricao: `${option.molecule} • ${option.actionClass}`,
            categoria_funcional: 'basal',
            brand: option.brand,
            molecula: option.molecule,
            classe_acao: option.actionProfileKey,
            concentracao: option.concentration,
            apresentacao: option.backendPresentation || '',
          }));
        }
        if (therapyDraft.categoria_funcional === 'bolus') {
          return BOLUS_INSULIN_OPTIONS.filter((option) => option.enabledByDefault !== false).map((option) => ({
            label: option.label,
            value: option.label,
            marca: option.label,
            descricao: `${option.molecule} • ${option.actionClass}`,
            categoria_funcional: 'bolus',
            brand: option.brand,
            molecula: option.molecule,
            classe_acao: option.actionProfileKey,
            concentracao: option.concentration,
            apresentacao: option.backendPresentation || '',
          }));
        }
        return PHARMACOLOGY_BRAND_OPTIONS[therapyDraft.categoria_funcional] || [];
      case 'dispositivo':
        if (therapyDraft.categoria_funcional === 'basal') {
          const basalOption = findBasalTherapyOption(therapyDraft.marca, getBasalLookupValue(therapyDraft));
          return PHARMACOLOGY_DEVICE_OPTIONS.filter((option) =>
            (basalOption?.allowedDevices || []).includes(option.label)
          );
        }
        if (therapyDraft.categoria_funcional === 'bolus') {
          const bolusOption = findBolusTherapyOption(therapyDraft.marca, getBolusLookupValue(therapyDraft));
          return PHARMACOLOGY_DEVICE_OPTIONS.filter((option) =>
            (bolusOption?.allowedDevices || []).includes(option.label)
          );
        }
        return PHARMACOLOGY_DEVICE_OPTIONS;
      case 'frequencia_uso':
        return getBasalFrequencyOptions(therapyDraft.marca, getBasalLookupValue(therapyDraft));
      case 'modo_uso':
        return getBolusUsageOptions();
      case 'schedule_dia_semana':
        return THERAPY_WEEKDAY_OPTIONS;
      case 'schedule_refeicao':
        return BOLUS_MEAL_OPTIONS;
      case 'schedule_tipo_dose':
        return BOLUS_DOSE_TYPE_OPTIONS;
      case 'apresentacao':
        return PHARMACOLOGY_PRESENTATION_OPTIONS;
      case 'via':
        return PHARMACOLOGY_VIA_OPTIONS;
      case 'escala_unidade':
      case 'dose_unidade':
        return PHARMACOLOGY_SCALE_OPTIONS;
      case 'status':
        return PHARMACOLOGY_STATUS_OPTIONS;
      default:
        return [];
    }
  }

  function getTherapyOptionLabel(option) {
    return option.label || option.marca || option.value || '';
  }

  function getTherapyOptionDescription(option) {
    return option.descricao || option.molecula || option.classe_acao || '';
  }

  function selectTherapyOption(option) {
    const field = therapyOptionField;

    setTherapyDraft((current) => {
      if (field === 'categoria_funcional') {
        return {
          ...createEmptyTherapyPlan(),
          id: current.id,
          criado_em: current.criado_em,
          atualizado_em: current.atualizado_em,
          categoria_funcional: option.value,
          status: current.status || 'ativo',
        };
      }

      if (field === 'marca') {
        const hydratedPlan = hydrateTherapyPlanWithBrand(current, option);
        if (option?.marca === 'Afrezza') {
          return {
            ...hydratedPlan,
            dispositivo: current.dispositivo || 'inalador',
            via: 'inalatoria',
          };
        }
        if (hydratedPlan.categoria_funcional === 'basal') {
          const basalOption = findBasalTherapyOption(hydratedPlan.marca, getBasalLookupValue(hydratedPlan));
          const nextFrequency =
            current.frequencia_uso &&
            (basalOption?.allowedFrequencies || []).includes(current.frequencia_uso)
              ? current.frequencia_uso
              : basalOption?.suggestedFrequency || '';

          return {
            ...hydratedPlan,
            frequencia_uso: nextFrequency,
            tabela_horarios: buildTherapyScheduleRowsForFrequency(nextFrequency, current.tabela_horarios),
          };
        }
        if (hydratedPlan.categoria_funcional === 'bolus') {
          const bolusOption = findBolusTherapyOption(hydratedPlan.marca, getBolusLookupValue(hydratedPlan));
          const nextMode = normalizeBolusUsageValue(
            current.modo_uso || bolusOption?.suggestedUsage || ''
          );

          return {
            ...hydratedPlan,
            modo_uso: nextMode,
            tabela_horarios: buildBolusScheduleRowsForUsage(nextMode, current.tabela_horarios),
          };
        }
        return hydratedPlan;
      }

      if (field === 'dispositivo') {
        return {
          ...current,
          dispositivo: option.value,
          via: current.categoria_funcional === 'basal' ? 'subcutanea' : inferViaFromDevice(option.value),
        };
      }

      if (field === 'frequencia_uso') {
        return {
          ...current,
          frequencia_uso: option.value,
          tabela_horarios: buildTherapyScheduleRowsForFrequency(option.value, current.tabela_horarios),
        };
      }

      if (field === 'modo_uso') {
        return {
          ...current,
          modo_uso: option.value,
          tabela_horarios: buildBolusScheduleRowsForUsage(option.value, current.tabela_horarios),
        };
      }

      if (field === 'schedule_dia_semana') {
        return {
          ...current,
          tabela_horarios: (current.tabela_horarios || []).map((item, itemIndex) =>
            itemIndex === therapyOptionScheduleIndex
              ? {
                  ...item,
                  dia_semana: option.value,
                }
              : item
          ),
        };
      }

      if (field === 'schedule_refeicao') {
        return {
          ...current,
          tabela_horarios: (current.tabela_horarios || []).map((item, itemIndex) =>
            itemIndex === therapyOptionScheduleIndex
              ? {
                  ...item,
                  refeicao: option.value,
                }
              : item
          ),
        };
      }

      if (field === 'schedule_tipo_dose') {
        return {
          ...current,
          tabela_horarios: (current.tabela_horarios || []).map((item, itemIndex) =>
            itemIndex === therapyOptionScheduleIndex
              ? {
                  ...item,
                  tipo_dose: option.value,
                }
              : item
          ),
        };
      }

      if (field === 'apresentacao') {
        return {
          ...current,
          apresentacao: option.value,
        };
      }

      if (field === 'escala_unidade') {
        return {
          ...current,
          escala_unidade: option.value,
          dose_unidade: current.dose_unidade || option.value,
          tabela_horarios: (current.tabela_horarios || []).map((item) => ({
            ...item,
            dose_unidade: item.dose_unidade || option.value,
          })),
        };
      }

      if (field === 'dose_unidade') {
        return {
          ...current,
          dose_unidade: option.value,
          tabela_horarios: (current.tabela_horarios || []).map((item) => ({
            ...item,
            dose_unidade: option.value,
          })),
        };
      }

      if (field === 'status') {
        return {
          ...current,
          status: option.value,
        };
      }

      return current;
    });

    setTherapyOptionModalVisible(false);
    setTherapyOptionField('');
    setTherapyOptionScheduleIndex(null);
    setFocusedTherapyField('');
  }

  function saveTherapyDraftLocally() {
    if (!therapyDraft.categoria_funcional) {
      setTherapyFeedback({ type: 'error', message: 'Selecione a categoria funcional.' });
      return;
    }

    if (!therapyDraft.marca) {
      setTherapyFeedback({
        type: 'error',
        message:
          therapyDraft.categoria_funcional === 'basal'
            ? 'Selecione a marca/tipo da insulina basal.'
            : 'Selecione a marca da insulina.',
      });
      return;
    }

    if (therapyDraft.categoria_funcional === 'basal' && !therapyDraft.dispositivo) {
      setTherapyFeedback({ type: 'error', message: 'Selecione o dispositivo da insulina basal.' });
      return;
    }

    if (therapyDraft.categoria_funcional === 'bolus' && !therapyDraft.dispositivo) {
      setTherapyFeedback({ type: 'error', message: 'Selecione o dispositivo da insulina bolus.' });
      return;
    }

    if (therapyDraft.categoria_funcional === 'basal') {
      const basalValidationError = validateBasalTherapyDraft(therapyDraft);
      if (basalValidationError) {
        setTherapyFeedback(basalValidationError);
        return;
      }
    }

    if (therapyDraft.categoria_funcional === 'bolus') {
      const bolusValidationError = validateBolusTherapyDraft(therapyDraft);
      if (bolusValidationError) {
        setTherapyFeedback(bolusValidationError);
        return;
      }
    }

    const doseStepValidationError = validateTherapyDoseStep(therapyDraft);
    if (doseStepValidationError) {
      setTherapyFeedback(doseStepValidationError);
      return;
    }

    const nextPlan = normalizeTherapyPlan({
      ...therapyDraft,
      doseStep: resolveDoseStepForPlan(therapyDraft),
      dose:
        therapyDraft.categoria_funcional === 'basal' || therapyDraft.categoria_funcional === 'bolus'
          ? String(therapyDraft.tabela_horarios?.[0]?.dose || '').trim()
          : therapyDraft.dose,
      dose_unidade:
        therapyDraft.categoria_funcional === 'basal'
          ? 'UI'
          : therapyDraft.categoria_funcional === 'bolus'
            ? therapyDraft.dose_unidade || 'UI'
            : therapyDraft.dose_unidade || therapyDraft.escala_unidade || 'UI',
      tabela_horarios: (therapyDraft.tabela_horarios || []).map((item) => ({
        ...item,
        dose_unidade:
          therapyDraft.categoria_funcional === 'basal'
            ? 'UI'
            : therapyDraft.categoria_funcional === 'bolus'
              ? item.dose_unidade || therapyDraft.dose_unidade || 'UI'
              : item.dose_unidade || therapyDraft.dose_unidade || therapyDraft.escala_unidade || 'UI',
      })),
    });

    setTherapyPlans((current) => {
      const withoutCategory = current.filter(
        (item) =>
          item.id !== nextPlan.id && item.categoria_funcional !== nextPlan.categoria_funcional
      );
      return [...withoutCategory, nextPlan];
    });
    setTherapyFeedback(null);
    closeTherapyEditor();
  }

  function removeTherapyPlan(planId) {
    setTherapyPlans((current) =>
      current.map((item) =>
        item.id === planId
          ? {
              ...item,
              status: 'inativo',
              atualizado_em: new Date().toISOString(),
            }
          : item
      )
    );
    if (editingTherapyId === planId) {
      closeTherapyEditor();
    }
  }

  async function savePharmacologyData() {
    try {
      setSavingTherapy(true);
      setTherapyFeedback(null);

      const updatedPatient = await updatePatientProfile({
        patientId,
        currentPatient: paciente,
        patientContext: usuarioLogado,
        patch: buildPharmacologyPatch(therapyPlans, paciente || {}),
      });

      const nextSavedPlans = buildEditablePharmacologyPlans(updatedPatient || {});
      setPaciente(updatedPatient);
      setTherapyPlans(nextSavedPlans);
      setSavedTherapyPlans(nextSavedPlans);
      setTherapyFeedback({ type: 'success', message: 'Terapia farmacolÃ³gica atualizada com sucesso.' });
    } catch (error) {
      console.log('Erro ao salvar terapia farmacolÃ³gica:', error);
      setTherapyFeedback({
        type: 'error',
        message: 'NÃ£o foi possÃ­vel salvar a terapia farmacolÃ³gica agora. Tente novamente.',
      });
    } finally {
      setSavingTherapy(false);
    }
  }

  function selectDiabetesStatus(status) {
    if (status === 'NÃ£o') {
      const condicoes = splitListText(clinicalForm.condicoes)
        .filter((item) => item.toLowerCase() !== 'diabetes')
        .join(', ');
      const nextForm = {
        ...clinicalForm,
        condicoes,
        diabetes: 'NÃ£o',
        diabetes_status: 'NÃ£o',
        diabetes_tipo: '',
      };

      setClinicalForm(nextForm);
      setClinicalFeedback(null);
      setDiabetesModalVisible(false);
      setDiabetesTypeModalVisible(false);
      return;
    }

    setDiabetesModalVisible(false);
    setDiabetesTypeModalVisible(true);
  }

  function selectDiabetesType(type) {
    const condicoes = splitListText(clinicalForm.condicoes);
    const nextCondicoes = condicoes.some((item) => item.toLowerCase() === 'diabetes')
      ? condicoes
      : [...condicoes, 'Diabetes'];
    const nextForm = {
      ...clinicalForm,
      condicoes: nextCondicoes.join(', '),
      diabetes: buildDiabetesDisplay('Sim', type),
      diabetes_status: 'Sim',
      diabetes_tipo: type,
    };

    setClinicalForm(nextForm);
    setClinicalFeedback(null);
    setDiabetesTypeModalVisible(false);
  }

  function selectInsulinCategory(optionId) {
    setActiveInsulinProfileKey(optionId === 'basal' ? 'basal' : 'bolus');
    setClinicalFeedback(null);
    setInsulinCategoryModalVisible(false);
  }

  function selectInsulinType(option) {
    const fieldKey =
      activeInsulinProfileKey === 'basal' ? 'basal_insulin_type' : 'bolus_insulin_type';

    setClinicalForm((current) => ({
      ...current,
      [fieldKey]: option,
      ...(activeInsulinProfileKey === 'basal'
        ? {
            basal_insulin_device: '',
            basal_insulin_usage: '',
          }
        : {}),
    }));
    setClinicalFeedback(null);
    setInsulinTypeModalVisible(false);
  }

  function selectInsulinUsage(option) {
    const fieldKey =
      activeInsulinProfileKey === 'basal' ? 'basal_insulin_usage' : 'bolus_insulin_usage';

    setClinicalForm((current) => ({
      ...current,
      [fieldKey]: option,
    }));
    setClinicalFeedback(null);
    setInsulinUsageModalVisible(false);
  }

  function selectBasalInsulinDevice(option) {
    setClinicalForm((current) => ({
      ...current,
      basal_insulin_device: option,
    }));
    setClinicalFeedback(null);
    setInsulinDeviceModalVisible(false);
  }

  function toggleClinicalSelection(fieldKey, option) {
    const fieldOptions = {
      objetivos: { options: ONBOARDING_OBJECTIVE_OPTIONS, max: ONBOARDING_OBJECTIVE_MAX },
      condicoes: { options: ONBOARDING_CONDITION_OPTIONS, noneOption: ONBOARDING_CONDITION_NONE },
      situacoes: { options: ONBOARDING_SITUATION_OPTIONS, noneOption: ONBOARDING_SITUATION_NONE },
      procedimentos: { options: ONBOARDING_PROCEDURE_OPTIONS, noneOption: ONBOARDING_PROCEDURE_NONE },
    };
    const config = fieldOptions[fieldKey];
    if (!config) return;

    const currentSelection = ensureArray(clinicalForm[fieldKey]);
    const isSelected = currentSelection.includes(option);
    let nextSelection = [];

    if (config.noneOption && option === config.noneOption) {
      nextSelection = isSelected ? [] : [option];
    } else {
      const withoutNone = config.noneOption
        ? currentSelection.filter((item) => item !== config.noneOption)
        : currentSelection;

      if (isSelected) {
        nextSelection = withoutNone.filter((item) => item !== option);
      } else if (config.max && withoutNone.length >= config.max) {
        nextSelection = withoutNone;
      } else {
        nextSelection = [...withoutNone, option];
      }
    }

    setClinicalForm((current) => ({
      ...current,
      [fieldKey]: nextSelection.join(', '),
      ...(fieldKey === 'procedimentos' && option === ONBOARDING_PROCEDURE_NONE
        ? { procedimento_outros: '' }
        : {}),
    }));
  }

  function closeClinicalModal(fieldKey) {
    if (fieldKey === 'objetivos') return setObjectiveModalVisible(false);
    if (fieldKey === 'condicoes') return setConditionModalVisible(false);
    if (fieldKey === 'situacoes') return setSituationModalVisible(false);
    if (fieldKey === 'procedimentos') return setProcedureModalVisible(false);
  }

  function toggleSection(sectionKey) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  const sections = useMemo(() => buildPatientProfileSections(paciente || {}), [paciente]);
  const nomePaciente = profileForm.nome_completo || paciente?.nome_completo || fallbackName;
  const insulinClinicalFieldKeys = useMemo(
    () => new Set([
      'insulinoterapia_atual',
      'basal_insulin_type',
      'basal_insulin_device',
      'basal_insulin_usage',
      'basal_insulin_dose',
      'basal_insulin_notes',
      'bolus_insulin_type',
      'bolus_insulin_usage',
      'bolus_insulin_dose',
      'bolus_insulin_notes',
    ]),
    []
  );
  const activeInsulinCategoryId = activeInsulinProfileKey === 'basal' ? 'basal' : 'prandial';
  const selectedInsulinTypeOptions =
    activeInsulinProfileKey === 'basal'
      ? BASAL_INSULIN_PROFILE_OPTIONS.map((option) => option.label)
      : INSULIN_TYPE_OPTIONS[activeInsulinCategoryId] || [];
  const selectedInsulinUsageOptions = INSULIN_USAGE_OPTIONS[activeInsulinCategoryId] || [];
  const selectedInsulinCategoryLabel = activeInsulinProfileKey === 'basal'
    ? 'Insulina basal'
    : 'Insulina bolus';
  const basalInsulinSummary = [
    clinicalForm.basal_insulin_type,
    clinicalForm.basal_insulin_device,
    clinicalForm.basal_insulin_dose ? `${clinicalForm.basal_insulin_dose} UI` : '',
  ]
    .filter((item) => String(item || '').trim())
    .join(' â€¢ ');
  const bolusInsulinSummary = [
    clinicalForm.bolus_insulin_type,
    clinicalForm.bolus_insulin_usage,
    clinicalForm.bolus_insulin_dose ? `${clinicalForm.bolus_insulin_dose} UI` : '',
  ]
    .filter((item) => String(item || '').trim())
    .join(' â€¢ ');
  const activeInsulinTypeValue =
    activeInsulinProfileKey === 'basal'
      ? clinicalForm.basal_insulin_type
      : clinicalForm.bolus_insulin_type;
  const activeBasalInsulinOption = findBasalProfileOption(clinicalForm.basal_insulin_type);
  const activeBasalDeviceOptions = activeBasalInsulinOption?.allowedDevices || [];
  const activeInsulinDeviceFieldKey = 'basal_insulin_device';
  const activeInsulinDeviceValue = clinicalForm.basal_insulin_device;
  const activeInsulinUsageValue =
    activeInsulinProfileKey === 'basal'
      ? clinicalForm.basal_insulin_usage
      : clinicalForm.bolus_insulin_usage;
  const activeInsulinDoseFieldKey =
    activeInsulinProfileKey === 'basal' ? 'basal_insulin_dose' : 'bolus_insulin_dose';
  const activeInsulinDoseValue =
    activeInsulinProfileKey === 'basal'
      ? clinicalForm.basal_insulin_dose
      : clinicalForm.bolus_insulin_dose;
  const activeInsulinNotesFieldKey =
    activeInsulinProfileKey === 'basal' ? 'basal_insulin_notes' : 'bolus_insulin_notes';
  const activeInsulinNotesValue =
    activeInsulinProfileKey === 'basal'
      ? clinicalForm.basal_insulin_notes
      : clinicalForm.bolus_insulin_notes;
  const insulinClinicalSummary = useMemo(
    () =>
      [
        clinicalForm.insulinoterapia_atual,
        basalInsulinSummary ? `Basal: ${basalInsulinSummary}` : '',
        bolusInsulinSummary ? `Bolus: ${bolusInsulinSummary}` : '',
      ]
        .filter((item) => String(item || '').trim())
        .join(' â€¢ '),
    [
      clinicalForm.insulinoterapia_atual,
      basalInsulinSummary,
      bolusInsulinSummary,
    ]
  );
  const isProfileFormDirty = useMemo(
    () => JSON.stringify(profileForm) !== JSON.stringify(savedProfileForm),
    [profileForm, savedProfileForm]
  );
  const isClinicalFormDirty = useMemo(
    () => JSON.stringify(clinicalForm) !== JSON.stringify(savedClinicalForm),
    [clinicalForm, savedClinicalForm]
  );
  const isTherapyFormDirty = useMemo(
    () => JSON.stringify(therapyPlans) !== JSON.stringify(savedTherapyPlans),
    [therapyPlans, savedTherapyPlans]
  );
  const therapyPlansByCategory = useMemo(
    () =>
      PHARMACOLOGY_CATEGORY_OPTIONS.reduce((accumulator, option) => {
        accumulator[option.value] =
          therapyPlans.find(
            (plan) => plan.categoria_funcional === option.value && plan.status !== 'inativo'
          ) || null;
        return accumulator;
      }, {}),
    [therapyPlans]
  );
  const heroInlineDetails = useMemo(
    () =>
      [
        formatCpfInput(profileForm.cpf_paciente),
        formatPhoneInput(profileForm.telefone),
        profileForm.data_nascimento,
        buildFullAddressText(profileForm),
      ].filter((item) => String(item || '').trim()),
    [profileForm]
  );
  const isClinicalSelectFocused = (fieldKey) => {
    if (fieldKey === 'diabetes') return diabetesModalVisible || diabetesTypeModalVisible;
    if (fieldKey === 'insulin_category_default') return insulinCategoryModalVisible;
    if (fieldKey === 'insulin_type_default') return insulinTypeModalVisible;
    if (fieldKey === 'insulin_usage_default') return insulinUsageModalVisible;
    if (fieldKey === 'objetivos') return objectiveModalVisible;
    if (fieldKey === 'condicoes') return conditionModalVisible;
    if (fieldKey === 'situacoes') return situationModalVisible;
    if (fieldKey === 'procedimentos') return procedureModalVisible;
    return false;
  };
  const getTherapyFieldDisplayValue = (fieldKey, value) => {
    const options = getTherapyOptionsForField(fieldKey);
    return normalizeDisplayText(
      options.find((option) => (option.value || option.marca) === value)?.label ||
        options.find((option) => (option.value || option.marca) === value)?.marca ||
        value ||
        ''
    );
  };
  const buildTherapyPlanSummary = (plan) => {
    if (!plan) {
      return {
        title: 'Nenhum plano configurado',
        subtitle: 'Toque para preencher o formulÃ¡rio dessa insulina.',
        details: [],
      };
    }

    const deviceLabel = getTherapyFieldDisplayValue('dispositivo', plan.dispositivo);
    const viaLabel = getTherapyFieldDisplayValue('via', plan.via);
    const statusLabel = getTherapyFieldDisplayValue('status', plan.status);
    const basalOption =
      plan.categoria_funcional === 'basal' ? findBasalTherapyOption(plan.marca, getBasalLookupValue(plan)) : null;
    const basalMetadata =
      plan.categoria_funcional === 'basal'
        ? getBasalDisplayMetadata(plan.marca, getBasalLookupValue(plan))
        : null;
    const bolusMetadata =
      plan.categoria_funcional === 'bolus'
        ? getBolusDisplayMetadata(plan.marca, getBolusLookupValue(plan))
        : null;
    const presentationLabel =
      plan.categoria_funcional === 'basal'
        ? basalOption?.concentration || getTherapyFieldDisplayValue('apresentacao', plan.apresentacao)
        : plan.apresentacao || getTherapyFieldDisplayValue('apresentacao', plan.apresentacao);
    const frequencyLabel = getTherapyFieldDisplayValue('frequencia_uso', plan.frequencia_uso);
    const bolusModeLabel = getTherapyFieldDisplayValue('modo_uso', plan.modo_uso);
    const scheduleSummary = (plan.tabela_horarios || [])
      .filter((item) => item.dia_semana || item.horario || item.dose || item.observacao)
      .map((item) => getTherapyScheduleSummaryItem(item, plan.dose_unidade || 'UI'))
      .join(' | ');
    const basalScheduleCount = (plan.tabela_horarios || []).filter((item) =>
      String(item?.dose || item?.horario || item?.dia_semana).trim()
    ).length;
    const shouldShowDefaultDose = plan.categoria_funcional !== 'basal' || basalScheduleCount <= 1;

    return {
      title: normalizeDisplayText(plan.marca || 'Plano configurado'),
      subtitle: [
        plan.molecula,
        basalMetadata?.actionClass || bolusMetadata?.actionClass || plan.classe_acao,
        statusLabel,
      ]
        .filter(Boolean)
        .map((item) => normalizeDisplayText(item))
        .join(' • '),
      details: [
        [plan.categoria_funcional === 'basal' ? frequencyLabel : bolusModeLabel, deviceLabel, presentationLabel, viaLabel]
          .filter(Boolean)
          .map((item) => normalizeDisplayText(item))
          .join(' • '),
        (basalMetadata?.durationLabel || bolusMetadata?.durationLabel)
          ? normalizeDisplayText(`Duração: ${basalMetadata?.durationLabel || bolusMetadata?.durationLabel}`)
          : '',
        bolusMetadata?.administrationTimingLabel
          ? normalizeDisplayText(`Aplicação sugerida: ${bolusMetadata.administrationTimingLabel}`)
          : '',
        shouldShowDefaultDose && plan.dose
          ? normalizeDisplayText(`Dose padrão: ${plan.dose} ${plan.dose_unidade || 'UI'}`)
          : '',
        scheduleSummary ? normalizeDisplayText(`Horários: ${scheduleSummary}`) : '',
      ]
        .filter(Boolean)
        .map((item) => normalizeDisplayText(item)),
    };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'web' && styles.webScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
        <SectionCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(nomePaciente || 'P').trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>{nomePaciente}</Text>
              <Text style={styles.heroEmail}>
                {profileForm.email_pac || paciente?.email_pac || usuarioLogado?.email || 'E-mail nÃ£o informado'}
              </Text>
              {heroInlineDetails.length ? (
                <Text style={styles.heroInlineDetails} numberOfLines={3}>
                  {heroInlineDetails.join('  â€¢  ')}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.heroBadgeText}>Perfil clÃ­nico protegido</Text>
          </View>
        </SectionCard>

        {sections.map((section) => (
          <SectionCard
            key={section.key}
            onLayout={section.key === 'patient' ? registerScrollContainer : undefined}
            style={styles.profileSection}
          >
            <DrilldownHeader
              title={section.title}
              helper={section.helper}
              open={openSections[section.key]}
              onPress={() => toggleSection(section.key)}
            />

            {openSections[section.key] ? (
              section.key === 'patient' ? (
                <View style={styles.editForm} onLayout={registerScrollContainer}>
                  {PATIENT_PROFILE_FIELDS.map((field) => (
                    <View
                      key={field.key}
                      onLayout={registerFieldLayout(`profile-${field.key}`)}
                      style={styles.editField}
                    >
                      <Text style={styles.infoLabel}>{field.label}</Text>
                      {field.type === 'select' ? (
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => setGenderModalVisible(true)}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            profileFieldErrors[field.key] ? styles.profileInputError : null,
                            genderModalVisible ? styles.profileInputFocused : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !profileForm[field.key] ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {profileForm[field.key] || field.placeholder}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : (
                        <TextInput
                          value={profileForm[field.key]}
                          onBlur={() => blurProfileField(field.key)}
                          onChangeText={(value) => handleProfileFieldChange(field.key, value)}
                          onFocus={() => focusProfileField(field.key)}
                          placeholder={field.placeholder}
                          placeholderTextColor={patientTheme.colors.textMuted}
                          keyboardType={field.keyboardType || 'default'}
                          autoCapitalize={field.autoCapitalize || 'sentences'}
                          maxLength={field.maxLength}
                          style={[
                            styles.profileInput,
                            profileFieldErrors[field.key] ? styles.profileInputError : null,
                            focusedProfileField === field.key ? styles.profileInputFocused : null,
                          ]}
                        />
                      )}

                      {profileFieldErrors[field.key] ? (
                        <Text style={styles.fieldErrorText}>{profileFieldErrors[field.key]}</Text>
                      ) : null}

                      {field.key === 'cep' && (cepLoading || cepFeedback) ? (
                        <View style={styles.cepStatus}>
                          {cepLoading ? (
                            <ActivityIndicator size="small" color={patientTheme.colors.primaryDark} />
                          ) : null}
                          {cepFeedback ? (
                            <Text
                              style={[
                                styles.statusText,
                                cepFeedback.type === 'error' ? styles.statusTextError : null,
                              ]}
                            >
                              {cepFeedback.message}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ))}

                  {profileFeedback ? (
                    <Text
                      style={[
                        styles.formFeedback,
                        profileFeedback.type === 'error' ? styles.formFeedbackError : null,
                      ]}
                    >
                      {profileFeedback.message}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={!isProfileFormDirty || savingProfile}
                    onPress={saveProfileData}
                    style={[
                      styles.saveProfileButton,
                      (!isProfileFormDirty || savingProfile) && styles.saveProfileButtonDisabled,
                    ]}
                  >
                    {savingProfile ? (
                      <ActivityIndicator color={patientTheme.colors.onPrimary} />
                    ) : (
                      <Text style={styles.saveProfileButtonText}>Salvar dados</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : section.key === 'clinical' ? (
                <View style={styles.editForm} onLayout={registerScrollContainer}>
                  {CLINICAL_PROFILE_FIELDS.filter((field) => !insulinClinicalFieldKeys.has(field.key)).map((field) => (
                    <View
                      key={field.key}
                      onLayout={registerFieldLayout(`clinical-${field.key}`)}
                      style={styles.editField}
                    >
                      <Text style={styles.infoLabel}>{field.label}</Text>

                      {field.type === 'diabetes' ? (
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => setDiabetesModalVisible(true)}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            clinicalFieldErrors[field.key] ? styles.profileInputError : null,
                            isClinicalSelectFocused(field.key) ? styles.profileInputFocused : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !clinicalForm[field.key] ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {clinicalForm[field.key] || field.placeholder}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : field.type === 'insulin-category' || field.type === 'insulin-type' || field.type === 'insulin-usage' ? (
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => {
                            if (field.type === 'insulin-category') return setInsulinCategoryModalVisible(true);
                            if (field.type === 'insulin-type') {
                              if (!clinicalForm.insulin_category_default) return setInsulinCategoryModalVisible(true);
                              return setInsulinTypeModalVisible(true);
                            }
                            if (!clinicalForm.insulin_category_default) return setInsulinCategoryModalVisible(true);
                            return setInsulinUsageModalVisible(true);
                          }}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            clinicalFieldErrors[field.key] ? styles.profileInputError : null,
                            isClinicalSelectFocused(field.key) ? styles.profileInputFocused : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !clinicalForm[field.key] ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {field.type === 'insulin-category'
                              ? selectedInsulinCategoryLabel || field.placeholder
                              : clinicalForm[field.key] || field.placeholder}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : field.key === 'objetivos' || field.key === 'condicoes' || field.key === 'situacoes' || field.key === 'procedimentos' ? (
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => {
                            if (field.key === 'objetivos') return setObjectiveModalVisible(true);
                            if (field.key === 'condicoes') return setConditionModalVisible(true);
                            if (field.key === 'situacoes') return setSituationModalVisible(true);
                            if (field.key === 'procedimentos') return setProcedureModalVisible(true);
                          }}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            clinicalFieldErrors[field.key] ? styles.profileInputError : null,
                            isClinicalSelectFocused(field.key) ? styles.profileInputFocused : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !clinicalForm[field.key] ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {clinicalForm[field.key] || field.placeholder}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : (
                        <TextInput
                          value={clinicalForm[field.key]}
                          onBlur={() => blurClinicalField(field.key)}
                          onChangeText={(value) => handleClinicalFieldChange(field.key, value)}
                          onFocus={() => focusClinicalField(field.key)}
                          placeholder={field.placeholder}
                          placeholderTextColor={patientTheme.colors.textMuted}
                          keyboardType={field.keyboardType || 'default'}
                          autoCapitalize={field.autoCapitalize || 'sentences'}
                          editable={!field.readOnly}
                          multiline={field.multiline}
                          style={[
                            styles.profileInput,
                            field.multiline ? styles.profileTextArea : null,
                            field.readOnly ? styles.profileInputReadOnly : null,
                            clinicalFieldErrors[field.key] ? styles.profileInputError : null,
                            focusedClinicalField === field.key ? styles.profileInputFocused : null,
                          ]}
                        />
                      )}

                      {clinicalFieldErrors[field.key] ? (
                        <Text style={styles.fieldErrorText}>{clinicalFieldErrors[field.key]}</Text>
                      ) : null}
                    </View>
                  ))}

                  <View
                    onLayout={registerFieldLayout('clinical-insulin-config')}
                    style={styles.editField}
                  >
                    <Text style={styles.infoLabel}>ConfiguraÃ§Ã£o de insulina</Text>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      onPress={() => setInsulinConfigModalVisible(true)}
                      style={[
                        styles.profileInput,
                        styles.profileSelect,
                        insulinConfigModalVisible ? styles.profileInputFocused : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.profileSelectText,
                          !insulinClinicalSummary ? styles.profileSelectPlaceholder : null,
                        ]}
                      >
                        {insulinClinicalSummary || 'Toque para configurar a insulina no popup'}
                      </Text>
                      <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {clinicalFeedback ? (
                    <Text
                      style={[
                        styles.formFeedback,
                        clinicalFeedback.type === 'error' ? styles.formFeedbackError : null,
                      ]}
                    >
                      {clinicalFeedback.message}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={!isClinicalFormDirty || savingClinical}
                    onPress={saveClinicalData}
                    style={[
                      styles.saveProfileButton,
                      (!isClinicalFormDirty || savingClinical) && styles.saveProfileButtonDisabled,
                    ]}
                  >
                    {savingClinical ? (
                      <ActivityIndicator color={patientTheme.colors.onPrimary} />
                    ) : (
                      <Text style={styles.saveProfileButtonText}>Salvar dados clÃ­nicos</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : section.key === 'pharmacology' ? (
                <View style={styles.editForm}>
                  <Text style={styles.therapyIntroText}>
                    Toque em basal, bolus ou mista para editar a insulina.
                  </Text>

                  {PHARMACOLOGY_CATEGORY_OPTIONS.map((option) => {
                    const plan = therapyPlansByCategory[option.value];
                    const summary = buildTherapyPlanSummary(plan);

                    return (
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.82}
                        onPress={() =>
                          openTherapyEditor(
                            plan || {
                              ...createEmptyTherapyPlan(),
                              categoria_funcional: option.value,
                            }
                          )
                        }
                        style={styles.therapyFieldCard}
                      >
                        <View style={styles.therapyFieldHeader}>
                          <View style={styles.therapyFieldTitleWrap}>
                            <Text style={styles.therapyFieldLabel}>{option.label}</Text>
                            <Text style={styles.therapyFieldDescription}>
                              {normalizeDisplayText(option.descricao)}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={patientTheme.colors.primaryDark} />
                        </View>

                        <View style={styles.therapyFieldSummary}>
                          <Text style={styles.therapyFieldValue}>{normalizeDisplayText(summary.title)}</Text>
                          <Text style={styles.therapyFieldSubvalue}>
                            {normalizeDisplayText(summary.subtitle || 'Nenhum plano salvo ainda')}
                          </Text>
                          {summary.details.map((detail) => (
                            <Text key={`${option.value}-${detail}`} style={styles.therapyMetaText}>
                              {normalizeDisplayText(detail)}
                            </Text>
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {therapyFeedback ? (
                    <Text
                      style={[
                        styles.formFeedback,
                        therapyFeedback.type === 'error' ? styles.formFeedbackError : null,
                      ]}
                    >
                      {therapyFeedback.message}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={!isTherapyFormDirty || savingTherapy}
                    onPress={savePharmacologyData}
                    style={[
                      styles.saveProfileButton,
                      (!isTherapyFormDirty || savingTherapy) && styles.saveProfileButtonDisabled,
                    ]}
                  >
                    {savingTherapy ? (
                      <ActivityIndicator color={patientTheme.colors.onPrimary} />
                    ) : (
                      <Text style={styles.saveProfileButtonText}>Salvar terapia farmacolÃƒÂ³gica</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.infoList}>
                  {section.rows.map((row) => (
                    <InfoRow key={`${section.key}-${row.label}`} label={row.label} value={row.value} />
                  ))}
                </View>
              )
            ) : null}
          </SectionCard>
        ))}

        <View style={styles.footerSpace} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={genderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGenderModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setGenderModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>GÃªnero</Text>
                <Text style={styles.emailModalText}>Como vocÃª se identifica?</Text>

                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectGenderOption(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {profileForm.sexo_biologico === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={diabetesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiabetesModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDiabetesModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Diabetes</Text>
                <Text style={styles.emailModalText}>VocÃª possui diagnÃ³stico de diabetes?</Text>

                {['NÃ£o', 'Sim'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectDiabetesStatus(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {clinicalForm.diabetes_status === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={diabetesTypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiabetesTypeModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDiabetesTypeModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Tipo de diabetes</Text>
                <Text style={styles.emailModalText}>Selecione o diagnÃ³stico informado.</Text>

                {DIABETES_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectDiabetesType(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {clinicalForm.diabetes_tipo === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={therapyEditorVisible}
        transparent
        animationType="fade"
        onRequestClose={closeTherapyEditor}
      >
        <TouchableWithoutFeedback onPress={closeTherapyEditor}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.therapyModalCard}>
                <ScrollView
                  style={styles.therapyModalScroll}
                  contentContainerStyle={styles.therapyModalScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.emailModalTitle}>
                    {editingTherapyId ? 'Editar terapia farmacológica' : 'Nova terapia farmacológica'}
                  </Text>
                  <Text style={styles.emailModalText}>
                    Confira a categoria fixa, selecione a insulina e confirme os dados de uso domiciliar.
                  </Text>

                  <View style={styles.editForm}>
                    <View style={styles.editField}>
                      <Text style={styles.infoLabel}>Categoria funcional</Text>
                      <View
                        style={[
                          styles.profileInput,
                          styles.profileInputReadOnly,
                          styles.profileSelect,
                        ]}
                      >
                        <Text
                          style={[
                            styles.profileSelectText,
                            !therapyDraft.categoria_funcional ? styles.profileSelectPlaceholder : null,
                          ]}
                        >
                          {getTherapyFieldDisplayValue('categoria_funcional', therapyDraft.categoria_funcional) ||
                            'Selecione basal, bolus ou mista'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.editField}>
                      <Text style={styles.infoLabel}>
                        {therapyDraft.categoria_funcional === 'basal' ? 'Marca/Tipo da Basal' : 'Marca'}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => openTherapyOptionModal('marca')}
                        style={[
                          styles.profileInput,
                          styles.profileSelect,
                          focusedTherapyField === 'marca' ? styles.profileInputFocused : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.profileSelectText,
                            !therapyDraft.marca ? styles.profileSelectPlaceholder : null,
                          ]}
                        >
                          {therapyDraft.marca ||
                            (therapyDraft.categoria_funcional === 'basal'
                              ? 'Selecione a basal'
                              : 'Selecione a marca')}
                        </Text>
                        <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {therapyDraft.categoria_funcional !== 'basal' && therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Molécula</Text>
                        <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                          {therapyDraft.molecula || 'Preenchido automaticamente pela marca'}
                        </Text>
                      </View>
                    ) : null}

                    {therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Classe de ação</Text>
                        <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                          {therapyDraft.categoria_funcional === 'basal'
                            ? getBasalDisplayMetadata(
                                therapyDraft.marca,
                                getBasalLookupValue(therapyDraft)
                              ).actionClass ||
                              'Preenchida automaticamente pela basal'
                            : therapyDraft.classe_acao || 'Preenchida automaticamente pela marca'}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.editField}>
                      <Text style={styles.infoLabel}>Dispositivo</Text>
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => openTherapyOptionModal('dispositivo')}
                        style={[styles.profileInput, styles.profileSelect]}
                      >
                        <Text
                          style={[
                            styles.profileSelectText,
                            !therapyDraft.dispositivo ? styles.profileSelectPlaceholder : null,
                          ]}
                        >
                          {getTherapyFieldDisplayValue('dispositivo', therapyDraft.dispositivo) ||
                            'Confirme o dispositivo'}
                        </Text>
                        <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {therapyDraft.categoria_funcional === 'bolus' ? (
                      <>
                        <View style={styles.editField}>
                          <Text style={styles.infoLabel}>Modo de uso</Text>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() => openTherapyOptionModal('modo_uso')}
                            style={[styles.profileInput, styles.profileSelect]}
                          >
                            <Text
                              style={[
                                styles.profileSelectText,
                                !therapyDraft.modo_uso ? styles.profileSelectPlaceholder : null,
                              ]}
                            >
                              {getTherapyFieldDisplayValue('modo_uso', therapyDraft.modo_uso) ||
                                'Selecione o modo de uso'}
                            </Text>
                            <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.editField}>
                          <Text style={styles.infoLabel}>Observações</Text>
                          <TextInput
                            value={therapyDraft.observacoes || ''}
                            onChangeText={(value) => handleTherapyDraftChange('observacoes', value)}
                            placeholder="Ex: aplicar conforme glicemia e refeição"
                            placeholderTextColor={patientTheme.colors.textMuted}
                            multiline
                            style={[styles.profileInput, styles.profileTextArea]}
                          />
                        </View>

                        <View style={styles.editField}>
                          <Text style={styles.infoLabel}>Horários e doses do bolus</Text>
                          {(therapyDraft.tabela_horarios || []).map((schedule, index) => (
                            <View key={`${therapyDraft.id}-schedule-${index}`} style={styles.scheduleCard}>
                              <View style={styles.editField}>
                                <Text style={styles.scheduleFieldLabel}>Refeição</Text>
                                <TouchableOpacity
                                  activeOpacity={0.78}
                                  onPress={() => openTherapyOptionModal('schedule_refeicao', index)}
                                  style={[styles.profileInput, styles.profileSelect]}
                                >
                                  <Text
                                    style={[
                                      styles.profileSelectText,
                                      !schedule.refeicao ? styles.profileSelectPlaceholder : null,
                                    ]}
                                  >
                                    {getTherapyFieldDisplayValue('schedule_refeicao', schedule.refeicao) ||
                                      'Selecione a refeição'}
                                  </Text>
                                  <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                                </TouchableOpacity>
                              </View>

                              <View style={styles.dualFieldRow}>
                                <View style={[styles.editField, styles.dualFieldItem]}>
                                  <Text style={styles.scheduleFieldLabel}>Horário</Text>
                                  <TextInput
                                    value={schedule.horario}
                                    onChangeText={(value) =>
                                      handleTherapyScheduleChange(index, 'horario', formatTimeInput(value))
                                    }
                                    placeholder="08:00"
                                    placeholderTextColor={patientTheme.colors.textMuted}
                                    keyboardType="number-pad"
                                    maxLength={5}
                                    style={styles.profileInput}
                                  />
                                </View>

                                <View style={[styles.editField, styles.dualFieldItem]}>
                                  <Text style={styles.scheduleFieldLabel}>
                                    {therapyDraft.dose_unidade === 'UI por cartucho' ? 'Dose (cartucho)' : 'Dose (UI)'}
                                  </Text>
                                  <TextInput
                                    value={schedule.dose}
                                    onChangeText={(value) =>
                                      handleTherapyScheduleChange(index, 'dose', formatSingleDecimalDoseInput(value))
                                    }
                                    placeholder="Ex: 10"
                                    placeholderTextColor={patientTheme.colors.textMuted}
                                    keyboardType="decimal-pad"
                                    style={styles.profileInput}
                                  />
                                </View>
                              </View>

                              <View style={styles.editField}>
                                <Text style={styles.scheduleFieldLabel}>Tipo de dose</Text>
                                <TouchableOpacity
                                  activeOpacity={0.78}
                                  onPress={() => openTherapyOptionModal('schedule_tipo_dose', index)}
                                  style={[styles.profileInput, styles.profileSelect]}
                                >
                                  <Text
                                    style={[
                                      styles.profileSelectText,
                                      !schedule.tipo_dose ? styles.profileSelectPlaceholder : null,
                                    ]}
                                  >
                                    {getTherapyFieldDisplayValue('schedule_tipo_dose', schedule.tipo_dose) ||
                                      'Selecione o tipo de dose'}
                                  </Text>
                                  <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                                </TouchableOpacity>
                              </View>

                              <View style={styles.editField}>
                                <Text style={styles.scheduleFieldLabel}>Observação</Text>
                                <TextInput
                                  value={schedule.observacao}
                                  onChangeText={(value) => handleTherapyScheduleChange(index, 'observacao', value)}
                                  placeholder="Ex: corrigir se glicemia estiver alta"
                                  placeholderTextColor={patientTheme.colors.textMuted}
                                  multiline
                                  style={[styles.profileInput, styles.profileTextArea]}
                                />
                              </View>

                              <TouchableOpacity
                                activeOpacity={0.78}
                                onPress={() => removeTherapyScheduleRow(index)}
                                style={styles.scheduleRemoveButton}
                              >
                                <Text style={styles.scheduleRemoveButtonText}>Remover horário</Text>
                              </TouchableOpacity>
                            </View>
                          ))}

                          <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={addTherapyScheduleRow}
                            style={styles.therapyInlineAddButton}
                          >
                            <Text style={styles.therapyInlineAddButtonText}>Adicionar horário</Text>
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => setBolusTechnicalExpanded((current) => !current)}
                          style={styles.technicalToggleButton}
                        >
                          <Text style={styles.technicalToggleText}>Detalhes técnicos</Text>
                          <Ionicons
                            name={bolusTechnicalExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={patientTheme.colors.textMuted}
                          />
                        </TouchableOpacity>

                        {bolusTechnicalExpanded ? (
                          <View style={styles.technicalDetailsCard}>
                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Molécula</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {therapyDraft.molecula || 'Preenchida automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Classe de ação</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {getBolusDisplayMetadata(
                                  therapyDraft.marca,
                                  getBolusLookupValue(therapyDraft)
                                ).actionClass || 'Preenchida automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Concentração</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {therapyDraft.concentracao || 'Preenchida automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Apresentação</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {therapyDraft.apresentacao || 'Preenchida automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Via</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {getTherapyFieldDisplayValue('via', therapyDraft.via) || 'Preenchida automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Início da ação</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {therapyDraft.inicio_acao || 'Estimado automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Pico</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {therapyDraft.pico || 'Estimado automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Duração</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {therapyDraft.duracao || 'Estimado automaticamente'}
                              </Text>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.infoLabel}>Tempo de aplicação sugerido</Text>
                              <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                                {therapyDraft.tempo_aplicacao_sugerido || 'Estimado automaticamente'}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </>
                    ) : therapyDraft.categoria_funcional !== 'basal' && therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Apresentação</Text>
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => openTherapyOptionModal('apresentacao')}
                          style={[styles.profileInput, styles.profileSelect]}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !therapyDraft.apresentacao ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {getTherapyFieldDisplayValue('apresentacao', therapyDraft.apresentacao) ||
                              'Confirme a apresentação'}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {therapyDraft.categoria_funcional !== 'basal' && therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Via sugerida</Text>
                        <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                          {getTherapyFieldDisplayValue('via', therapyDraft.via) ||
                            'Definida automaticamente pelo dispositivo'}
                        </Text>
                      </View>
                    ) : null}

                    {therapyDraft.categoria_funcional !== 'basal' && therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Escala (Unidade)</Text>
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => openTherapyOptionModal('escala_unidade')}
                          style={[styles.profileInput, styles.profileSelect]}
                        >
                          <Text style={styles.profileSelectText}>
                            {therapyDraft.escala_unidade && therapyDraft.escala_unidade !== 'UI'
                              ? getTherapyFieldDisplayValue('escala_unidade', therapyDraft.escala_unidade)
                              : ''}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {therapyDraft.categoria_funcional === 'basal' ? (
                      <>
                        <View style={styles.editField}>
                          <Text style={styles.infoLabel}>Frequência de uso</Text>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() => openTherapyOptionModal('frequencia_uso')}
                            style={[styles.profileInput, styles.profileSelect]}
                          >
                            <Text
                              style={[
                                styles.profileSelectText,
                                !therapyDraft.frequencia_uso ? styles.profileSelectPlaceholder : null,
                              ]}
                            >
                              {getTherapyFieldDisplayValue('frequencia_uso', therapyDraft.frequencia_uso) ||
                                'Selecione a frequência'}
                            </Text>
                            <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.editField}>
                          <Text style={styles.infoLabel}>Horários de uso</Text>
                          {(therapyDraft.tabela_horarios || []).map((schedule, index) => {
                            const isWeeklySchedule =
                              getBasalFrequencyConfig(therapyDraft.frequencia_uso)?.scheduleType === 'weekly';

                            return (
                              <View key={`${therapyDraft.id}-schedule-${index}`} style={styles.scheduleCard}>
                                {isWeeklySchedule ? (
                                  <View style={styles.editField}>
                                    <Text style={styles.scheduleFieldLabel}>Dia da semana</Text>
                                    <TouchableOpacity
                                      activeOpacity={0.78}
                                      onPress={() => openTherapyOptionModal('schedule_dia_semana', index)}
                                      style={[styles.profileInput, styles.profileSelect]}
                                    >
                                      <Text
                                        style={[
                                          styles.profileSelectText,
                                          !schedule.dia_semana ? styles.profileSelectPlaceholder : null,
                                        ]}
                                      >
                                        {schedule.dia_semana || 'Selecione o dia'}
                                      </Text>
                                      <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                                    </TouchableOpacity>
                                  </View>
                                ) : null}

                                <View style={styles.dualFieldRow}>
                                  <View style={[styles.editField, styles.dualFieldItem]}>
                                    <Text style={styles.scheduleFieldLabel}>Horário</Text>
                                    <TextInput
                                      value={schedule.horario}
                                      onChangeText={(value) =>
                                        handleTherapyScheduleChange(index, 'horario', formatTimeInput(value))
                                      }
                                      placeholder="08:00"
                                      placeholderTextColor={patientTheme.colors.textMuted}
                                      keyboardType="number-pad"
                                      maxLength={5}
                                      style={styles.profileInput}
                                    />
                                  </View>

                                  <View style={[styles.editField, styles.dualFieldItem]}>
                                    <Text style={styles.scheduleFieldLabel}>Dose (UI)</Text>
                                    <TextInput
                                      value={schedule.dose}
                                      onChangeText={(value) =>
                                        handleTherapyScheduleChange(index, 'dose', formatSingleDecimalDoseInput(value))
                                      }
                                      onBlur={() =>
                                        handleTherapyScheduleChange(
                                          index,
                                          'dose',
                                          ensureSingleDecimalDoseInput(schedule.dose)
                                        )
                                      }
                                      placeholder="Ex: 10"
                                      placeholderTextColor={patientTheme.colors.textMuted}
                                      keyboardType="decimal-pad"
                                      style={styles.profileInput}
                                    />
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </>
                    ) : therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.dualFieldRow}>
                        <View style={[styles.editField, styles.dualFieldItem]}>
                          <Text style={styles.infoLabel}>Dose</Text>
                          <TextInput
                            value={therapyDraft.dose}
                            onChangeText={(value) => handleTherapyDraftChange('dose', formatDecimalInput(value))}
                            onFocus={() => setFocusedTherapyField('dose')}
                            onBlur={() => setFocusedTherapyField('')}
                            placeholder="Ex: 10"
                            placeholderTextColor={patientTheme.colors.textMuted}
                            keyboardType="decimal-pad"
                            style={[
                              styles.profileInput,
                              focusedTherapyField === 'dose' ? styles.profileInputFocused : null,
                            ]}
                          />
                        </View>

                        <View style={[styles.editField, styles.dualFieldItem]}>
                          <Text style={styles.infoLabel}>Unidade da dose</Text>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() => openTherapyOptionModal('dose_unidade')}
                            style={[styles.profileInput, styles.profileSelect]}
                          >
                            <Text style={styles.profileSelectText}>
                              {getTherapyFieldDisplayValue('dose_unidade', therapyDraft.dose_unidade) || 'UI'}
                            </Text>
                            <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    {therapyDraft.categoria_funcional !== 'basal' && therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Horários de uso</Text>
                        {(therapyDraft.tabela_horarios || []).map((schedule, index) => (
                          <View key={`${therapyDraft.id}-schedule-${index}`} style={styles.scheduleCard}>
                            <View style={styles.dualFieldRow}>
                              <View style={[styles.editField, styles.dualFieldItem]}>
                                <Text style={styles.scheduleFieldLabel}>Horário</Text>
                                <TextInput
                                  value={schedule.horario}
                                  onChangeText={(value) =>
                                    handleTherapyScheduleChange(index, 'horario', formatTimeInput(value))
                                  }
                                  placeholder="07:00"
                                  placeholderTextColor={patientTheme.colors.textMuted}
                                  keyboardType="number-pad"
                                  maxLength={5}
                                  style={styles.profileInput}
                                />
                              </View>

                              <View style={[styles.editField, styles.dualFieldItem]}>
                                <Text style={styles.scheduleFieldLabel}>Dose</Text>
                                <TextInput
                                  value={schedule.dose}
                                  onChangeText={(value) =>
                                    handleTherapyScheduleChange(index, 'dose', formatSingleDecimalDoseInput(value))
                                  }
                                  onBlur={() =>
                                    handleTherapyScheduleChange(
                                      index,
                                      'dose',
                                      ensureSingleDecimalDoseInput(schedule.dose)
                                    )
                                  }
                                  placeholder="10"
                                  placeholderTextColor={patientTheme.colors.textMuted}
                                  keyboardType="decimal-pad"
                                  style={styles.profileInput}
                                />
                              </View>
                            </View>

                            <View style={styles.editField}>
                              <Text style={styles.scheduleFieldLabel}>Observação</Text>
                              <TextInput
                                value={schedule.observacao}
                                onChangeText={(value) => handleTherapyScheduleChange(index, 'observacao', value)}
                                placeholder="Ex: Antes do café da manhã"
                                placeholderTextColor={patientTheme.colors.textMuted}
                                multiline
                                style={[styles.profileInput, styles.profileTextArea]}
                              />
                            </View>

                            <TouchableOpacity
                              activeOpacity={0.78}
                              onPress={() => removeTherapyScheduleRow(index)}
                              style={styles.scheduleRemoveButton}
                            >
                              <Text style={styles.scheduleRemoveButtonText}>Remover horário</Text>
                            </TouchableOpacity>
                          </View>
                        ))}

                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={addTherapyScheduleRow}
                          style={styles.therapyInlineAddButton}
                        >
                          <Text style={styles.therapyInlineAddButtonText}>Adicionar horário</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {therapyDraft.categoria_funcional !== 'basal' && therapyDraft.categoria_funcional !== 'bolus' ? (
                      <>
                        <View style={styles.dualFieldRow}>
                          <View style={[styles.editField, styles.dualFieldItem]}>
                            <Text style={styles.infoLabel}>Início da ação</Text>
                            <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                              {therapyDraft.inicio_acao || 'Estimado automaticamente'}
                            </Text>
                          </View>

                          <View style={[styles.editField, styles.dualFieldItem]}>
                            <Text style={styles.infoLabel}>Pico</Text>
                            <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                              {therapyDraft.pico || 'Estimado automaticamente'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.editField}>
                          <Text style={styles.infoLabel}>Duração</Text>
                          <Text style={[styles.profileInput, styles.profileInputReadOnly]}>
                            {therapyDraft.duracao || 'Estimado automaticamente'}
                          </Text>
                        </View>
                      </>
                    ) : null}

                    {therapyDraft.categoria_funcional !== 'basal' && therapyDraft.categoria_funcional !== 'bolus' ? (
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Status</Text>
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => openTherapyOptionModal('status')}
                          style={[styles.profileInput, styles.profileSelect]}
                        >
                          <Text style={styles.profileSelectText}>
                            {getTherapyFieldDisplayValue('status', therapyDraft.status) || 'Ativo'}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={saveTherapyDraftLocally}
                      style={styles.emailModalPrimaryButton}
                    >
                      <Text style={styles.emailModalPrimaryButtonText}>Salvar este plano</Text>
                    </TouchableOpacity>

                    {editingTherapyId ? (
                      <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={() => removeTherapyPlan(editingTherapyId)}
                        style={styles.therapyModalDangerButton}
                      >
                        <Text style={styles.therapyModalDangerButtonText}>Excluir plano</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={therapyOptionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setTherapyOptionModalVisible(false);
          setTherapyOptionField('');
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setTherapyOptionModalVisible(false);
            setTherapyOptionField('');
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.selectionModalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Selecionar opção</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setTherapyOptionModalVisible(false);
                      setTherapyOptionField('');
                    }}
                  >
                    <Ionicons name="close" size={20} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.emailModalText}>
                  {therapyOptionField === 'marca'
                    ? 'As opções são filtradas pela categoria funcional escolhida.'
                    : 'Selecione a opção desejada para esse campo.'}
                </Text>

                {getTherapyOptionsForField(therapyOptionField).length ? (
                  <ScrollView
                    style={styles.selectionOptionScroll}
                    contentContainerStyle={styles.selectionOptionList}
                    showsVerticalScrollIndicator={false}
                  >
                    {getTherapyOptionsForField(therapyOptionField).map((option) => {
                      const optionValue = option.value || option.marca;
                      const selectedValue = therapyDraft[therapyOptionField];
                      const description = getTherapyOptionDescription(option);

                      return (
                        <TouchableOpacity
                          key={`${therapyOptionField}-${optionValue}`}
                          activeOpacity={0.82}
                          onPress={() => selectTherapyOption(option)}
                          style={[
                            styles.selectionOptionButton,
                            selectedValue === optionValue ? styles.selectionOptionButtonSelected : null,
                          ]}
                        >
                          <View style={styles.therapyOptionCopy}>
                            <Text
                              style={[
                                styles.selectionOptionText,
                                selectedValue === optionValue ? styles.selectionOptionTextSelected : null,
                              ]}
                            >
                              {getTherapyOptionLabel(option)}
                            </Text>
                            {description ? (
                              <Text style={styles.therapyOptionDescription}>{description}</Text>
                            ) : null}
                          </View>
                          {selectedValue === optionValue ? (
                            <Ionicons name="checkmark" size={18} color={patientTheme.colors.primaryDark} />
                          ) : null}
                        </TouchableOpacity>
                        );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={styles.therapyEmptyText}>
                    Escolha a categoria funcional primeiro para liberar as opções.
                  </Text>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={insulinConfigModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsulinConfigModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setInsulinConfigModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.emailModalCard}>
                <Text style={styles.emailModalTitle}>Configuração de insulina</Text>
                  <Text style={styles.emailModalText}>
                    Preencha aqui os dados padrão da insulinoterapia. A configuração salva no perfil
                    será usada para pré-preencher o registro de insulina no app.
                  </Text>

                <View style={styles.editForm}>
                  <View style={styles.editField}>
                    <Text style={styles.infoLabel}>Uso de insulina</Text>
                    <TextInput
                      value={clinicalForm.insulinoterapia_atual}
                      onBlur={() => blurClinicalField('insulinoterapia_atual')}
                      onChangeText={(value) => handleClinicalFieldChange('insulinoterapia_atual', value)}
                      onFocus={() => focusClinicalField('insulinoterapia_atual')}
                      placeholder="Ex: Basal e ultrarrapida, bomba, nao usa"
                      placeholderTextColor={patientTheme.colors.textMuted}
                      multiline
                      style={[
                        styles.profileInput,
                        styles.profileTextArea,
                        focusedClinicalField === 'insulinoterapia_atual' ? styles.profileInputFocused : null,
                      ]}
                    />
                  </View>

                  <View style={styles.editField}>
                    <Text style={styles.infoLabel}>Perfil configurado</Text>
                    <View style={styles.measurementChoiceList}>
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => setActiveInsulinProfileKey('basal')}
                        style={[
                          styles.measurementChoiceButton,
                          activeInsulinProfileKey === 'basal'
                            ? styles.measurementChoiceButtonCurrent
                            : styles.measurementChoiceButtonPrevious,
                        ]}
                      >
                        <Text
                          style={
                            activeInsulinProfileKey === 'basal'
                              ? styles.measurementChoiceTextCurrent
                              : styles.measurementChoiceTextPrevious
                          }
                        >
                          Basal
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => setActiveInsulinProfileKey('bolus')}
                        style={[
                          styles.measurementChoiceButton,
                          activeInsulinProfileKey === 'bolus'
                            ? styles.measurementChoiceButtonCurrent
                            : styles.measurementChoiceButtonPrevious,
                        ]}
                      >
                        <Text
                          style={
                            activeInsulinProfileKey === 'bolus'
                              ? styles.measurementChoiceTextCurrent
                              : styles.measurementChoiceTextPrevious
                          }
                        >
                          Bolus
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.editField}>
                    <Text style={styles.infoLabel}>Categoria configurada</Text>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      onPress={() => setInsulinCategoryModalVisible(true)}
                      style={[
                        styles.profileInput,
                        styles.profileSelect,
                        insulinCategoryModalVisible ? styles.profileInputFocused : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.profileSelectText,
                          !selectedInsulinCategoryLabel ? styles.profileSelectPlaceholder : null,
                        ]}
                      >
                        {selectedInsulinCategoryLabel || 'Selecione o perfil'}
                      </Text>
                      <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.editField}>
                    <Text style={styles.infoLabel}>
                      {activeInsulinProfileKey === 'basal'
                        ? 'Marca/Tipo da Basal'
                        : 'Tipo padrão da insulina'}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      onPress={() => setInsulinTypeModalVisible(true)}
                      style={[
                        styles.profileInput,
                        styles.profileSelect,
                        insulinTypeModalVisible ? styles.profileInputFocused : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.profileSelectText,
                          !activeInsulinTypeValue ? styles.profileSelectPlaceholder : null,
                        ]}
                      >
                        {activeInsulinTypeValue ||
                          activeInsulinProfileKey === 'basal'
                            ? 'Selecione a basal configurada'
                            : `Selecione o tipo ${activeInsulinProfileKey === 'basal' ? 'basal' : 'bolus'}`}
                      </Text>
                      <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {activeInsulinProfileKey === 'basal' ? (
                    <>
                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Classe de ação</Text>
                        <View style={[styles.profileInput, styles.profileInputReadOnly]}>
                          <Text style={styles.profileSelectText}>
                            {activeBasalInsulinOption?.actionClass || 'Preenchido automaticamente'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.editField}>
                        <Text style={styles.infoLabel}>Dispositivo</Text>
                        <TouchableOpacity
                          activeOpacity={0.78}
                          onPress={() => {
                            if (!activeBasalInsulinOption) return;
                            setInsulinDeviceModalVisible(true);
                          }}
                          style={[
                            styles.profileInput,
                            styles.profileSelect,
                            insulinDeviceModalVisible ? styles.profileInputFocused : null,
                            !activeBasalInsulinOption ? styles.profileInputReadOnly : null,
                          ]}
                          disabled={!activeBasalInsulinOption}
                        >
                          <Text
                            style={[
                              styles.profileSelectText,
                              !activeInsulinDeviceValue ? styles.profileSelectPlaceholder : null,
                            ]}
                          >
                            {activeInsulinDeviceValue || 'Selecione o dispositivo'}
                          </Text>
                          <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>

                    </>
                  ) : (
                    <View style={styles.editField}>
                      <Text style={styles.infoLabel}>Objetivo padrão da insulina</Text>
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => setInsulinUsageModalVisible(true)}
                        style={[
                          styles.profileInput,
                          styles.profileSelect,
                          insulinUsageModalVisible ? styles.profileInputFocused : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.profileSelectText,
                            !activeInsulinUsageValue ? styles.profileSelectPlaceholder : null,
                          ]}
                        >
                          {activeInsulinUsageValue || 'Selecione o objetivo da bolus'}
                        </Text>
                        <Ionicons name="chevron-down" size={19} color={patientTheme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.editField}>
                    <Text style={styles.infoLabel}>Dose padrão (UI)</Text>
                    <TextInput
                      value={activeInsulinDoseValue}
                      onBlur={() => blurClinicalField(activeInsulinDoseFieldKey)}
                      onChangeText={(value) =>
                        handleClinicalFieldChange(
                          activeInsulinDoseFieldKey,
                          String(value || '').replace(/\D/g, '').slice(0, 4)
                        )
                      }
                      onFocus={() => focusClinicalField(activeInsulinDoseFieldKey)}
                      placeholder="Ex: 12"
                      placeholderTextColor={patientTheme.colors.textMuted}
                      keyboardType="numeric"
                      style={[
                        styles.profileInput,
                        focusedClinicalField === activeInsulinDoseFieldKey ? styles.profileInputFocused : null,
                      ]}
                    />
                  </View>

                  {activeInsulinProfileKey !== 'basal' ? (
                    <View style={styles.editField}>
                      <Text style={styles.infoLabel}>Observações padrão da insulina</Text>
                      <TextInput
                        value={activeInsulinNotesValue}
                        onBlur={() => blurClinicalField(activeInsulinNotesFieldKey)}
                        onChangeText={(value) => handleClinicalFieldChange(activeInsulinNotesFieldKey, value)}
                        onFocus={() => focusClinicalField(activeInsulinNotesFieldKey)}
                        placeholder="Ex: Aplicar no jantar ou conforme prescricao"
                        placeholderTextColor={patientTheme.colors.textMuted}
                        multiline
                        style={[
                          styles.profileInput,
                          styles.profileTextArea,
                          focusedClinicalField === activeInsulinNotesFieldKey ? styles.profileInputFocused : null,
                        ]}
                      />
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.emailModalSecondaryButton}
                    onPress={() => setInsulinConfigModalVisible(false)}
                  >
                    <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={insulinCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsulinCategoryModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setInsulinCategoryModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Perfil de insulina</Text>
                <Text style={styles.emailModalText}>Escolha se você quer editar a basal ou a bolus.</Text>

                {INSULIN_CATEGORY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.78}
                    onPress={() => selectInsulinCategory(option.id)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option.label}</Text>
                    {((option.id === 'basal' && activeInsulinProfileKey === 'basal') ||
                      (option.id === 'prandial' && activeInsulinProfileKey === 'bolus')) ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={insulinTypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsulinTypeModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setInsulinTypeModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>
                  {activeInsulinProfileKey === 'basal'
                    ? 'Marca/Tipo da Basal'
                    : 'Tipo da insulina bolus'}
                </Text>
                <Text style={styles.emailModalText}>
                  {activeInsulinProfileKey === 'basal'
                    ? 'Selecione a basal configurada para uso diário.'
                    : 'Selecione o tipo usado com mais frequencia nesse perfil.'}
                </Text>

                {selectedInsulinTypeOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectInsulinType(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {activeInsulinTypeValue === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={insulinDeviceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsulinDeviceModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setInsulinDeviceModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Dispositivo da basal</Text>
                <Text style={styles.emailModalText}>
                  Selecione o dispositivo compatÃ­vel com a basal configurada.
                </Text>

                {activeBasalDeviceOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectBasalInsulinDevice(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {activeInsulinDeviceValue === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={insulinUsageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsulinUsageModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setInsulinUsageModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>
                  {activeInsulinProfileKey === 'basal' ? 'Objetivo da basal' : 'Objetivo da bolus'}
                </Text>
                <Text style={styles.emailModalText}>
                  Selecione como essa insulina costuma ser usada.
                </Text>

                {selectedInsulinUsageOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.78}
                    onPress={() => selectInsulinUsage(option)}
                    style={styles.genderOptionItem}
                  >
                    <Text style={styles.genderOptionText}>{option}</Text>
                    {activeInsulinUsageValue === option ? (
                      <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={objectiveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setObjectiveModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setObjectiveModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Objetivos nutricionais</Text>
                <Text style={styles.emailModalText}>Selecione atÃ© 3 objetivos.</Text>
                {ONBOARDING_OBJECTIVE_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.objetivos).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('objetivos', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setObjectiveModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={conditionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConditionModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setConditionModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>CondiÃ§Ãµes clÃ­nicas</Text>
                <Text style={styles.emailModalText}>Selecione as condiÃ§Ãµes que se aplicam.</Text>
                {ONBOARDING_CONDITION_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.condicoes).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('condicoes', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setConditionModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={situationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSituationModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSituationModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>SituaÃ§Ãµes clÃ­nicas</Text>
                <Text style={styles.emailModalText}>Selecione as situaÃ§Ãµes que jÃ¡ ocorreram.</Text>
                {ONBOARDING_SITUATION_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.situacoes).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('situacoes', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setSituationModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={procedureModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProcedureModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setProcedureModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.genderModalCard}>
                <Text style={styles.emailModalTitle}>Procedimentos clÃ­nicos</Text>
                <Text style={styles.emailModalText}>Selecione procedimentos relevantes.</Text>
                {ONBOARDING_PROCEDURE_OPTIONS.map((option) => {
                  const selected = ensureArray(clinicalForm.procedimentos).includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.78}
                      onPress={() => toggleClinicalSelection('procedimentos', option)}
                      style={styles.genderOptionItem}
                    >
                      <Text style={styles.genderOptionText}>{option}</Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={21} color={patientTheme.colors.primaryDark} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.emailModalSecondaryButton}
                  onPress={() => setProcedureModalVisible(false)}
                >
                  <Text style={styles.emailModalSecondaryButtonText}>Concluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={emailVerificationVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelEmailVerification}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.emailModalCard}>
                  <Text style={styles.emailModalTitle}>CÃ³digo enviado</Text>
                  <Text style={styles.emailModalText}>
                    Digite o cÃ³digo de 6 dÃ­gitos enviado para{' '}
                    {emailPendingVerification || getNormalizedProfileEmail()}.
                  </Text>

                  <TextInput
                    style={[
                      styles.profileInput,
                      styles.codeInput,
                      emailVerificationError ? styles.profileInputError : null,
                    ]}
                    value={emailVerificationCode}
                    onChangeText={(value) => {
                      const code = value.replace(/\D/g, '').slice(0, 6);
                      setEmailVerificationCode(code);
                      setEmailVerificationError(
                        code && code.length < 6 ? 'Digite os 6 dÃ­gitos enviados por e-mail.' : ''
                      );
                    }}
                    placeholder="000000"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!emailVerificationLoading && !savingProfile}
                  />

                  {emailVerificationError ? (
                    <Text style={styles.codeErrorText}>{emailVerificationError}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.emailModalPrimaryButton,
                      (emailVerificationLoading || savingProfile) && styles.emailModalButtonDisabled,
                    ]}
                    onPress={confirmEmailVerificationCode}
                    disabled={emailVerificationLoading || savingProfile}
                  >
                    {emailVerificationLoading || savingProfile ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.emailModalPrimaryButtonText}>Salvar dados</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emailModalSecondaryButton}
                    onPress={resendEmailVerificationCode}
                    disabled={emailVerificationLoading || savingProfile}
                  >
                    {emailVerificationLoading ? (
                      <ActivityIndicator color={patientTheme.colors.primaryDark} />
                    ) : (
                      <Text style={styles.emailModalSecondaryButtonText}>Reenviar cÃ³digo</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.emailModalCancelButton}
                    onPress={cancelEmailVerification}
                    disabled={emailVerificationLoading || savingProfile}
                  >
                    <Text style={styles.emailModalCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: patientTheme.colors.background,
  },
  containerWeb: {
    minHeight: '100%',
    overflow: 'visible',
  },
  keyboard: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    marginTop: 12,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    overflowX: 'hidden',
    overflowY: 'visible',
  },
  scrollContent: {
    flexGrow: 1,
    padding: patientTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 32,
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroCard: {
    marginTop: 0,
    padding: 14,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
  },
  heroCopy: {
    flex: 1,
  },
  heroName: {
    color: patientTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  heroEmail: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  heroInlineDetails: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  profileSection: {
    marginTop: 16,
  },
  drilldownHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drilldownHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHelper: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  infoList: {
    gap: 10,
    marginTop: 16,
  },
  editForm: {
    gap: 12,
    marginTop: 16,
  },
  editField: {
    gap: 6,
  },
  profileInput: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1.5,
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileInputFocused: {
    ...inputFocusBorder,
    backgroundColor: '#ffffff',
  },
  profileInputError: {
    borderColor: patientTheme.colors.danger,
  },
  profileInputReadOnly: {
    backgroundColor: '#f0f2f3',
    color: patientTheme.colors.textMuted,
  },
  profileTextArea: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  profileSelect: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileSelectText: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  profileSelectPlaceholder: {
    color: patientTheme.colors.textMuted,
  },
  fieldErrorText: {
    color: patientTheme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: -2,
  },
  cepStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statusText: {
    color: patientTheme.colors.primaryDark,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  statusTextError: {
    color: patientTheme.colors.danger,
  },
  formFeedback: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 2,
  },
  formFeedbackError: {
    color: patientTheme.colors.danger,
  },
  saveProfileButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
  },
  saveProfileButtonDisabled: {
    backgroundColor: '#c8c8c8',
  },
  saveProfileButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
  },
  measurementChoiceList: {
    flexDirection: 'row',
    gap: 10,
  },
  measurementChoiceButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: patientTheme.radius.lg,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  measurementChoiceButtonCurrent: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.primaryDark,
  },
  measurementChoiceButtonPrevious: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  measurementChoiceTextCurrent: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
  },
  measurementChoiceTextPrevious: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  infoRow: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    ...patientShadow,
  },
  infoLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 6,
  },
  therapyIntroText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  therapyCard: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  therapyCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  therapyCardCopy: {
    flex: 1,
    gap: 4,
  },
  therapyCardTitle: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  therapyCardSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  therapyChipButton: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  therapyChipButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  therapyMetaList: {
    gap: 4,
  },
  therapyMetaText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  therapyDeleteButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  therapyDeleteButtonText: {
    color: patientTheme.colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  therapyEmptyCard: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.xl,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 16,
  },
  therapyEmptyText: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  therapyAddButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  therapyAddButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  therapyFieldCard: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  therapyFieldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  therapyFieldTitleWrap: {
    flex: 1,
    gap: 4,
  },
  therapyFieldLabel: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  therapyFieldDescription: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  therapyFieldSummary: {
    gap: 4,
  },
  therapyFieldValue: {
    color: patientTheme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '800',
  },
  therapyFieldSubvalue: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  therapyModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    maxHeight: '88%',
    maxWidth: 520,
    width: '100%',
  },
  selectionModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: patientTheme.radius.xl,
    maxWidth: 420,
    padding: 18,
    width: '100%',
    ...patientShadow,
  },
  selectionOptionScroll: {
    marginTop: 14,
    maxHeight: 420,
  },
  selectionOptionList: {
    gap: 8,
    paddingBottom: 2,
  },
  selectionOptionButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectionOptionButtonSelected: {
    backgroundColor: patientTheme.colors.primarySoft,
    borderColor: patientTheme.colors.primaryDark,
  },
  selectionOptionText: {
    color: patientTheme.colors.textMuted,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  selectionOptionTextSelected: {
    color: patientTheme.colors.text,
  },
  therapyModalScroll: {
    maxHeight: '100%',
  },
  therapyModalScrollContent: {
    padding: 22,
  },
  dualFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dualFieldItem: {
    flex: 1,
  },
  scheduleCard: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
    padding: 12,
  },
  scheduleFieldLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scheduleRemoveButton: {
    alignSelf: 'flex-start',
  },
  scheduleRemoveButtonText: {
    color: patientTheme.colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  therapyInlineAddButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  therapyInlineAddButtonText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  therapyModalDangerButton: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.pill,
    marginTop: 10,
    padding: 16,
  },
  therapyModalDangerButtonText: {
    color: '#D92D20',
    fontSize: 15,
    fontWeight: '800',
  },
  therapyOptionCopy: {
    flex: 1,
  },
  therapyOptionDescription: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  technicalToggleButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  technicalToggleText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  technicalDetailsCard: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.xl,
    borderWidth: 1,
    marginTop: 10,
    padding: 14,
  },
  footerSpace: {
    height: 10,
  },
  modalKeyboard: {
    flex: 1,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  emailModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  genderModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  genderOptionItem: {
    alignItems: 'center',
    borderBottomColor: patientTheme.colors.surfaceBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: 12,
  },
  genderOptionText: {
    color: patientTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emailModalTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  emailModalText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    textAlign: 'center',
  },
  codeInput: {
    borderColor: patientTheme.colors.primary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  codeErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emailModalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.pill,
    marginTop: 10,
    padding: 16,
  },
  emailModalButtonDisabled: {
    opacity: 0.6,
  },
  emailModalPrimaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emailModalSecondaryButton: {
    alignItems: 'center',
    borderColor: patientTheme.colors.primary,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 1,
    marginTop: 10,
    padding: 16,
  },
  emailModalSecondaryButtonText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '800',
  },
  emailModalCancelButton: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 12,
  },
  emailModalCancelButtonText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
