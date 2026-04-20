import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StatusBar,
  ScrollView,
  ImageBackground,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INTRO_SEEN_STORAGE_KEY } from '../../constantes/chavesArmazenamento';
import { supabase } from '../../servicos/configSupabase';

const CTA_WIDTH = 330;
const CTA_HEIGHT = 56;
const CTA_RADIUS = 20;
const SCREEN_HORIZONTAL_PADDING = 24;

const introBackgrounds = {
  nutritionist:
    'https://images.pexels.com/photos/8844553/pexels-photo-8844553.jpeg?auto=compress&cs=tinysrgb&w=1600',
  foodPlan:
    'https://unsplash.com/photos/iIDY3j_Gnjc/download?force=true',
  wellbeing:
    'https://images.pexels.com/photos/6958605/pexels-photo-6958605.jpeg?auto=compress&cs=tinysrgb&w=1600',
};

const introSlides = [
  {
    backgroundImage: { uri: introBackgrounds.foodPlan },
    toneStyle: 'darkGreen',
    title: 'Nutri\u00E7\u00E3o e\ncontrole da\ndiabetes',
    subtitle:
      'Acompanhe sua alimenta\u00E7\u00E3o, cuide da glicemia e tenha mais sa\u00FAde no dia a dia.',
  },
  {
    variant: 'freestyleLibre',
  },
  {
    backgroundImage: { uri: introBackgrounds.nutritionist },
    title: 'Plano alimentar\nsempre por\nperto',
    subtitle:
      'Veja orienta\u00E7\u00F5es, metas e lembretes em uma experi\u00EAncia simples de acompanhar.',
  },
  {
    backgroundImage: { uri: introBackgrounds.wellbeing },
    title: 'Bem-estar\npara entender\nsua glicose',
    subtitle:
      'Registre sintomas, sono e estresse para acompanhar melhor sua rotina.',
  },
];

