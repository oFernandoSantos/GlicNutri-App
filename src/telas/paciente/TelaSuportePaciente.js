import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import MensagemInline from '../../componentes/comum/MensagemInline';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { getPatientDisplayName, getPatientId } from '../../servicos/servicoDadosPaciente';
import {
  EMAIL_CONTATO_SUPORTE,
  abrirEmailSuporte,
  enviarRelatoSuporte,
  escolherPrintSuporteDaGaleria,
  getCategoriaSuporteLabel,
  tirarFotoPrintSuporte,
} from '../../servicos/servicoSuportePaciente';

const ASSUNTOS_SUPORTE_POR_CATEGORIA = {
  bug: [
    'Erro ao salvar informacoes',
    'Tela travando ou fechando',
    'Botao nao funciona',
    'Problema com notificacoes',
  ],
  duvida: [
    'Como usar uma funcionalidade',
    'Como falar com a nutricionista',
    'Como registrar refeicoes',
    'Como registrar glicose',
  ],
  conta: [
    'Nao consigo entrar no app',
    'Problema com senha',
    'Problema com cadastro',
    'Atualizar dados da conta',
  ],
  dados: [
    'Informacao errada no perfil',
    'Plano alimentar incorreto',
    'Historico com dados inconsistentes',
    'Consulta nao aparece',
  ],
  sugestao: [
    'Melhoria de usabilidade',
    'Nova funcionalidade',
    'Melhoria no visual da tela',
    'Melhoria nas notificacoes',
  ],
  outro: [
    'Atendimento geral',
    'Relato de experiencia',
    'Solicitacao diversa',
  ],
};

