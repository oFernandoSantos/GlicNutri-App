import React from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BarraAbasNutricionista, {
  NUTRI_TAB_BAR_HEIGHT,
  NUTRI_TAB_BAR_SPACE,
} from './BarraAbasNutricionista';
import { nutriTheme as patientTheme } from '../../temas/temaVisualNutricionista';
import { isNutriMainTabRoute } from '../../utilitarios/navegacaoAbas';
import {
  WrapperTeclado,
  getKeyboardVerticalOffset,
  useKeyboardBottomInset,
} from '../comum/RolagemComTeclado';

export default function LayoutNutricionista({
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
    typeof showTabBar === 'boolean' ? showTabBar : isNutriMainTabRoute(route?.name);
  const showHeader = Boolean(title || subtitle || rightAction);
  const tabBarExtra = shouldShowTabBar ? NUTRI_TAB_BAR_HEIGHT + NUTRI_TAB_BAR_SPACE + 16 : 32;
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
        <BarraAbasNutricionista
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
    paddingTop: patientTheme.spacing.lg,
    paddingBottom: patientTheme.spacing.md,
    backgroundColor: patientTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: patientTheme.colors.border,
  },
  headerText: {
    marginRight: 72,
  },
  title: {
    fontSize: 22,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: patientTheme.spacing.xs,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
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
    paddingBottom: NUTRI_TAB_BAR_HEIGHT + 32 + NUTRI_TAB_BAR_SPACE,
  },
  webContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
});

