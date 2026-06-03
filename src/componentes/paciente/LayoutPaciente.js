import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BarraAbasPaciente, {
  PATIENT_TAB_BAR_HEIGHT,
  PATIENT_TAB_BAR_SPACE,
} from './BarraAbasPaciente';
import { patientTheme } from '../../temas/temaVisualPaciente';
import { isPatientMainTabRoute } from '../../utilitarios/navegacaoAbas';
import {
  WrapperTeclado,
  getKeyboardVerticalOffset,
  useKeyboardBottomInset,
} from '../comum/RolagemComTeclado';
import GuardiaoSessaoPaciente from './GuardiaoSessaoPaciente';
import HostToastPaciente from '../comum/HostToastPaciente';

export default function PatientScreenLayout({
  navigation,
  route,
  usuarioLogado,
  title,
  subtitle,
  children,
  rightAction,
  contentContainerStyle,
  showTabBar,
  scrollEnabled = true,
  footerOverlay,
  footerDocked = false,
  footerDockedHeight = 88,
  topOverlay,
  refreshControl,
  lockFixedContent = false,
  keyboardAware = true,
  backgroundColor,
}) {
  const insets = useSafeAreaInsets();
  const hasFloatingFooterOverlay = Boolean(footerOverlay);
  const shouldShowTabBar =
    typeof showTabBar === 'boolean'
      ? showTabBar
      : isPatientMainTabRoute(route?.name) && !hasFloatingFooterOverlay;
  const showHeader = Boolean(title || subtitle || rightAction);
  const dockedFooterInset = footerDocked ? footerDockedHeight + 20 : 0;
  const tabBarExtra = shouldShowTabBar
    ? PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE + 16 + dockedFooterInset
    : 32;
  const scrollBottomInset =
    footerDocked && shouldShowTabBar
      ? PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE + footerDockedHeight + 28
      : 0;
  const keyboardBottomPadding = useKeyboardBottomInset(tabBarExtra);
  const keyboardOffset = getKeyboardVerticalOffset(insets);

  return (
    <GuardiaoSessaoPaciente navigation={navigation} usuarioLogado={usuarioLogado}>
    <SafeAreaView
      edges={Platform.OS === 'web' ? undefined : []}
      style={[
        styles.container,
        Platform.OS === 'web' && styles.containerWeb,
        backgroundColor ? { backgroundColor } : null,
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={backgroundColor || patientTheme.colors.background}
      />

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
            style={[
              styles.scroll,
              Platform.OS === 'web' && (footerDocked ? styles.webScrollDocked : styles.webScroll),
            ]}
            contentContainerStyle={[
              styles.content,
              shouldShowTabBar && !footerDocked && styles.contentWithTabBar,
              Platform.OS === 'web' && styles.webContent,
              scrollBottomInset ? { paddingBottom: scrollBottomInset } : null,
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

        {topOverlay ? (
          <View
            style={[styles.topOverlay, Platform.OS === 'web' && styles.topOverlayWeb]}
            pointerEvents="box-none"
          >
            {topOverlay}
          </View>
        ) : null}

        {footerOverlay ? (
          <View
            style={[
              styles.footerOverlay,
              footerDocked && styles.footerOverlayDocked,
              Platform.OS === 'web' && styles.footerOverlayWeb,
              footerDocked && Platform.OS === 'web' && styles.footerOverlayDockedWeb,
              shouldShowTabBar &&
                (footerDocked
                  ? styles.footerOverlayWithTabBarDocked
                  : styles.footerOverlayWithTabBar),
              Platform.OS === 'web' &&
                shouldShowTabBar &&
                (footerDocked
                  ? styles.footerOverlayWithTabBarDockedWeb
                  : styles.footerOverlayWithTabBarWeb),
            ]}
            pointerEvents="box-none"
          >
            {footerOverlay}
          </View>
        ) : null}
      </WrapperTeclado>

      {shouldShowTabBar ? (
        <BarraAbasPaciente
          navigation={navigation}
          rotaAtual={route?.name}
          usuarioLogado={usuarioLogado}
        />
      ) : null}

      <HostToastPaciente posicao="top" />
    </SafeAreaView>
    </GuardiaoSessaoPaciente>
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
    paddingTop: 10,
    paddingBottom: 8,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    overflowY: 'visible',
    overflowX: 'hidden',
  },
  webScrollDocked: {
    overflowX: 'hidden',
    overflowY: 'auto',
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
  content: {
    flexGrow: 1,
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 36,
  },
  fixedContent: {
    flex: 1,
    minHeight: 0,
  },
  fixedContentPadding: {
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 36,
  },
  fixedContentLocked: {
    overflow: 'hidden',
  },
  contentWithTabBar: {
    paddingBottom: PATIENT_TAB_BAR_HEIGHT + 32 + PATIENT_TAB_BAR_SPACE,
  },
  webContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  topOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 120,
  },
  topOverlayWeb: {
    position: 'fixed',
    zIndex: 1200,
  },
  footerOverlay: {
    position: 'absolute',
    left: patientTheme.spacing.screen,
    right: patientTheme.spacing.screen,
    bottom: 16,
  },
  footerOverlayWeb: {
    position: 'fixed',
    left: patientTheme.spacing.screen,
    right: patientTheme.spacing.screen,
    bottom: 16,
    zIndex: 900,
  },
  footerOverlayWithTabBar: {
    bottom: PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE + 16,
  },
  footerOverlayWithTabBarWeb: {
    bottom: PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE + 16,
  },
  footerOverlayDocked: {
    backgroundColor: patientTheme.colors.background,
    borderTopColor: patientTheme.colors.border,
    borderTopWidth: 1,
    bottom: 0,
    elevation: 16,
    left: 0,
    paddingBottom: 12,
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 10,
    right: 0,
    shadowColor: '#1d232b',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    zIndex: 960,
  },
  footerOverlayDockedWeb: {
    left: 0,
    right: 0,
    zIndex: 960,
  },
  footerOverlayWithTabBarDocked: {
    bottom: PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE,
  },
  footerOverlayWithTabBarDockedWeb: {
    bottom: PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE,
  },
});
