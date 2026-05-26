import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LIBRE_YELLOW } from '../../temas/coresLibre';

export default function IconeSensorLibre({ size = 30 }) {
  const outer = size;
  const middle = Math.round(size * 0.67);
  const center = Math.round(size * 0.27);

  return (
    <View style={[styles.outer, { width: outer, height: outer, borderRadius: outer / 2 }]}>
      <View
        style={[styles.middle, { width: middle, height: middle, borderRadius: middle / 2 }]}
      >
        <View
          style={[styles.center, { width: center, height: center, borderRadius: center / 4 }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    backgroundColor: LIBRE_YELLOW,
    justifyContent: 'center',
  },
  middle: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  center: {
    backgroundColor: LIBRE_YELLOW,
  },
});
