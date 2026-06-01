import React from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BarraAbasMedico, { MEDICO_TAB_BAR_HEIGHT, MEDICO_TAB_BAR_SPACE } from './BarraAbasMedico';
import { medicoTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import { isMedicoMainTabRoute } from '../../utilitarios/navegacaoAbas';
import {
  WrapperTeclado,
  getKeyboardVerticalOffset,
  useKeyboardBottomInset,
} from '../comum/RolagemComTeclado';

export default function LayoutMedico({
  navigation,
  route,
  usuarioLogado,
  title,
  subtitle,
  rightAction,
  children,
  contentContainerStyle,
  showTabBar,
  scrollEnabled = true,
  refreshControl,
  lockFixedContent = false,
  keyboardAware = true,
}) {
  const insets = useSafeAreaInsets();
  const shouldShowTabBar =
    typeof showTabBar === 'boolean' ? showTabBar : isMedicoMainTabRoute(route?.name);
  const showHeader = Boolean(title || subtitle || rightAction);
  const tabBarExtra = shouldShowTabBar ? MEDICO_TAB_BAR_HEIGHT + MEDICO_TAB_BAR_SPACE + 16 : 32;
  const keyboardBottomPadding = useKeyboardBottomInset(tabBarExtra);
  const keyboardOffset = getKeyboardVerticalOffset(insets);

  return (
    <SafeAreaView
      edges={Platform.OS === 'web' ? undefined : []}
      style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.backgroundSoft} />

      <WrapperTeclado
        style={styles.body}
        enabled={keyboardAware && !lockFixedContent}
        keyboardVerticalOffset={keyboardOffset}
      >
        {showHeader ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <View style={styles.rightAction}>{rightAction || null}</View>
          </View>
        ) : null}

        {scrollEnabled ? (
          <ScrollView
            style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
            contentContainerStyle={[
              styles.content,
              shouldShowTabBar && styles.contentWithTabBar,
              Platform.OS === 'web' && styles.webContent,
              keyboardAware && { paddingBottom: keyboardBottomPadding },
              contentContainerStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            nestedScrollEnabled
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.scroll,
              styles.fixedContent,
              styles.fixedContentPadding,
              lockFixedContent && styles.fixedContentLocked,
              shouldShowTabBar && styles.contentWithTabBar,
              keyboardAware && { paddingBottom: keyboardBottomPadding },
              contentContainerStyle,
            ]}
          >
            {children}
          </View>
        )}
      </WrapperTeclado>

      {shouldShowTabBar ? (
        <BarraAbasMedico navigation={navigation} rotaAtual={route?.name} usuarioLogado={usuarioLogado} />
      ) : null}
    </SafeAreaView>
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
  body: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: patientTheme.colors.surfaceBorder,
  },
  headerText: {
    marginRight: 72,
  },
  title: {
    fontSize: 28,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rightAction: {
    position: 'absolute',
    top: 24,
    right: patientTheme.spacing.screen,
    minWidth: 48,
    alignItems: 'flex-end',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    overflowY: 'visible',
    overflowX: 'hidden',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 14,
    paddingBottom: 36,
  },
  fixedContent: {
    flex: 1,
    minHeight: 0,
  },
  fixedContentPadding: {
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 14,
    paddingBottom: 36,
  },
  fixedContentLocked: {
    overflow: 'hidden',
  },
  contentWithTabBar: {
    paddingBottom: MEDICO_TAB_BAR_HEIGHT + 32 + MEDICO_TAB_BAR_SPACE,
  },
  webContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
});
