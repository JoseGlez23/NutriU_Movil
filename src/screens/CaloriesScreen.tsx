import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/colors';

export default function CaloriesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contador de Calorías</Text>
      <View style={styles.messageBox}>
        <Text style={styles.messageText}>
          Aquí podrás registrar tu consumo de calorías
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 30,
  },
  messageBox: {
    backgroundColor: colors.white,
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
});