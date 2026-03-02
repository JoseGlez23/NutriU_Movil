import React, { useEffect, useRef } from 'react';
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

// Navigator - recibe el ref como prop
const AppNavigator = ({ navigationRef }: { navigationRef: any }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2E8B57" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
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
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  // Referencia al navigator para deep links
  const navigationRef = useRef<any>(null);

  // Manejo de deep links global
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      console.log('Deep link recibido:', url);
      
      // Extraer el token manualmente si es necesario
      let token = null;
      let type = null;
      
      if (url.includes('token=')) {
        const tokenMatch = url.match(/token=([^&]+)/);
        token = tokenMatch ? tokenMatch[1] : null;
      }
      
      if (url.includes('type=')) {
        const typeMatch = url.match(/type=([^&]+)/);
        type = typeMatch ? typeMatch[1] : null;
      }

      // También intentar con Linking.parse
      const parsed = Linking.parse(url);
      console.log('Parsed:', parsed);

      if (parsed.path === 'reset-password' || url.includes('reset-password')) {
        // Esperar un poco a que el navigator esté listo
        setTimeout(() => {
          if (navigationRef.current) {
            navigationRef.current.navigate('ResetPassword', { 
              token: token || parsed.queryParams?.token,
              type: type || parsed.queryParams?.type 
            });
          } else {
            console.warn('Navigation ref no disponible aún');
          }
        }, 500);
      }
    };

    // URL inicial (app abierta desde enlace)
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    // Listener para deep links mientras la app está abierta
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => subscription.remove();
  }, []);

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
      publishableKey="pk_test_51SHfQCEJmmqziTyLShhDhG4ubMVUdUdPoZhxMw0J5kH1mmUSVs88Cp1xrcEFvnXe1JMHni9KJbJutu8IO9GSvzNJ00Ign5TdVx"
      urlScheme="nutriu"
    >
      <NetworkProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <NutriologoProvider>
              <PointsProvider>
                <ProfileImageProvider>
                  <SafeAreaView style={{ flex: 1 }}>
                    <AppNavigator navigationRef={navigationRef} />
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