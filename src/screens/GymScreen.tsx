import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { colors } from '../styles/colors';
import { supabase } from '../lib/supabase';
import { saveToCache, getFromCache } from '../utils/offlineCache';
import NetInfo from '@react-native-community/netinfo';

export default function GymScreen() {
  const [gymData, setGymData] = useState([]);

  const fetchGymData = async () => {
    try {
      const cachedData = await getFromCache('gymData');
      if (cachedData) {
        setGymData(cachedData);
      }

      // Verificar conexión a internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        return;
      }

      const { data, error } = await supabase
        .from('gym_routines')
        .select('*');

      if (error) {
        throw error;
      }

      setGymData(data);
      await saveToCache('gymData', data);
    } catch (err) {
      console.error('Error fetching gym data:', err);
      Alert.alert('Error', 'No se pudieron cargar los datos del gimnasio.');
    }
  };

  useEffect(() => {
    fetchGymData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rutina de Gimnasio</Text>
      {gymData.map((item, index) => (
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