export default function TelaIntroducao({ navigation, onIntroFinished }) {
  const checkedSession = useRef(false);
  const carouselRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const slideWidth = Math.max(width, 1);
  const libreCircleSize = Math.min(Math.max(width * 0.48, 160), 300);
  const libreWhiteCircleSize = libreCircleSize * 0.55;
  const libreCenterCircleSize = libreCircleSize * 0.16;
  const [activeSlide, setActiveSlide] = useState(0);
  const isLastSlide = activeSlide === introSlides.length - 1;
  const topActionTextOffset = Math.max(insets.top + 18, 34);
  const contentTopPadding = topActionTextOffset;
  const libreContentTopPadding = Math.max(insets.top + 60, 84);
  const skipTop = topActionTextOffset - 6;
  const controlsBottom = Math.max(insets.bottom + 18, 30);

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

  const handleSlideScrollEnd = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / slideWidth);
    const safeIndex = Math.min(Math.max(nextIndex, 0), introSlides.length - 1);

    setActiveSlide(safeIndex);
  };

  const finishIntro = async () => {
    try {
      await AsyncStorage.setItem(INTRO_SEEN_STORAGE_KEY, 'true');
    } catch (error) {
      console.log('Erro ao salvar status da intro:', error);
    }

    onIntroFinished?.();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const handleStartPress = () => {
    if (!isLastSlide) {
      const nextSlide = Math.min(activeSlide + 1, introSlides.length - 1);

      setActiveSlide(nextSlide);
      carouselRef.current?.scrollTo({
        x: nextSlide * slideWidth,
        animated: true,
      });
      return;
    }

    finishIntro();
  };

  const renderSlide = (slide) => {
    if (slide.variant === 'freestyleLibre') {
      return (
        <View
          key="freestyle-libre"
          style={[styles.slide, styles.libreSlide, { width: slideWidth }]}
        >
          <View style={[styles.libreContent, { paddingTop: libreContentTopPadding }]}>
            <View
              style={[
                styles.libreOuterCircle,
                {
                  width: libreCircleSize,
                  height: libreCircleSize,
                  borderRadius: libreCircleSize / 2,
                },
              ]}
            >
              <View
                style={[
                  styles.libreWhiteCircle,
                  {
                    width: libreWhiteCircleSize,
                    height: libreWhiteCircleSize,
                    borderRadius: libreWhiteCircleSize / 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.libreCenterCircle,
                    {
                      width: libreCenterCircleSize,
                      height: libreCenterCircleSize,
                      borderRadius: libreCenterCircleSize / 2,
                    },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.libreBrandText}>FreeStyle Libre</Text>
          </View>

          <View style={styles.libreInfoArea}>
            <Text style={styles.libreTitleText}>
              {'Voc\u00EA pode\nconectar os\naplicativos'}
            </Text>

            <Text style={styles.libreSubtitleText}>
              {'FreeStyle LibreLink e GlicNutri'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <ImageBackground
        key={slide.title}
        source={slide.backgroundImage}
        style={[styles.slide, { width: slideWidth }]}
        imageStyle={styles.slideImage}
        resizeMode="cover"
      >
        {slide.toneStyle === 'darkGreen' ? (
          <View pointerEvents="none" style={styles.darkGreenTone} />
        ) : null}

        <View style={[styles.content, { paddingTop: contentTopPadding }]}>
          <Text style={styles.brand}>GlicNutri</Text>

          <View style={styles.infoArea}>
            <View style={styles.copyBlock}>
              <Text style={styles.title}>{slide.title}</Text>

              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={activeSlide === 1 ? 'dark-content' : 'light-content'}
      />

      <View style={styles.introFrame}>
        <ScrollView
          ref={carouselRef}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={slideWidth}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleSlideScrollEnd}
          scrollEventThrottle={16}
          style={styles.carousel}
        >
          {introSlides.map(renderSlide)}
        </ScrollView>

        <Pressable
          style={[styles.skipButton, { top: skipTop }]}
          onPress={finishIntro}
        >
          <Text style={styles.skipButtonText}>Pular</Text>
        </Pressable>

        <View style={[styles.controls, { bottom: controlsBottom }]}>
          <View style={styles.dotsRow}>
            {introSlides.map((slide, index) => (
              <View
                key={`dot-${slide.title}`}
                style={[
                  styles.dot,
                  index === activeSlide && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <Pressable
            style={styles.nextButton}
            onPress={handleStartPress}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? 'Come\u00E7ar' : 'Pr\u00F3ximo'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#f4f4f4',
  },
  introFrame: {
    flex: 1,
    minHeight: 0,
  },
  carousel: {
    flex: 1,
    minHeight: 0,
  },
  slide: {
    flex: 1,
  },
  libreSlide: {
    backgroundColor: '#FFE600',
    alignItems: 'center',
  },
  libreContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 84,
  },
  libreOuterCircle: {
    backgroundColor: '#E6CF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libreWhiteCircle: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libreCenterCircle: {
    backgroundColor: '#E6CF00',
  },
  libreInfoArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 130,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 34,
  },
  libreBrandText: {
    color: '#1F2F6B',
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 46,
    letterSpacing: 0,
    textAlign: 'center',
    maxWidth: '92%',
    marginTop: 26,
  },
  libreTitleText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '400',
    lineHeight: 46,
    letterSpacing: 0.3,
    maxWidth: '92%',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  libreSubtitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 18,
    lineHeight: 24,
    maxWidth: '92%',
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  darkGreenTone: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11, 63, 48, 0.35)',
  },
  content: {
    flex: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 30,
    paddingBottom: 130,
    justifyContent: 'space-between',
  },
  brand: {
    color: '#5afcb8',
    fontSize: 20,
    fontWeight: '700',
  },
  infoArea: {
    marginHorizontal: -SCREEN_HORIZONTAL_PADDING,
  },
  copyBlock: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 34,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '400',
    lineHeight: 46,
    letterSpacing: 0.3,
    maxWidth: '92%',
    textShadowColor: 'rgba(0,0,0,0.38)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 18,
    lineHeight: 24,
    maxWidth: '92%',
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  controls: {
    position: 'absolute',
    left: SCREEN_HORIZONTAL_PADDING,
    right: SCREEN_HORIZONTAL_PADDING,
    bottom: 30,
    alignItems: 'center',
  },
  skipButton: {
    position: 'absolute',
    top: 28,
    right: SCREEN_HORIZONTAL_PADDING,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 2,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#5f6b6d',
  },
  nextButton: {
    width: '100%',
    maxWidth: CTA_WIDTH,
    height: CTA_HEIGHT,
    borderRadius: CTA_RADIUS,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  nextButtonText: {
    color: '#5f6b6d',
    fontSize: 18,
    fontWeight: '700',
  },
});
