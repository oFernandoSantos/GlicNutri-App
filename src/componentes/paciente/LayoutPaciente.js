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
  const tabBarExtra = shouldShowTabBar ? PATIENT_TAB_BAR_HEIGHT + PATIENT_TAB_BAR_SPACE + 16 : 32;
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
              Platform.OS === 'web' && styles.footerOverlayWeb,
              shouldShowTabBar && styles.footerOverlayWithTabBar,
              Platform.OS === 'web' && shouldShowTabBar && styles.footerOverlayWithTabBarWeb,
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
});
