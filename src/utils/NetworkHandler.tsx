import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NetworkContextType {
  isOffline: boolean;
  notifyOffline: () => void;
  cacheData: (key: string, data: any) => Promise<void>;
  getCachedData: (key: string) => Promise<any>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const previousOfflineRef = useRef<boolean | null>(null);
  const toastTranslateY = useRef(new Animated.Value(-80)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const lastToastAtRef = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = () => {
    const now = Date.now();
    if (now - lastToastAtRef.current < 3000) {
      return;
    }
    lastToastAtRef.current = now;

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    setShowOfflineToast(true);

    Animated.parallel([
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastTranslateY, {
          toValue: -80,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowOfflineToast(false);
        hideTimeoutRef.current = null;
      });
    }, 2200);
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOffline = !(state.isConnected && state.isInternetReachable);
      const wasOffline = previousOfflineRef.current;

      setIsOffline(nowOffline);

      if (nowOffline && wasOffline !== true) {
        showToast();
      }

      previousOfflineRef.current = nowOffline;
    });

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      unsubscribe();
    };
  }, []);

  const cacheData = async (key: string, data: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error al guardar datos en caché:', error);
    }
  };

  const getCachedData = async (key: string) => {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error al recuperar datos del caché:', error);
      return null;
    }
  };

  const notifyOffline = () => {
    showToast();
  };

  return (
    <NetworkContext.Provider value={{ isOffline, notifyOffline, cacheData, getCachedData }}>
      {showOfflineToast && (
        <Animated.View
          style={[
            styles.offlineToast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.offlineText}>No tienes conexión a internet.</Text>
        </Animated.View>
      )}
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork debe usarse dentro de NetworkProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  offlineToast: {
    position: 'absolute',
    top: '50%',
    marginTop: -26,
    left: 16,
    right: 16,
    zIndex: 9999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#1A3026',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});