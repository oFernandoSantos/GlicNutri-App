import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarraAbasPaciente, { PATIENT_TAB_BAR_SPACE } from './BarraAbasPaciente';
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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={patientTheme.colors.text} />
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

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
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    paddingHorizontal: patientTheme.spacing.screen,
    paddingTop: 18,
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
  backButton: {
    alignSelf: 'flex-start',
    minWidth: 92,
    height: 40,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    marginLeft: 4,
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  headerText: {
    marginTop: 18,
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
    paddingBottom: PATIENT_TAB_BAR_SPACE + 4,
  },
  webContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
});
