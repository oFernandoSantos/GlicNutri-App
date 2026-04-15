import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import BarraAbasPaciente, {
  PATIENT_TAB_BAR_HEIGHT,
  PATIENT_TAB_BAR_SPACE,
} from './BarraAbasPaciente';
import { patientTheme } from '../theme/patientTheme';

export default function PatientScreenLayout({
  navigation,
  route,
  usuarioLogado,
  title,
  subtitle,
  children,
  rightAction,
  contentContainerStyle,
  showTabBar = true,
}) {
  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.rightAction}>{rightAction || null}</View>
        </View>

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
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
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
    height: '100%',
    maxHeight: '100%',
    overflowY: 'auto',
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
  contentWithTabBar: {
    paddingBottom: PATIENT_TAB_BAR_HEIGHT + 32 + PATIENT_TAB_BAR_SPACE,
  },
  webContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
});
