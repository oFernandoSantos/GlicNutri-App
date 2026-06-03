import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/** FreeStyle LibreLink - BR (Google Play) */
export const LIBRE_APP_ICON_SOURCE = require('../../../assets/imagens/freestyle-librelink-br-playstore.png');

/** Mesmo slot dos botões com Ionicons (ex.: Histórico de Registros). */
export const LIBRE_BUTTON_ICON_SLOT = 42;
export const LIBRE_APP_ICON_SIZE = 34;

export default function IconeSensorLibre({
  slotSize = LIBRE_BUTTON_ICON_SLOT,
  iconSize = LIBRE_APP_ICON_SIZE,
}) {
  return (
    <View
      style={[
        styles.slot,
        {
          width: slotSize,
          height: slotSize,
        },
      ]}
    >
      <Image
        source={LIBRE_APP_ICON_SOURCE}
        style={{
          width: iconSize,
          height: iconSize,
        }}
        resizeMode="contain"
        accessibilityLabel="FreeStyle Libre"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
