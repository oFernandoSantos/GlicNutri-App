import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

/**
 * Lista de opções (drilldown). No web, Modal sobre Modal funciona; no iOS/Android não.
 * Use embedded=true dentro do modal pai (position relative + overflow hidden).
 */
export default function DrilldownOpcoesPortal({
  visible = false,
  onClose,
  embedded = false,
  embeddedPadding = 16,
  children,
  cardStyle,
}) {
  if (!visible) {
    return null;
  }

  const card = (
    <TouchableWithoutFeedback onPress={() => {}}>
      <View style={[styles.card, cardStyle]}>{children}</View>
    </TouchableWithoutFeedback>
  );

  const body = (
    <View
      style={[
        embedded ? styles.embeddedRoot : styles.modalRoot,
        embedded ? { padding: embeddedPadding } : null,
      ]}
    >
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={[styles.backdrop, embedded && styles.embeddedBackdrop]} />
      </TouchableWithoutFeedback>
      {card}
    </View>
  );

  if (embedded) {
    return body;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    alignItems: 'center',
    backgroundColor: 'rgba(47, 52, 56, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 40,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(47, 52, 56, 0.34)',
  },
  embeddedBackdrop: {
    backgroundColor: 'transparent',
  },
  card: {
    maxWidth: 520,
    width: '100%',
    zIndex: 41,
    elevation: 41,
  },
});
