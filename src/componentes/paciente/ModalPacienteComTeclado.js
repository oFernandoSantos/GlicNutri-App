import React, {

  createContext,

  forwardRef,

  useCallback,

  useContext,

  useEffect,

  useRef,

} from 'react';

import {

  KeyboardAvoidingView,

  Platform,

  ScrollView,

  StyleSheet,

  View,

} from 'react-native';

import { useKeyboardHeight } from '../comum/RolagemComTeclado';



/** Offset padrão iOS para modais do acesso Paciente. */

export const IOS_MODAL_KEYBOARD_OFFSET = 24;

const FocoModalPacienteContext = createContext(null);



export function getComportamentoTecladoModal({ compact = false } = {}) {
  if (Platform.OS === 'ios') {
    return compact ? 'position' : 'padding';
  }
  return 'height';
}



export function EnvoltorioModalPacienteTeclado({

  children,

  style,

  keyboardVerticalOffset,

  enabled = true,

  /** false = KAV só no card do modal (evita faixa branca no overlay). */

  fullScreen = true,

}) {

  const fillStyle = [
    fullScreen ? styles.fill : styles.wrap,
    styles.transparent,
    style,
  ];



  if (!enabled || Platform.OS === 'web') {

    return <View style={fillStyle}>{children}</View>;

  }



  const offset =

    typeof keyboardVerticalOffset === 'number'

      ? keyboardVerticalOffset

      : Platform.OS === 'ios'

        ? IOS_MODAL_KEYBOARD_OFFSET

        : 0;



  return (

    <KeyboardAvoidingView

      style={fillStyle}

      behavior={getComportamentoTecladoModal({ compact: !fullScreen })}

      keyboardVerticalOffset={offset}

    >

      {children}

    </KeyboardAvoidingView>

  );

}



function getDelayFocoModal(delay) {

  if (typeof delay === 'number') {

    return delay;

  }

  if (Platform.OS === 'ios') {

    return 50;

  }

  if (Platform.OS === 'android') {

    return 30;

  }

  if (Platform.OS === 'web') {

    return 40;

  }

  return 20;

}



function getRetryFocoModal() {

  if (Platform.OS === 'ios') {

    return 70;

  }

  if (Platform.OS === 'android') {

    return 50;

  }

  if (Platform.OS === 'web') {

    return 60;

  }

  return 30;

}



function getFieldLayoutY(layout) {

  if (layout == null) {

    return null;

  }

  if (typeof layout === 'number') {

    return layout;

  }

  return typeof layout.y === 'number' ? layout.y : null;

}



function getBottomMostFieldId(fieldsMap) {

  let bestId = null;

  let bestBottom = -1;



  Object.entries(fieldsMap).forEach(([fieldId, layout]) => {

    const y = getFieldLayoutY(layout);

    if (typeof y !== 'number') {

      return;

    }

    const height = typeof layout?.height === 'number' ? layout.height : 0;

    const bottom = y + height;

    if (bottom > bestBottom) {

      bestBottom = bottom;

      bestId = fieldId;

    }

  });



  return bestId;

}



/**

 * Registra posição dos campos e rola o ScrollView do modal até o campo focado.

 * Usar o mesmo scrollRef passado ao ScrollModalPacienteTeclado.

 */

