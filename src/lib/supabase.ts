import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Configura tus credenciales de Supabase aquí
const SUPABASE_URL = 'https://hthnkzwjotwqhvjgqhfv.supabase.co'; // Reemplaza con tu URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0aG5rendqb3R3cWh2amdxaGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2ODc0NTAsImV4cCI6MjA4MzI2MzQ1MH0.lksveye2arHlQXyuLdLrZmcbIqmdyUUvVZPl5rW_qUQ'; // Reemplaza con tu anon key

// Adaptador de almacenamiento para Expo
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? AsyncStorage : ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});