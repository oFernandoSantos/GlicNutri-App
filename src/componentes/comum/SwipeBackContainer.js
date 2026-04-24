import React, { useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';

const SWIPE_BACK_DISTANCE = 120;
const SWIPE_BACK_VELOCITY = 0.4;
const MAX_VERTICAL_DRIFT = 48;
const HORIZONTAL_DOMINANCE_RATIO = 1.35;
const EDGE_ACTIVATION_WIDTH = 1.5;
const SWIPE_CAPTURE_DISTANCE = 40;

export default function SwipeBackContainer({
  children,
  navigation,
  disabled = false,
}) {
  const triggeredRef = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (disabled) return false;
          if (!navigation?.canGoBack?.()) return false;

          const horizontalDistance = gestureState.dx;
          const verticalDistance = Math.abs(gestureState.dy);
          const startedFromLeftEdge = gestureState.x0 <= EDGE_ACTIVATION_WIDTH;

          return (
            startedFromLeftEdge &&
            horizontalDistance > SWIPE_CAPTURE_DISTANCE &&
            horizontalDistance > verticalDistance * HORIZONTAL_DOMINANCE_RATIO &&
            verticalDistance < MAX_VERTICAL_DRIFT
          );
        },
        onPanResponderGrant: () => {
          triggeredRef.current = false;
        },
        onPanResponderMove: (_event, gestureState) => {
          if (triggeredRef.current) return;
          if (!navigation?.canGoBack?.()) return;

          const horizontalDistance = gestureState.dx;
          const verticalDistance = Math.abs(gestureState.dy);

          if (
            horizontalDistance >= SWIPE_BACK_DISTANCE &&
            horizontalDistance > verticalDistance * HORIZONTAL_DOMINANCE_RATIO
          ) {
            triggeredRef.current = true;
            navigation.goBack();
          }
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (triggeredRef.current) {
            triggeredRef.current = false;
            return;
          }

          if (!navigation?.canGoBack?.()) return;

          const horizontalDistance = gestureState.dx;
          const verticalDistance = Math.abs(gestureState.dy);

          if (
            horizontalDistance >= SWIPE_BACK_DISTANCE &&
            horizontalDistance > verticalDistance * HORIZONTAL_DOMINANCE_RATIO &&
            gestureState.vx > SWIPE_BACK_VELOCITY
          ) {
            navigation.goBack();
          }
        },
        onPanResponderTerminate: () => {
          triggeredRef.current = false;
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [disabled, navigation]
  );

  return (
    <View
      style={styles.container}
      {...(Platform.OS === 'web' ? panResponder.panHandlers : panResponder.panHandlers)}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
});