export function useFocoCampoModalPaciente(scrollRef, { topOffset = 88, delay } = {}) {

  const keyboardHeight = useKeyboardHeight();

  const containerYRef = useRef(0);

  const contentHeightRef = useRef(0);

  const viewportHeightRef = useRef(0);

  const fieldsYRef = useRef({});

  const timerRef = useRef(null);

  const retryTimerRef = useRef(null);



  useEffect(

    () => () => {

      if (timerRef.current) {

        clearTimeout(timerRef.current);

      }

      if (retryTimerRef.current) {

        clearTimeout(retryTimerRef.current);

      }

    },

    []

  );



  const registerScrollViewport = useCallback((event) => {

    viewportHeightRef.current = event?.nativeEvent?.layout?.height || 0;

  }, []);



  const registerScrollContainer = useCallback((event) => {

    const layout = event?.nativeEvent?.layout;

    containerYRef.current = layout?.y || 0;

    contentHeightRef.current = layout?.height || 0;

  }, []);



  const registerFieldLayout = useCallback(

    (fieldId) => (event) => {

      const layout = event?.nativeEvent?.layout;

      fieldsYRef.current[fieldId] = {

        y: layout?.y || 0,

        height: layout?.height || 0,

      };

    },

    []

  );



  const onFieldFocus = useCallback(

    (fieldId, options = {}) => {

      if (timerRef.current) {

        clearTimeout(timerRef.current);

      }

      if (retryTimerRef.current) {

        clearTimeout(retryTimerRef.current);

      }



      const keyboardInset = options.keyboardInset ?? keyboardHeight;

      const wait =

        options.delay ??

        (keyboardInset > 0 ? 160 : getDelayFocoModal(delay));

      const retryWait = getRetryFocoModal();

      const lastFieldId = getBottomMostFieldId(fieldsYRef.current);

      const isLastField =

        options.scrollToEnd === false

          ? false

          : lastFieldId === fieldId || options.scrollToEnd === true;

      const tailGap = options.tailGap ?? 20;



      const runScroll = () => {

        const scrollView = scrollRef?.current;

        if (!scrollView) {

          return;

        }



        const revealActionsId = options.revealActionsFieldId ?? 'therapy-modal-actions';

        if (options.revealActions) {

          const actionsLayout = fieldsYRef.current[revealActionsId];

          const fieldLayout = fieldsYRef.current[fieldId];

          const viewH = viewportHeightRef.current;

          if (scrollView.scrollTo && actionsLayout && fieldLayout && viewH > 0) {

            const inset = options.keyboardInset ?? keyboardHeight;

            const visibleH = inset > 0 ? Math.max(viewH - inset, 80) : viewH;

            const fieldTop = containerYRef.current + getFieldLayoutY(fieldLayout);

            const fieldHeight = fieldLayout.height || 0;

            const actionsBottom =

              containerYRef.current +

              getFieldLayoutY(actionsLayout) +

              (actionsLayout.height || 0);

            const gap = options.actionsGap ?? 16;

            const minScrollForField = fieldTop - (options.topOffset ?? topOffset);

            let targetY = actionsBottom - visibleH + gap;

            targetY = Math.max(targetY, minScrollForField, 0);

            const maxScroll = Math.max(0, contentHeightRef.current - visibleH);

            targetY = Math.min(targetY, maxScroll);

            scrollView.scrollTo({ y: targetY, animated: true });

            return;

          }

        }



        if (isLastField) {

          const contentH = contentHeightRef.current;

          const viewH = viewportHeightRef.current;

          const visibleH =

            viewH > 0 ? Math.max(viewH - keyboardInset, 80) : viewH;

          if (contentH > 0 && visibleH > 0 && scrollView.scrollTo) {

            const targetY = Math.max(0, contentH - visibleH + tailGap);

            scrollView.scrollTo({ y: targetY, animated: true });

            return;

          }

          scrollView.scrollToEnd?.({ animated: true });

          return;

        }



        if (!scrollView.scrollTo) {

          return;

        }



        const fieldY = getFieldLayoutY(fieldsYRef.current[fieldId]);

        if (typeof fieldY !== 'number') {

          return;

        }



        const fieldLayout = fieldsYRef.current[fieldId];

        const fieldHeight =

          typeof fieldLayout?.height === 'number' ? fieldLayout.height : 0;

        const viewH = viewportHeightRef.current;

        const visibleBottom =

          viewH > 0 ? Math.max(viewH - keyboardInset, 80) : viewH;

        const alignTop =

          containerYRef.current + fieldY - (options.topOffset ?? topOffset);

        const alignBottom =

          visibleBottom > 0

            ? containerYRef.current + fieldY + fieldHeight - visibleBottom + (options.bottomGap ?? 20)

            : alignTop;

        const targetY = Math.max(Math.max(alignTop, alignBottom), 0);



        scrollView.scrollTo({ y: targetY, animated: true });

      };



      timerRef.current = setTimeout(() => {

        runScroll();

        retryTimerRef.current = setTimeout(() => {

          runScroll();

          if (options.revealActions) {

            setTimeout(() => runScroll(), 120);

          }

        }, retryWait);

      }, wait);

    },

    [delay, keyboardHeight, scrollRef, topOffset]

  );



  const criarOnFocus = useCallback(

    (fieldId, onFocus) => (event) => {

      onFocus?.(event);

      onFieldFocus(fieldId, {

        topOffset,

        keyboardInset: 0,

        bottomGap: 28,

        delay: keyboardHeight > 0 ? 200 : undefined,

      });

    },

    [keyboardHeight, onFieldFocus, topOffset]

  );



  return {

    registerScrollViewport,

    registerScrollContainer,

    registerFieldLayout,

    onFieldFocus,

    criarOnFocus,

  };

}



