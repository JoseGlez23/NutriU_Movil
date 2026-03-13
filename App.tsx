import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, SafeAreaView } from 'react-native';
import { PointsProvider } from './src/context/PointsContext';
import { ProfileImageProvider } from './src/context/ProfileImageContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NutriologoProvider } from './src/context/NutriologoContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';
import { BackHandler, Alert } from 'react-native';
import { NetworkProvider } from './src/utils/NetworkHandler';
import AppErrorBoundary from './src/components/AppErrorBoundary';

// Pantallas
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PointsScreen from './src/screens/PointsScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import MyDietScreen from './src/screens/MyDietScreen';
import MyRoutinesScreen from './src/screens/MyRoutinesScreen';
import CaloriesScreen from './src/screens/CaloriesScreen';
import FoodTrackingScreen from './src/screens/FoodTrackingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PhotoSelectionScreen from './src/screens/PhotoSelectionScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';

const Stack = createStackNavigator();

// Navigator - recibe el ref y setNavigatorReady como props
const AppNavigator = ({ navigationRef, setNavigatorReady }: { navigationRef: any; setNavigatorReady: (ready: boolean) => void }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={() => {
        console.log('Navigator listo');
        setNavigatorReady(true);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Points" component={PointsScreen} />
            <Stack.Screen name="Schedule" component={ScheduleScreen} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
            <Stack.Screen name="MyDiet" component={MyDietScreen} />
            <Stack.Screen name="MyRoutines" component={MyRoutinesScreen} />
            <Stack.Screen name="Calories" component={CaloriesScreen} />
            <Stack.Screen name="FoodTracking" component={FoodTrackingScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="PhotoSelection" component={PhotoSelectionScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  // Referencia al navigator para deep links
  const navigationRef = useRef<any>(null);
  const [isNavigatorReady, setNavigatorReady] = useState(false);
  const pendingUrlRef = useRef<string | null>(null);
  const isNavigatorReadyRef = useRef(false);

  // Actualizar ref cuando cambie el estado
  useEffect(() => {
    isNavigatorReadyRef.current = isNavigatorReady;
  }, [isNavigatorReady]);

  // Manejo de deep links global
  useEffect(() => {
    const parseRecoveryParams = (url: string) => {
      const parsed = Linking.parse(url);
      const queryParams = (parsed.queryParams ?? {}) as Record<string, string | undefined>;

      let hashParams: Record<string, string> = {};
      const hashIndex = url.indexOf('#');
      if (hashIndex >= 0) {
        hashParams = Object.fromEntries(new URLSearchParams(url.slice(hashIndex + 1)).entries());
      }

      return {
        ...queryParams,
        ...hashParams,
      } as Record<string, string | undefined>;
    };

    const isRecoveryLink = (url: string) => {
      const params = parseRecoveryParams(url);
      const hasCredentials = Boolean(
        params.code ||
          params.token_hash ||
          (params.access_token && params.refresh_token)
      );

      return Boolean(
        url.includes('reset-password') ||
          params.type === 'recovery' ||
          hasCredentials
      );
    };

    const handleUrl = ({ url }: { url: string }) => {
      // Para reset-password, navegar directamente con el URL completo
      if (isRecoveryLink(url)) {

        // Si el navigator no está listo, guardar para después
        if (!isNavigatorReadyRef.current || !navigationRef.current) {
          pendingUrlRef.current = url;
          return;
        }

        navigationRef.current.navigate('ResetPassword', { resetUrl: url });
        return;
      }
    };

    // URL inicial (app abierta desde enlace)
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    // Listener para deep links mientras la app está abierta
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => subscription.remove();
  }, []); // Sin dependencias - solo se ejecuta una vez

  // Cuando el navigator esté listo, procesar URL pendiente
  useEffect(() => {
    if (isNavigatorReady && pendingUrlRef.current && navigationRef.current) {
      const url = pendingUrlRef.current;
      pendingUrlRef.current = null;
      
      if (url) {
        setTimeout(() => {
          navigationRef.current?.navigate('ResetPassword', { resetUrl: url });
        }, 100);
      }
    }
  }, [isNavigatorReady]);

  // Manejo del botón de retroceso
  useEffect(() => {
    const onBackPress = () => {
      Alert.alert(
        'Salir de NutriU',
        '¿Estás seguro de que deseas salir de la aplicación?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', onPress: () => BackHandler.exitApp() },
        ]
      );
      return true; // Prevenir el comportamiento predeterminado
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
      urlScheme="nutriu"
    >
      <NetworkProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <NutriologoProvider>
              <PointsProvider>
                <ProfileImageProvider>
                  <SafeAreaView style={{ flex: 1 }}>
                    <AppNavigator navigationRef={navigationRef} setNavigatorReady={setNavigatorReady} />
                  </SafeAreaView>
                </ProfileImageProvider>
              </PointsProvider>
            </NutriologoProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </NetworkProvider>
    </StripeProvider>
  );
}