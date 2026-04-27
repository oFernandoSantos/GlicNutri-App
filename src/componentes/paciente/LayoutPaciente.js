import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BarraAbasPaciente, {
  PATIENT_TAB_BAR_HEIGHT,
  PATIENT_TAB_BAR_SPACE,
} from './BarraAbasPaciente';
import { patientTheme } from '../../temas/temaVisualPaciente';

export default function PatientScreenLayout({
  navigation,
  route,
  usuarioLogado,
  title,
  subtitle,
  children,
  rightAction,
  contentContainerStyle,
  showTabBar = route?.name === 'HomePaciente',
  scrollEnabled = true,
  footerOverlay,
}) {
  const showHeader = Boolean(title || subtitle || rightAction);

  return (
    <SafeAreaView
      edges={Platform.OS === 'web' ? undefined : []}
      style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      <View style={styles.body}>
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
              showTabBar && styles.contentWithTabBar,
              Platform.OS === 'web' && styles.webContent,
              contentContainerStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.scroll,
              styles.content,
              styles.fixedContent,
              showTabBar && styles.contentWithTabBar,
              contentContainerStyle,
            ]}
          >
            {children}
          </View>
        )}

        {footerOverlay ? (
          <View
            style={[
              styles.footerOverlay,
              Platform.OS === 'web' && styles.footerOverlayWeb,
              showTabBar && styles.footerOverlayWithTabBar,
              Platform.OS === 'web' && showTabBar && styles.footerOverlayWithTabBarWeb,
            ]}
            pointerEvents="box-none"
          >
            {footerOverlay}
          </View>
        ) : null}
      </View>

      {showTabBar ? (
        <BarraAbasPaciente
          navigation={navigation}
          rotaAtual={route?.name}
          usuarioLogado={usuarioLogado}
        />
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
    flexGrow: 0,
    minHeight: 0,
  },
  contentWithTabBar: {
    paddingBottom: PATIENT_TAB_BAR_HEIGHT + 32 + PATIENT_TAB_BAR_SPACE,
  },
  webContent: {
    flexGrow: 1,
    minHeight: '100%',
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
