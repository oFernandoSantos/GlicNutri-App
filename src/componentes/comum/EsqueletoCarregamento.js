import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { patientShadow, patientTheme } from '../../temas/temaVisualPaciente';

const SKELETON_BASE = '#E4E9F0';

function useSkeletonPulse() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

export function EsqueletoBloco({ width = '100%', height = 14, borderRadius = 10, style, pulseOpacity }) {
  const localPulse = useSkeletonPulse();
  const opacity = pulseOpacity || localPulse;

  return (
    <Animated.View
      style={[
        styles.bloco,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function EsqueletoGrupo({ children, style }) {
  const pulseOpacity = useSkeletonPulse();
  return <View style={style}>{typeof children === 'function' ? children(pulseOpacity) : children}</View>;
}

export function EsqueletoLinha({ pulseOpacity, largura = '72%' }) {
  return <EsqueletoBloco pulseOpacity={pulseOpacity} width={largura} height={12} borderRadius={8} />;
}

export function EsqueletoCard({ children, style }) {
  return (
    <EsqueletoGrupo style={[styles.card, style]}>
      {(pulseOpacity) => (typeof children === 'function' ? children(pulseOpacity) : children)}
    </EsqueletoGrupo>
  );
}

export function EsqueletoMetricaGlicose({ width }) {
  return (
    <EsqueletoCard style={[styles.metricSlide, width ? { width } : null]}>
      {(pulseOpacity) => (
        <>
          <View style={styles.metricHeaderRow}>
            <View style={styles.metricHeaderCopy}>
              <EsqueletoBloco pulseOpacity={pulseOpacity} width={120} height={10} />
              <EsqueletoBloco
                pulseOpacity={pulseOpacity}
                width={160}
                height={34}
                borderRadius={12}
                style={styles.metricGap}
              />
            </View>
            <EsqueletoBloco pulseOpacity={pulseOpacity} width={88} height={36} borderRadius={18} />
          </View>
          <EsqueletoBloco pulseOpacity={pulseOpacity} width="90%" height={10} style={styles.metricGap} />
          <EsqueletoBloco pulseOpacity={pulseOpacity} width="100%" height={8} borderRadius={6} />
          <EsqueletoBloco
            pulseOpacity={pulseOpacity}
            width="100%"
            height={72}
            borderRadius={14}
            style={styles.metricGap}
          />
          <View style={styles.metricFooterRow}>
            <EsqueletoBloco pulseOpacity={pulseOpacity} width={100} height={10} />
            <EsqueletoBloco pulseOpacity={pulseOpacity} width={120} height={10} />
          </View>
        </>
      )}
    </EsqueletoCard>
  );
}

export function EsqueletoPlanoPaciente() {
  return (
    <View style={styles.stack}>
      <EsqueletoCard>
        {(pulseOpacity) => (
          <>
            <View style={styles.row}>
              <EsqueletoBloco pulseOpacity={pulseOpacity} width={44} height={44} borderRadius={14} />
              <View style={styles.flex}>
                <EsqueletoBloco pulseOpacity={pulseOpacity} width="70%" height={16} />
                <EsqueletoBloco
                  pulseOpacity={pulseOpacity}
                  width="90%"
                  height={10}
                  style={styles.gapSm}
                />
              </View>
            </View>
            <View style={styles.metricsRow}>
              {[1, 2, 3].map((item) => (
                <EsqueletoBloco
                  key={item}
                  pulseOpacity={pulseOpacity}
                  width="30%"
                  height={64}
                  borderRadius={14}
                />
              ))}
            </View>
          </>
        )}
      </EsqueletoCard>
      <EsqueletoCard>
        {(pulseOpacity) => (
          <>
            <EsqueletoBloco pulseOpacity={pulseOpacity} width="55%" height={14} />
            <EsqueletoBloco
              pulseOpacity={pulseOpacity}
              width="100%"
              height={10}
              style={styles.gapSm}
            />
            <EsqueletoBloco pulseOpacity={pulseOpacity} width="100%" height={8} borderRadius={6} />
            {[1, 2, 3].map((item) => (
              <View key={item} style={[styles.mealRow, styles.gapMd]}>
                <EsqueletoBloco pulseOpacity={pulseOpacity} width={52} height={52} borderRadius={14} />
                <View style={styles.flex}>
                  <EsqueletoBloco pulseOpacity={pulseOpacity} width="60%" height={12} />
                  <EsqueletoBloco
                    pulseOpacity={pulseOpacity}
                    width="85%"
                    height={10}
                    style={styles.gapSm}
                  />
                </View>
              </View>
            ))}
          </>
        )}
      </EsqueletoCard>
    </View>
  );
}

export function EsqueletoPerfilPaciente() {
  return (
    <View style={styles.stack}>
      <EsqueletoCard>
        {(pulseOpacity) => (
          <>
            <View style={styles.row}>
              <EsqueletoBloco pulseOpacity={pulseOpacity} width={72} height={72} borderRadius={36} />
              <View style={styles.flex}>
                <EsqueletoBloco pulseOpacity={pulseOpacity} width="65%" height={18} />
                <EsqueletoBloco
                  pulseOpacity={pulseOpacity}
                  width="80%"
                  height={10}
                  style={styles.gapSm}
                />
                <EsqueletoBloco
                  pulseOpacity={pulseOpacity}
                  width={100}
                  height={22}
                  borderRadius={12}
                  style={styles.gapSm}
                />
              </View>
            </View>
            <View style={styles.metricsRow}>
              {[1, 2, 3].map((item) => (
                <View key={item} style={styles.flex}>
                  <EsqueletoBloco pulseOpacity={pulseOpacity} width="70%" height={18} />
                  <EsqueletoBloco
                    pulseOpacity={pulseOpacity}
                    width="90%"
                    height={10}
                    style={styles.gapSm}
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </EsqueletoCard>
      <EsqueletoCard>
        {(pulseOpacity) => (
          <View style={styles.row}>
            <EsqueletoBloco pulseOpacity={pulseOpacity} width={48} height={48} borderRadius={24} />
            <View style={styles.flex}>
              <EsqueletoBloco pulseOpacity={pulseOpacity} width="55%" height={14} />
              <EsqueletoBloco
                pulseOpacity={pulseOpacity}
                width="75%"
                height={10}
                style={styles.gapSm}
              />
            </View>
            <EsqueletoBloco pulseOpacity={pulseOpacity} width={18} height={18} borderRadius={9} />
          </View>
        )}
      </EsqueletoCard>
      {[1, 2].map((section) => (
        <EsqueletoCard key={section}>
          {(pulseOpacity) => (
            <>
              <EsqueletoBloco pulseOpacity={pulseOpacity} width="50%" height={14} />
              <EsqueletoBloco
                pulseOpacity={pulseOpacity}
                width="100%"
                height={10}
                style={styles.gapSm}
              />
              <EsqueletoBloco pulseOpacity={pulseOpacity} width="88%" height={10} />
            </>
          )}
        </EsqueletoCard>
      ))}
    </View>
  );
}

export function EsqueletoListaRegistros({ linhas = 5 }) {
  return (
    <EsqueletoCard>
      {(pulseOpacity) => (
        <>
          {Array.from({ length: linhas }).map((_, index) => (
            <View
              key={`reg-${index}`}
              style={[styles.registroRow, index > 0 ? styles.gapMd : null]}
            >
              <EsqueletoBloco pulseOpacity={pulseOpacity} width={56} height={40} borderRadius={10} />
              <View style={styles.flex}>
                <EsqueletoBloco pulseOpacity={pulseOpacity} width="45%" height={12} />
                <EsqueletoBloco
                  pulseOpacity={pulseOpacity}
                  width="75%"
                  height={10}
                  style={styles.gapSm}
                />
              </View>
              <EsqueletoBloco pulseOpacity={pulseOpacity} width={48} height={22} borderRadius={11} />
            </View>
          ))}
        </>
      )}
    </EsqueletoCard>
  );
}

export function EsqueletoDiarioRefeicoes({ linhas = 3 }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: linhas }).map((_, index) => (
        <View key={`meal-${index}`} style={styles.mealRow}>
          <EsqueletoBloco width={52} height={52} borderRadius={12} />
          <View style={styles.flex}>
            <EsqueletoBloco width="55%" height={12} />
            <EsqueletoBloco width="80%" height={10} style={styles.gapSm} />
            <EsqueletoBloco width={72} height={20} borderRadius={10} style={styles.gapSm} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    backgroundColor: SKELETON_BASE,
  },
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    padding: 16,
    ...patientShadow,
  },
  stack: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  gapSm: {
    marginTop: 8,
  },
  gapMd: {
    marginTop: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 16,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  registroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricSlide: {
    marginBottom: 4,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  metricHeaderCopy: {
    flex: 1,
  },
  metricGap: {
    marginTop: 12,
  },
  metricFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