export default function PacienteSuporteScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const nomePaciente = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);
  const temIdentificacao = Boolean(
    getPatientId(usuarioLogado) || usuarioLogado?.nome_completo || usuarioLogado?.email_pac
  );

  const [categoria, setCategoria] = useState('outro');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [protocoloEnviado, setProtocoloEnviado] = useState(null);
  const [ultimoRelatoEnviado, setUltimoRelatoEnviado] = useState(null);
  const [printAsset, setPrintAsset] = useState(null);
  const [carregandoPrint, setCarregandoPrint] = useState(false);
  const [ultimoPrintEnviado, setUltimoPrintEnviado] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [assuntoSelectorVisible, setAssuntoSelectorVisible] = useState(false);
  const [assuntoPersonalizado, setAssuntoPersonalizado] = useState(false);
  const [confirmacaoEnvioVisible, setConfirmacaoEnvioVisible] = useState(false);

  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);

  const opcoesAssunto = ASSUNTOS_SUPORTE_POR_CATEGORIA[categoria] || [];

  async function handleEscolherPrint(origem) {
    if (carregandoPrint || enviando) return;

    try {
      setCarregandoPrint(true);
      const asset =
        origem === 'camera' ? await tirarFotoPrintSuporte() : await escolherPrintSuporteDaGaleria();

      if (asset?.uri) {
        setPrintAsset(asset);
      }
    } catch (error) {
      setFeedback({
        tipo: 'erro',
        texto: error?.message || 'Não foi possível selecionar a imagem.',
      });
    } finally {
      setCarregandoPrint(false);
    }
  }

  function handleRemoverPrint() {
    setPrintAsset(null);
  }

  async function handleEnviarRelato() {
    if (enviando) return;

    setFeedback(null);

    try {
      setEnviando(true);

      const resultado = await enviarRelatoSuporte({
        categoria,
        assunto,
        mensagem,
        usuarioLogado,
        telaAtual: route?.name || 'PacienteSuporte',
        printAsset,
      });

      setUltimoRelatoEnviado({
        categoria,
        assunto,
        mensagem: mensagem.trim(),
        printFotoUrl: resultado.printFotoUrl,
      });
      setUltimoPrintEnviado(Boolean(resultado.printFotoUrl));
      setProtocoloEnviado(resultado.protocolo);
      setAssunto('');
      setMensagem('');
      setPrintAsset(null);

      let textoSucesso = `Relato enviado. Se precisarmos de mais detalhes, respondemos em ${EMAIL_CONTATO_SUPORTE}.`;
      if (printAsset?.uri && resultado.printFotoUrl) {
        textoSucesso += ' O print foi anexado ao relato.';
      } else if (printAsset?.uri && resultado.avisoPrint) {
        textoSucesso = `${resultado.avisoPrint} Protocolo: ${resultado.protocolo}.`;
      }

      setFeedback({
        tipo: resultado.avisoPrint ? 'aviso' : 'sucesso',
        texto: textoSucesso,
      });
    } catch (error) {
      setFeedback({
        tipo: 'erro',
        texto: error?.message || 'Não foi possível enviar o relato. Tente novamente.',
      });
    } finally {
      setEnviando(false);
    }
  }

  async function handleAbrirEmail() {
    if (!protocoloEnviado) return;

    try {
      const relato = ultimoRelatoEnviado || { categoria, assunto, mensagem };
      const abriu = await abrirEmailSuporte({
        protocolo: protocoloEnviado,
        categoria: relato.categoria,
        assunto: relato.assunto || getCategoriaSuporteLabel(relato.categoria),
        mensagem: relato.mensagem || '(relato registrado no app)',
        usuarioLogado,
        telaAtual: route?.name,
        printFotoUrl: relato.printFotoUrl,
      });

      if (!abriu) {
        setFeedback({
          tipo: 'aviso',
          texto: 'Não foi possível abrir o app de e-mail neste dispositivo.',
        });
      }
    } catch (error) {
      setFeedback({
        tipo: 'erro',
        texto: error?.message || 'Não foi possível abrir o e-mail.',
      });
    }
  }

  function handleNovoRelato() {
    setProtocoloEnviado(null);
    setUltimoRelatoEnviado(null);
    setFeedback(null);
    setCategoria('outro');
    setAssunto('');
    setAssuntoSelectorVisible(false);
    setAssuntoPersonalizado(false);
    setMensagem('');
    setPrintAsset(null);
    setUltimoPrintEnviado(false);
  }

  function handleSelecionarAssunto(valor) {
    setAssunto(valor);
    setAssuntoSelectorVisible(false);
    setAssuntoPersonalizado(false);
  }

  function handleSelecionarOutroAssunto() {
    setAssunto('');
    setAssuntoSelectorVisible(false);
    setAssuntoPersonalizado(true);
  }

  function handleAbrirConfirmacaoEnvio() {
    if (enviando) return;
    setConfirmacaoEnvioVisible(true);
  }

  async function handleConfirmarEnvioRelato() {
    setConfirmacaoEnvioVisible(false);
    await handleEnviarRelato();
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      keyboardAware
    >
      {feedback?.texto ? (
        <MensagemInline
          tipo={feedback.tipo}
          texto={feedback.texto}
          onFechar={() => setFeedback(null)}
        />
      ) : null}

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="headset-outline" size={22} color={patientTheme.colors.primaryDark} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.sectionTitle}>Equipe de suporte</Text>
            <Text style={styles.infoText}>
              Nossa equipe de suporte analisa relatos de bugs, dúvidas e sugestões enviados pelo
              aplicativo.
            </Text>
          </View>
        </View>

        <View style={styles.emailRow}>
          <Ionicons name="mail-outline" size={18} color={patientTheme.colors.primaryDark} />
          <Text style={styles.emailLabel}>Contato:</Text>
          <Text style={styles.emailValue}>{EMAIL_CONTATO_SUPORTE}</Text>
        </View>

        {temIdentificacao ? (
          <Text style={styles.senderLine}>
            Enviando como <Text style={styles.senderName}>{nomePaciente}</Text>
          </Text>
        ) : null}
      </View>

      {protocoloEnviado ? (
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <Ionicons name="checkmark-circle" size={36} color={patientTheme.colors.primaryDark} />
            <Text style={styles.sectionTitle}>Relato registrado</Text>
          </View>
          <View style={styles.protocolPill}>
            <Text style={styles.protocolPillText}>Protocolo {protocoloEnviado}</Text>
          </View>
          <Text style={styles.infoText}>
            Guarde este código. O responsável consulta os relatos no painel administrativo
            (Auditoria).
          </Text>
          {ultimoPrintEnviado ? (
            <Text style={styles.printSentHint}>Print da tela anexado ao relato.</Text>
          ) : null}
          <TouchableOpacity style={styles.secondaryAction} onPress={handleAbrirEmail}>
            <Ionicons name="mail-open-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.secondaryActionText}>Enviar cópia por e-mail</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryAction} onPress={handleNovoRelato}>
            <Text style={styles.primaryActionText}>Novo relato</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Detalhes do atendimento</Text>

            <Text style={styles.fieldLabel}>Assunto</Text>
            <TouchableOpacity
              style={[styles.input, styles.dropdownButton]}
              activeOpacity={0.88}
              onPress={() => setAssuntoSelectorVisible((current) => !current)}
            >
              <Text
                style={[
                  styles.dropdownButtonText,
                  !assunto && styles.dropdownPlaceholderText,
                ]}
                numberOfLines={1}
              >
                {assunto || `Ex.: ${getCategoriaSuporteLabel(categoria)}`}
              </Text>
              <Ionicons
                name={assuntoSelectorVisible ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={patientTheme.colors.textMuted}
              />
            </TouchableOpacity>

            {assuntoSelectorVisible ? (
              <View style={styles.dropdownList}>
                {opcoesAssunto.map((opcao) => {
                  const ativo = assunto === opcao && !assuntoPersonalizado;
                  return (
                    <TouchableOpacity
                      key={opcao}
                      style={[styles.dropdownOption, ativo && styles.dropdownOptionActive]}
                      onPress={() => handleSelecionarAssunto(opcao)}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          ativo && styles.dropdownOptionTextActive,
                        ]}
                      >
                        {opcao}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[
                    styles.dropdownOption,
                    styles.dropdownOptionCustom,
                    assuntoPersonalizado && styles.dropdownOptionActive,
                  ]}
                  onPress={handleSelecionarOutroAssunto}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      assuntoPersonalizado && styles.dropdownOptionTextActive,
                    ]}
                  >
                    Outro assunto
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {assuntoPersonalizado ? (
              <TextInput
                style={[styles.input, styles.customSubjectInput]}
                placeholder="Descreva o assunto"
                placeholderTextColor={patientTheme.colors.textMuted}
                value={assunto}
                onChangeText={setAssunto}
                maxLength={80}
              />
            ) : null}

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>O que aconteceu?</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Conte o passo a passo: o que você fez, o que esperava e o que o app mostrou."
              placeholderTextColor={patientTheme.colors.textMuted}
              value={mensagem}
              onChangeText={setMensagem}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{mensagem.length}/2000 · mínimo 12 caracteres</Text>

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
              Anexo da ocorrencia
            </Text>
            <Text style={styles.printHelper}>
              Envie um print ou uma imagem para ajudar nossa equipe a analisar o relato.
            </Text>

            <TouchableOpacity
              style={styles.printDropzone}
              onPress={() => handleEscolherPrint('galeria')}
              activeOpacity={0.88}
              disabled={carregandoPrint || enviando}
            >
              {printAsset?.uri ? (
                <Image source={{ uri: printAsset.uri }} style={styles.printPreview} resizeMode="contain" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={28} color={patientTheme.colors.textMuted} />
                  <Text style={styles.printDropzoneTitle}>Adicionar anexo</Text>
                  <Text style={styles.printDropzoneText}>Toque para selecionar uma imagem da galeria</Text>
                </>
              )}
            </TouchableOpacity>

            {printAsset?.uri ? (
              <View style={styles.printActionsRow}>
                <TouchableOpacity
                  style={[styles.printActionBtn, styles.printActionBtnDanger]}
                  onPress={handleRemoverPrint}
                  disabled={enviando}
                >
                  <Ionicons name="trash-outline" size={18} color="#B80710" />
                  <Text style={styles.printActionBtnTextDanger}>Remover</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {carregandoPrint ? (
              <Text style={styles.printLoadingText}>Preparando imagem...</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryAction, enviando && styles.actionDisabled]}
              onPress={handleAbrirConfirmacaoEnvio}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color={patientTheme.colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={patientTheme.colors.onPrimary} />
                  <Text style={styles.primaryActionText}>Enviar relato</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Antes de enviar</Text>
        <Text style={styles.tipsItem}>Nutricionista ou consulta → Mensagens ou Agendamentos.</Text>
        <Text style={styles.tipsItem}>Urgência médica → médico ou SAMU (192).</Text>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('PacienteAssistente', { usuarioLogado })}
        >
          <Text style={styles.linkText}>Dúvidas rápidas sobre rotina (assistente)</Text>
          <Ionicons name="chevron-forward" size={16} color={patientTheme.colors.primaryDark} />
        </TouchableOpacity>
      </View>
      <Modal
        visible={confirmacaoEnvioVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmacaoEnvioVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons
                name="paper-plane-outline"
                size={26}
                color={patientTheme.colors.primaryDark}
              />
            </View>
            <Text style={styles.confirmTitle}>Confirmar envio?</Text>
            <Text style={styles.confirmText}>
              Seu relato sera enviado para a equipe de suporte com as informacoes preenchidas.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setConfirmacaoEnvioVisible(false)}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmSaveButton}
                onPress={handleConfirmarEnvioRelato}
              >
                <Text style={styles.confirmSaveText}>Confirmar envio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginBottom: 14,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    width: 44,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  emailRow: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emailLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  emailValue: {
    color: patientTheme.colors.primaryDark,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  senderLine: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 12,
  },
  senderName: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  fieldLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  fieldLabelSpaced: {
    marginTop: 14,
  },
  input: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    color: patientTheme.colors.text,
    fontSize: 15,
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  dropdownButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    color: patientTheme.colors.text,
    flex: 1,
    fontSize: 15,
    marginRight: 10,
  },
  dropdownPlaceholderText: {
    color: patientTheme.colors.textMuted,
  },
  dropdownList: {
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderRadius: patientTheme.radius.lg,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownOption: {
    borderBottomColor: patientTheme.colors.border,
    borderBottomWidth: 1,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownOptionActive: {
    backgroundColor: patientTheme.colors.primarySoft,
  },
  dropdownOptionCustom: {
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownOptionTextActive: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
  },
  customSubjectInput: {
    marginTop: 8,
  },
  textArea: {
    minHeight: 132,
    paddingTop: 14,
  },
  charCount: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.55,
  },
  successHeader: {
    alignItems: 'center',
    gap: 8,
  },
  protocolPill: {
    alignSelf: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  protocolPillText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
  },
  tipsItem: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
  },
  linkText: {
    color: patientTheme.colors.primaryDark,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  printHelper: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  printDropzone: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.lg,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 140,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  printPreview: {
    backgroundColor: '#fff',
    borderRadius: patientTheme.radius.md,
    height: 200,
    width: '100%',
  },
  printDropzoneTitle: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  printDropzoneText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  printActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  printActionBtn: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  printActionBtnDanger: {
    backgroundColor: '#FFF5F5',
  },
  printActionBtnText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  printActionBtnTextDanger: {
    color: '#B80710',
    fontSize: 13,
    fontWeight: '700',
  },
  printLoadingText: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  printSentHint: {
    color: patientTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    ...patientShadow,
  },
  confirmIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    marginBottom: 14,
  },
  confirmTitle: {
    color: patientTheme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  confirmText: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.surfaceMuted,
  },
  confirmCancelText: {
    color: patientTheme.colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmSaveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
  },
  confirmSaveText: {
    color: patientTheme.colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});

