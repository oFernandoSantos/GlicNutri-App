import React, { useEffect } from 'react';

import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '../../temas/designSystem';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

import { getToastTopAbaixoHeaderLeitor } from './RolagemComTeclado';



const tipoConfig = {

  sucesso: {

    bg: brand.greenSoft,

    border: brand.green,

    icon: 'checkmark-circle',

    iconColor: brand.green,

    iconWrapBg: brand.green,

    titulo: brand.greenDark,

    detalhe: brand.slateMuted,

  },

  erro: {

    bg: '#FFEBEE',

    border: '#e53935',

    icon: 'alert-circle',

    iconColor: '#c62828',

    titulo: '#8b1a1a',

    detalhe: '#6d2a2a',

  },

  aviso: {

    bg: '#FFF8E1',

    border: '#f9a825',

    icon: 'warning',

    iconColor: '#e65100',

    titulo: '#7a4f00',

    detalhe: '#6b5420',

  },

  info: {

    bg: '#E8F4FD',

    border: '#1e88e5',

    icon: 'sparkles',

    iconColor: '#1565c0',

    titulo: '#0d47a1',

    detalhe: '#1a4d7a',

  },

  remocao: {

    bg: '#FFEBEE',

    border: '#e53935',

    icon: 'trash',

    iconColor: '#c62828',

    titulo: '#b71c1c',

    detalhe: '#8e2424',

  },

  processando: {

    bg: '#F0F7FF',

    border: '#5c9ded',

    icon: 'hourglass-outline',

    iconColor: '#1976d2',

    titulo: '#0d47a1',

    detalhe: '#1a4d7a',

  },

};



/**

 * Toast flutuante (overlay). `posicao="top"`: abaixo do CabecalhoLeitor, conteudo rola por tras.

 */

export default function ToastPaciente({

  tipo = 'aviso',

  texto,

  subtexto = '',

  carregando = false,

  onFechar,

  autoOcultarMs = 4000,

  bottomOffset = 0,

  topOffset,

  posicao = 'bottom',

  inline = false,

}) {

  const insets = useSafeAreaInsets();

  const tipoEfetivo = carregando ? 'processando' : tipo;

  const cores = tipoConfig[tipoEfetivo] || tipoConfig.aviso;



  useEffect(() => {

    if (!autoOcultarMs || !texto || !onFechar || carregando) return undefined;

    const timer = setTimeout(onFechar, autoOcultarMs);

    return () => clearTimeout(timer);

  }, [autoOcultarMs, texto, onFechar, carregando]);



  if (!texto) return null;



  const card = (

    <View

      style={[

        styles.card,

        patientShadow.card,

        {

          backgroundColor: cores.bg,

          borderColor: cores.border,

        },

      ]}

    >

      {carregando ? (

        <ActivityIndicator size="small" color={cores.iconColor} />

      ) : (

        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: cores.iconWrapBg || `${cores.iconColor}22`,
            },
          ]}
        >

          <Ionicons
            name={cores.icon}
            size={20}
            color={cores.iconWrapBg ? brand.white : cores.iconColor}
          />

        </View>

      )}

      <View style={styles.textCol}>

        <Text style={[styles.texto, { color: cores.titulo }]} numberOfLines={2}>

          {texto}

        </Text>

        {subtexto ? (

          <Text style={[styles.subtexto, { color: cores.detalhe }]} numberOfLines={2}>

            {subtexto}

          </Text>

        ) : null}

      </View>

      {onFechar && !carregando ? (

        <TouchableOpacity

          onPress={onFechar}

          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}

          accessibilityRole="button"

          accessibilityLabel="Fechar aviso"

        >

          <Ionicons name="close" size={18} color={cores.titulo} />

        </TouchableOpacity>

      ) : null}

    </View>

  );



  if (inline) {

    return (

      <View style={styles.inlineWrap} accessibilityLiveRegion="polite">

        {card}

      </View>

    );

  }



  if (posicao === 'top') {

    const top =

      typeof topOffset === 'number'

        ? topOffset

        : getToastTopAbaixoHeaderLeitor(insets);



    return (

      <View

        style={[styles.hostTop, { top }]}

        pointerEvents="box-none"

        accessibilityLiveRegion="polite"

      >

        {card}

      </View>

    );

  }



  const bottom = Math.max(8, bottomOffset);



  return (

    <View

      style={[

        styles.host,

        { bottom: bottom + (Platform.OS === 'web' ? 0 : insets.bottom * 0.35) },

      ]}

      pointerEvents="box-none"

      accessibilityLiveRegion="polite"

    >

      {card}

    </View>

  );

}



const styles = StyleSheet.create({

  inlineWrap: {

    marginBottom: 10,

  },

  host: {

    position: 'absolute',

    left: 0,

    right: 0,

    zIndex: 50,

    paddingHorizontal: patientTheme.spacing.screen,

  },

  hostTop: {

    position: 'absolute',

    left: 0,

    right: 0,

    zIndex: 120,

    paddingHorizontal: patientTheme.spacing.screen,

    ...(Platform.OS === 'web'

      ? {

          position: 'fixed',

          zIndex: 1200,

        }

      : null),

  },

  iconWrap: {

    width: 34,

    height: 34,

    borderRadius: 17,

    alignItems: 'center',

    justifyContent: 'center',

  },

  textCol: {

    flex: 1,

    gap: 3,

  },

  card: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    paddingVertical: 11,

    paddingHorizontal: 12,

    borderRadius: 14,

    borderWidth: 2,

  },

  texto: {

    fontSize: 13,

    lineHeight: 17,

    fontWeight: '800',

  },

  subtexto: {

    fontSize: 11,

    lineHeight: 15,

    fontWeight: '600',

  },

});


