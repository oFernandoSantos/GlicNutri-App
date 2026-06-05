import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

export default function SeletorPerfil({
  role,
  onChangeRole,
  opcoes = ['Paciente', 'Nutricionista'],
  textStyle,
}) {
  const opcoesNormalizadas = opcoes.map((opcao) =>
    typeof opcao === 'string'
      ? { value: opcao, label: opcao }
      : {
        value: opcao.value,
        label: opcao.label || opcao.value,
        buttonStyle: opcao.buttonStyle,
        labelStyle: opcao.labelStyle,
      }
  );

  const containerStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  };

  const getButtonStyle = (perfilOpcao) => ({
    flex: 1,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: role === perfilOpcao.value ? '#4fdfa3' : '#d7dde2',
    backgroundColor: role === perfilOpcao.value ? '#4fdfa3' : '#FFFFFF',
    ...(role === perfilOpcao.value ? {} : softGreenBorder),
    alignItems: 'center',
    justifyContent: 'center',
    ...(perfilOpcao.buttonStyle || {}),
  });

  const getTextStyle = (perfilOpcao) => ({
    color: role === perfilOpcao.value ? '#FFFFFF' : '#686d71',
    fontWeight: '700',
    fontSize: 14,
    ...(textStyle || {}),
    ...(perfilOpcao.labelStyle || {}),
  });

  return (
    <View style={containerStyle}>
      {opcoesNormalizadas.map((perfil) => (
        <TouchableOpacity
          key={perfil.value}
          style={getButtonStyle(perfil)}
          onPress={() => onChangeRole(perfil.value)}
        >
          <Text numberOfLines={1} style={getTextStyle(perfil)}>{perfil.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
