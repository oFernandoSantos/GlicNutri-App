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
}) {
  const containerStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  };

  const getButtonStyle = (perfil) => ({
    flex: 1,
    height: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: role === perfil ? '#4fdfa3' : '#d7dde2',
    backgroundColor: role === perfil ? '#4fdfa3' : '#FFFFFF',
    ...(role === perfil ? {} : softGreenBorder),
    alignItems: 'center',
    justifyContent: 'center',
  });

  const getTextStyle = (perfil) => ({
    color: role === perfil ? '#FFFFFF' : '#686d71',
    fontWeight: '700',
    fontSize: 14,
  });

  return (
    <View style={containerStyle}>
      {opcoes.map((perfil) => (
        <TouchableOpacity
          key={perfil}
          style={getButtonStyle(perfil)}
          onPress={() => onChangeRole(perfil)}
        >
          <Text style={getTextStyle(perfil)}>{perfil}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
