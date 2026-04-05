import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  ImageBackground,
  Animated,
  Pressable,
  StyleSheet,
} from 'react-native';
import { supabase } from '../services/supabaseConfig';

const CTA_WIDTH = 330;
const CTA_HEIGHT = 60;
const CTA_RADIUS = CTA_HEIGHT / 2;

export default function IntroScreen({ navigation }) {
  const hoverAnim = useRef(new Animated.Value(0)).current;
  const checkedSession = useRef(false);
  const fillWidth = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CTA_WIDTH],
  });
  const iconShift = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.log('Erro ao verificar sessao na Intro:', error.message);
          return;
        }

        if (isMounted && data?.session?.user && !checkedSession.current) {
          checkedSession.current = true;

          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'HomePaciente',
                params: {
                  usuarioLogado: data.session.user,
                  loginSocial: true,
                },
              },
            ],
          });
        }
      } catch (error) {
        console.log('Erro inesperado ao verificar sessao:', error);
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      hoverAnim.setValue(0);
    });

    return unsubscribe;
  }, [navigation, hoverAnim]);

  const animarBotao = (ativo) => {
    Animated.timing(hoverAnim, {
      toValue: ativo ? 1 : 0,
      duration: ativo ? 260 : 180,
      useNativeDriver: false,
    }).start();
  };

  const handleStartPress = () => {
    Animated.timing(hoverAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start(() => {
      navigation.navigate('Login');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={require('../../assets/intro-glicnutri.png')}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Text style={styles.brand}>GlicNutri</Text>

            <View>
              <Text style={styles.title}>
                {'Nutri\u00E7\u00E3o e'}
                {'\n'}
                controle da{'\n'}
                diabetes
              </Text>

              <Text style={styles.subtitle}>
                {
                  'Acompanhe sua alimenta\u00E7\u00E3o, cuide da glicemia e tenha mais sa\u00FAde no dia a dia.'
                }
              </Text>
            </View>

            <View style={styles.sliderWrapper}>
              <Pressable
                style={styles.ctaPressable}
                onHoverIn={() => animarBotao(true)}
                onHoverOut={() => animarBotao(false)}
                onPressIn={() => animarBotao(true)}
                onPress={handleStartPress}
              >
                <View style={styles.sliderTrack}>
                  <Animated.View style={[styles.sliderFill, { width: fillWidth }]}>
                    <View style={styles.sliderContent}>
                      <Text style={styles.sliderTextFilled}>{'Come\u00E7ar'}</Text>
                      
                    </View>
                  </Animated.View>

                  <View pointerEvents="none" style={styles.sliderContent}>
                    <Text style={styles.sliderText}>{'Come\u00E7ar'}</Text>
                    
                  </View>
                </View>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  background: { flex: 1 },
  backgroundImage: { width: '100%', height: '100%' },
  overlay: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(20, 30, 50, 0.45)',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  brand: {
    color: '#5afcb8',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '400',
    lineHeight: 48,
    letterSpacing: 0.3,
    maxWidth: '85%',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    marginTop: 18,
    lineHeight: 24,
    maxWidth: '85%',
  },
  sliderWrapper: {
    alignItems: 'center',
    marginBottom: 10,
  },
  ctaPressable: {
    borderRadius: CTA_RADIUS,
  },
  sliderTrack: {
    width: CTA_WIDTH,
    height: CTA_HEIGHT,
    borderRadius: CTA_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#f4f4f4',
    borderRadius: CTA_RADIUS,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#f4f4f4',
  },
  sliderContent: {
    width: CTA_WIDTH,
    height: CTA_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderText: {
    color: '#696d72',
    fontSize: 18,
    fontWeight: '700',
  },
  sliderTextFilled: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '700',
  },
 
  sliderIconFilled: {
    position: 'absolute',
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  thumbArrowFilled: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: '700',
  },
});
