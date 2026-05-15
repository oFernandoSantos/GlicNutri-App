import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarraAbasAdmin, {
  ADMIN_TAB_BAR_HEIGHT,
  ADMIN_TAB_BAR_SPACE,
} from '../../componentes/admin/BarraAbasAdmin';
import MenuAdmin from '../../componentes/admin/MenuAdmin';
import { supabase } from '../../servicos/configSupabase';
import { isAdminUser } from '../../servicos/servicoAdmin';
import { registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';

export default function TelaCadastroAdministradorAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [menuVisible, setMenuVisible] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLogout() {
    setMenuVisible(false);
    if (adminUser) {
      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'logout_admin',
        entity: 'sessao',
        entityId: adminUser?.id_admin_uuid || null,
        origin: 'admin_cadastro_administrador',
        status: 'sucesso',
        details: {},
      });
    }
    await onAdminLogout?.();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: isAdminUser(adminUser) ? () => setMenuVisible(true) : undefined,
      readerMenuDisabled: !isAdminUser(adminUser),
      readerRightAction: undefined,
      readerRightIcon: undefined,
      readerRightLoading: false,
    });
  }, [navigation, adminUser]);

  async function cadastrarAdministrador() {
    const nome = form.nome.trim();
    const email = form.email.trim().toLowerCase();
    const senha = form.senha.trim();

    if (!nome || !email || !senha) {
      setMessage('Preencha nome, email e senha do administrador.');
      return;
    }

    if (!email.includes('@')) {
      setMessage('Informe um email valido para o administrador.');
      return;
    }

    if (senha.length < 8) {
      setMessage('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');

      const { data, error } = await supabase
        .from('administrador')
        .insert([
          {
            nome_completo_admin: nome,
            email_acesso: email,
            senha_admin: senha,
            ativo: true,
          },
        ])
        .select('id_admin_uuid, nome_completo_admin, email_acesso, ativo, created_at')
        .maybeSingle();

      if (error) throw error;

      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'administrador_cadastrado',
        entity: 'administrador',
        entityId: data?.id_admin_uuid || null,
        origin: 'admin_cadastro_administrador',
        status: 'sucesso',
        details: { email, nome },
      });

      setForm({ nome: '', email: '', senha: '' });
      setMessage('Administrador cadastrado com sucesso.');
    } catch (error) {
      const text = String(error?.message || '').toLowerCase();
      setMessage(text.includes('duplicate') || text.includes('unique')
        ? 'Ja existe um administrador com esse email.'
        : 'Nao foi possivel cadastrar o administrador agora.');
    } finally {
      setSaving(false);
    }
  }

  if (!isAdminUser(adminUser)) {
    return (
      <View style={styles.container}>
        <Text style={styles.accessText}>Entre com um perfil administrador.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />
      {menuVisible ? (
        <MenuAdmin
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onNavigate={(routeName, params = {}) => navigation.navigate(routeName, { usuarioLogado: adminUser, ...params })}
          onLogout={handleLogout}
          currentRoute="AdminCadastroAdministrador"
          userName={adminUser?.nome_completo_admin || adminUser?.email_acesso || 'Administrador'}
          userSubtitle="Cadastro de administradores"
        />
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={28} color={adminTheme.colors.primary} />
          </View>
          <Text style={styles.heroKicker}>Administrador</Text>
          <Text style={styles.heroTitle}>Cadastrar admin</Text>
          <Text style={styles.heroText}>Crie acessos administrativos separados dos demais cadastros do sistema.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Nome completo</Text>
          <TextInput
            value={form.nome}
            onChangeText={(value) => setForm((current) => ({ ...current, nome: value }))}
            placeholder="Nome do administrador"
            placeholderTextColor={adminTheme.colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Email de acesso</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
            placeholder="admin@dominio.com"
            placeholderTextColor={adminTheme.colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            secureTextEntry
            value={form.senha}
            onChangeText={(value) => setForm((current) => ({ ...current, senha: value }))}
            placeholder="Senha do administrador"
            placeholderTextColor={adminTheme.colors.textMuted}
            style={styles.input}
          />

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={cadastrarAdministrador} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={adminTheme.colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={18} color={adminTheme.colors.onPrimary} />
                <Text style={styles.saveButtonText}>Cadastrar administrador</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BarraAbasAdmin navigation={navigation} rotaAtual="AdminCadastros" usuarioLogado={adminUser} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.background },
  containerWeb: { minHeight: '100%', overflow: 'visible' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 10,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 30,
  },
  hero: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.xl,
    borderWidth: 1,
    padding: 18,
    ...adminShadow,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    marginBottom: 12,
    width: 54,
  },
  heroKicker: { color: adminTheme.colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: adminTheme.colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  heroText: { color: adminTheme.colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  panel: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
    ...adminShadow,
  },
  label: { color: adminTheme.colors.text, fontSize: 13, fontWeight: '900', marginBottom: 7, marginTop: 12 },
  input: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    color: adminTheme.colors.text,
    fontSize: 14,
    minHeight: 46,
    outlineStyle: 'none',
    paddingHorizontal: 12,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.md,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  saveButtonDisabled: { opacity: 0.72 },
  saveButtonText: { color: adminTheme.colors.onPrimary, fontSize: 14, fontWeight: '900' },
  message: { color: adminTheme.colors.primary, fontSize: 12, fontWeight: '800', marginTop: 12 },
  accessText: { color: adminTheme.colors.text, margin: 20 },
});
