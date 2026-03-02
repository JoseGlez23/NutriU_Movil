import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../styles/colors';
import { supabase } from '../lib/supabase';
import { saveToCache, getFromCache } from '../utils/offlineCache';
import NetInfo from '@react-native-community/netinfo';

export default function NutritionistScreen() {
  const [nutritionData, setNutritionData] = useState([]);

  const fetchNutritionData = async () => {
    try {
      const cachedData = await getFromCache('nutritionData');
      if (cachedData) {
        setNutritionData(cachedData);
      }

      // Verificar conexión a internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return;
      }

      const { data, error } = await supabase
        .from('nutrition')
        .select('*');

      if (error) {
        throw error;
      }

      setNutritionData(data);
      await saveToCache('nutritionData', data);
    } catch (err) {
      console.error('Error fetching nutrition data:', err);
      Alert.alert('Error', 'No se pudieron cargar los datos de nutrición.');
    }
  };

  useEffect(() => {
    fetchNutritionData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Datos de Nutrición</Text>
      {nutritionData.map((item, index) => (
        <Text key={index}>{item.name}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});