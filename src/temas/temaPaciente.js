export const temaPaciente = {
  cores: {
    fundo: '#FFFFFF',
    fundoSecundario: '#FFFFFF',
    fundoCreme: '#FFFFFF',
    superficie: '#F4F4F4',
    superficieSuave: '#FFFFFF',
    superficieVerde: '#F2FFF7',
    primaria: '#37D89C',
    primariaForte: '#23C186',
    primariaClara: '#D9F6E6',
    bordaSuave: '#F4F4F4',
    secundaria: '#B9ECC8',
    terciaria: '#8FE1B7',
    destaque: '#F3EDCD',
    contraste: '#FFFFFF',
    texto: '#1F3A33',
    textoSuave: '#60736B',
    borda: '#DDEAE0',
    alerta: '#F2C86E',
    info: '#89C8F0',
    perigo: '#F1A4A4',
    sombra: 'rgba(79, 223, 163, 0)',
    sombraForte: 'rgba(79, 223, 163, 0)',
    overlay: 'rgba(31, 58, 51, 0.18)',
  },
  raios: {
    md: 18,
    lg: 24,
    xl: 32,
    pill: 999,
  },
  espacos: {
    tela: 20,
    cartao: 18,
    bloco: 14,
  },
};

export const sombraPaciente = {
  elevation: 0,
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  borderWidth: 1.5,
  borderColor: '#F4F4F4',
};

temaPaciente.colors = temaPaciente.cores;
temaPaciente.radius = temaPaciente.raios;
temaPaciente.spacing = temaPaciente.espacos;

export const patientTheme = temaPaciente;
export const patientShadow = sombraPaciente;
