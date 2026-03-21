import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function SeletorAbas({ onNavigate }) {
  const [abaAtiva, setAbaAtiva] = useState('Login');

  function trocarAba(nome) {
    setAbaAtiva(nome);
    onNavigate(nome); // Chama a função que criamos no App.js
  }

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: '#E0E0E0',
      borderRadius: 25,
      padding: 4,
      width: 333,
      height: 45,
      alignSelf: 'center'
    }}>
      <TouchableOpacity 
        style={{
          flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20,
          backgroundColor: abaAtiva === 'Login' ? '#FFFFFF' : 'transparent'
        }}
        onPress={() => trocarAba('Login')}
      >
        <Text style={{ color: abaAtiva === 'Login' ? '#2c3e50' : '#7f8c8d', fontWeight: '600' }}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={{
          flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20,
          backgroundColor: abaAtiva === 'Cadastro' ? '#FFFFFF' : 'transparent'
        }}
        onPress={() => trocarAba('Cadastro')}
      >
        <Text style={{ color: abaAtiva === 'Cadastro' ? '#2c3e50' : '#7f8c8d', fontWeight: '600' }}>Cadastra-se</Text>
      </TouchableOpacity>
    </View>
  );
}