/** Padrão do modal bolus: overlay com padding + scroll sem KAV + foco por campo. */

export function usePadraoTecladoModalPaciente(scrollRef, { topOffset = 72 } = {}) {

  const keyboardHeight = useKeyboardHeight();

  const foco = useFocoCampoModalPaciente(scrollRef, { topOffset });

  const focarCampo = useCallback(

    (fieldId, onFocus, focusOptions = {}) => (event) => {

      onFocus?.(event);

      foco.onFieldFocus(fieldId, {

        topOffset,

        keyboardInset: 0,

        bottomGap: 28,

        delay: keyboardHeight > 0 ? 200 : undefined,

        ...focusOptions,

      });

    },

    [foco, keyboardHeight, topOffset]

  );

  return {

    keyboardHeight,

    foco,

    focarCampo,

    estiloOverlayTeclado:

      keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,

    estiloConteudoScrollTeclado:

      keyboardHeight > 0 ? { paddingBottom: 24 } : null,

  };

}



export function useFocoModalPacienteScroll() {

  return useContext(FocoModalPacienteContext);

}



/** onFocus que rola até o campo (dentro de ScrollModalPacienteTeclado com foco=). */

export function useOnFocusCampoModal(fieldId, onFocus) {

  const foco = useFocoModalPacienteScroll();

  return useCallback(

    (event) => {

      onFocus?.(event);

      foco?.onFieldFocus(fieldId);

    },

    [foco, fieldId, onFocus]

  );

}



/** Envolve o campo para medir posição no scroll do modal. */

export function CampoFocoModal({ fieldId, style, children }) {

  const foco = useFocoModalPacienteScroll();

  return (

    <View style={style} onLayout={foco ? foco.registerFieldLayout(fieldId) : undefined}>

      {children}

    </View>

  );

}



export const ScrollModalPacienteTeclado = forwardRef(function ScrollModalPacienteTeclado(

  {

    children,

    style,

    contentContainerStyle,

    keyboardPaddingBase = 48,

    foco: focoProp,

    ...scrollProps

  },

  ref

) {

  const keyboardHeight = useKeyboardHeight();

  const innerRef = useRef(null);

  const scrollRef = ref || innerRef;

  const internalFoco = useFocoCampoModalPaciente(scrollRef);

  const foco = focoProp || internalFoco;



  const paddingExtra = keyboardHeight > 0 ? keyboardPaddingBase : 0;



  return (

    <FocoModalPacienteContext.Provider value={foco}>

      <ScrollView

        ref={scrollRef}

        style={style}

        contentContainerStyle={[

          contentContainerStyle,

          paddingExtra > 0 ? { paddingBottom: paddingExtra } : null,

        ]}

        keyboardShouldPersistTaps={scrollProps.keyboardShouldPersistTaps ?? 'handled'}

        keyboardDismissMode={scrollProps.keyboardDismissMode ?? 'on-drag'}

        nestedScrollEnabled={scrollProps.nestedScrollEnabled ?? true}

        automaticallyAdjustKeyboardInsets={false}

        {...scrollProps}

        onLayout={(event) => {

          foco.registerScrollViewport(event);

          scrollProps.onLayout?.(event);

        }}

      >

        <View collapsable={false} onLayout={foco.registerScrollContainer}>

          {children}

        </View>

      </ScrollView>

    </FocoModalPacienteContext.Provider>

  );

});



/** Rola ao fim do scroll (campos no rodapé sem id dedicado). */

export function useRolagemModalAoFocar(scrollRef) {

  return useCallback(() => {

    scrollRef.current?.scrollToEnd?.({ animated: true });

    if (Platform.OS === 'ios') {

      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 140);

    }

  }, [scrollRef]);

}



const styles = StyleSheet.create({

  fill: {

    flex: 1,

    width: '100%',

  },

  wrap: {

    alignSelf: 'center',

    width: '100%',

  },

  transparent: {
    backgroundColor: 'transparent',
  },
});


