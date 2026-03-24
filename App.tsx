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
import * as Notifications from 'expo-notifications';
import { BackHandler, Alert } from 'react-native';
import { NetworkProvider } from './src/utils/NetworkHandler';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import { supabase } from './src/lib/supabase';

// Pantallas
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PointsScreen from './src/screens/PointsScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import MyRoutinesScreen from './src/screens/MyRoutinesScreen';
import CaloriesScreen from './src/screens/CaloriesScreen';
import FoodTrackingScreen from './src/screens/FoodTrackingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PhotoSelectionScreen from './src/screens/PhotoSelectionScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';

const Stack = createStackNavigator();

const parseAuthParams = (url: string) => {
  const parsed = Linking.parse(url);
  const queryParams = (parsed.queryParams ?? {}) as Record<string, string | undefined>;

  let hashParams: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    hashParams = Object.fromEntries(new URLSearchParams(url.slice(hashIndex + 1)).entries());
  }

  const hostname = String(parsed.hostname || '');
  const pathPart = String(parsed.path || '');
  const fullPath = [hostname, pathPart].filter(Boolean).join('/').toLowerCase();
  return {
    path: fullPath,
    params: {
      ...queryParams,
      ...hashParams,
    } as Record<string, string | undefined>,
  };
};

const getAuthLinkIntent = (url: string) => {
  const { path, params } = parseAuthParams(url);
  const normalizedType = String(params.type || '').toLowerCase();

  if (path.includes('reset-password') || normalizedType === 'recovery') {
    return 'recovery';
  }

  if (
    path.includes('email-change') ||
    normalizedType === 'email_change' ||
    normalizedType === 'email_change_current' ||
    normalizedType === 'email_change_new'
  ) {
    return 'email-change';
  }

  return null;
};

const handleEmailChangeLink = async (url: string) => {
  const { params } = parseAuthParams(url);

  console.log('[EmailChange] params recibidos:', JSON.stringify(params));

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
  } else if (params.token_hash) {
    // Usamos el type real del URL en lugar de hardcodear 'email_change'.
    // Supabase puede enviar email_change, email_change_new o email_change_current
    // según si "Secure email change" está activado.
    const otpType = (params.type ?? 'email_change') as any;
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: otpType,
    });
    if (error) throw error;
  } else if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
  } else {
    // Android elimina el fragmento '#' de las URLs antes de pasarlas a la app,
    // por lo que access_token/refresh_token pueden llegar vacios.
    // Supabase ya verifico el token y actualizo auth.users.email en el servidor,
    // asi que refrescamos la sesion local para recibir el nuevo correo.
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('[EmailChange] No se pudo refrescar la sesion:', refreshError.message);
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;

  const normalizedEmail = user?.email?.trim().toLowerCase();
  if (user?.id && normalizedEmail) {
    await supabase
      .from('pacientes')
      .update({ correo: normalizedEmail })
      .eq('id_auth_user', user.id);
  }
};

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
  const pendingNotificationRef = useRef<Notifications.NotificationResponse | null>(null);
  const isNavigatorReadyRef = useRef(false);

  const persistMealReminderInInbox = async (args: {
    title?: string;
    body?: string;
    data?: Record<string, any>;
    requestId?: string;
  }) => {
    try {
      const data = args.data || {};
      const type = String(data.type || data.subtipo || '').toLowerCase();
      if (type !== 'meal_reminder') return;

      const pacienteId = Number(data.pacienteId || 0);
      if (!pacienteId) return;

      const title = String(args.title || 'Recordatorio de comida').trim();
      const body = String(args.body || 'Es hora de registrar tu alimento.').trim();
      const tipoComida = String(data.tipoComida || '').trim().toLowerCase();
      const diaSemana = Number(data.diaSemana || 0);
      const horario = String(data.horario || '').trim();
      const source = String(data.source || 'runtime').trim().toLowerCase();
      const eventDate = String(data.eventDate || '').trim();
      const timestampDay = String(data.timestamp || '').slice(0, 10);
      const requestId = String(args.requestId || data.notificationId || '').trim();
      const stableDate = eventDate || timestampDay || new Date().toISOString().slice(0, 10);

      const hash = [
        'meal-runtime',
        pacienteId,
        tipoComida,
        diaSemana,
        horario,
        source,
        stableDate,
        requestId,
      ].join('|');

      const { data: existingRows, error: existingError } = await supabase
        .from('notificaciones')
        .select('id_notificacion')
        .eq('id_usuario', pacienteId)
        .eq('tipo_usuario', 'paciente')
        .eq('datos_adicionales->>hash', hash)
        .limit(1);

      if (existingError) {
        console.warn('[PushInbox] No se pudo validar duplicado:', existingError.message);
      }

      if (existingRows && existingRows.length > 0) {
        return;
      }

      const { error: insertError } = await supabase
        .from('notificaciones')
        .insert({
          id_usuario: pacienteId,
          tipo_usuario: 'paciente',
          titulo: title,
          mensaje: body,
          tipo: 'recordatorio',
          leida: false,
          fecha_envio: new Date().toISOString(),
          datos_adicionales: {
            subtipo: 'meal_reminder',
            type: 'meal_reminder',
            tipoComida: data.tipoComida || null,
            diaSemana: data.diaSemana || null,
            destino: 'FoodTracking',
            hash,
          },
        });

      if (insertError) {
        console.warn('[PushInbox] No se pudo guardar recordatorio en bandeja:', insertError.message);
      }
    } catch (error) {
      console.warn('[PushInbox] Error guardando recordatorio de comida:', error);
    }
  };

  const navigateFromPushData = (data: Record<string, any>) => {
    const type = String(data?.type || data?.subtipo || '').toLowerCase();

    const getTargetRoute = () => {
      if (
        type === 'appointment_request' ||
        type === 'appointment_confirmed' ||
        type === 'appointment_completed' ||
        type === 'cita' ||
        type === 'cita_pendiente_pago'
      ) return 'Schedule';
      if (type === 'points_awarded' || type === 'puntos_asignados') return 'Points';
      if (
        type === 'diet_created' ||
        type === 'diet_updated' ||
        type === 'dieta_asignada' ||
        type === 'meal_reminder'
      ) return 'FoodTracking';
      if (type === 'payment' || type === 'pago') return 'Schedule';
      return 'Dashboard';
    };

    const targetRoute = getTargetRoute();
    const availableRoutes: string[] = navigationRef.current?.getRootState?.()?.routeNames ?? [];

    if (availableRoutes.includes(targetRoute)) {
      if (targetRoute === 'Schedule') {
        navigationRef.current?.navigate('Schedule', {
          initialTab: 'pendientes',
          fromPush: true,
        });
        return;
      }
      navigationRef.current?.navigate(targetRoute as never);
      return;
    }

    // Si no existe la ruta (por ejemplo, usuario no autenticado), llevar a Login.
    if (availableRoutes.includes('Login')) {
      navigationRef.current?.navigate('Login');
    }
  };

  const processNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = (response?.notification?.request?.content?.data ?? {}) as Record<string, any>;
    console.log('[PushTap] data recibida:', JSON.stringify(data));

    void persistMealReminderInInbox({
      title: response?.notification?.request?.content?.title,
      body: response?.notification?.request?.content?.body,
      data,
        requestId: response?.notification?.request?.identifier,
    });

    if (!isNavigatorReadyRef.current || !navigationRef.current) {
      pendingNotificationRef.current = response;
      return;
    }

    navigateFromPushData(data);
  };

  const processAuthUrl = async (url: string) => {
    console.log('[DeepLink] URL recibida:', url);
    const intent = getAuthLinkIntent(url);
    console.log('[DeepLink] intent detectado:', intent);
    if (!intent) return;

    if (intent === 'recovery') {
      // Flujo unificado: recuperación por OTP dentro de Login.
      // Ignoramos recovery links para evitar conflictos de sesión temporal/autologin.
      await supabase.auth.signOut();
      Alert.alert(
        'Recuperación por código',
        'Para cambiar tu contraseña, vuelve a Login y usa "¿Olvidaste tu contraseña?" para ingresar el código de verificación.'
      );
      return;
    }

    try {
      await handleEmailChangeLink(url);
      // Cerrar sesión: AuthContext detecta la sesión nula y lleva al usuario al Login automáticamente
      await supabase.auth.signOut();
      Alert.alert(
        '¡Correo actualizado!',
        'Tu correo fue cambiado con éxito. Inicia sesión con tu nuevo correo. Tu contraseña sigue siendo la misma.'
      );
    } catch (error) {
      console.error('Error procesando cambio de correo:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'No se pudo confirmar el correo',
        `${errMsg}\n\nEl enlace puede haber vencido o ya fue usado. Solicita el cambio de nuevo desde tu perfil.`
      );
    }
  };

  // Actualizar ref cuando cambie el estado
  useEffect(() => {
    isNavigatorReadyRef.current = isNavigatorReady;
  }, [isNavigatorReady]);

  // Manejo de deep links global
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const intent = getAuthLinkIntent(url);
      if (!intent) return;

      if (!isNavigatorReadyRef.current || !navigationRef.current) {
        pendingUrlRef.current = url;
        return;
      }

      void processAuthUrl(url);
    };

    // URL inicial (app abierta desde enlace)
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    // Listener para deep links mientras la app está abierta
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => subscription.remove();
  }, []); // Sin dependencias - solo se ejecuta una vez

  // Manejo global de taps en notificaciones push
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = (notification?.request?.content?.data ?? {}) as Record<string, any>;
      void persistMealReminderInInbox({
        title: notification?.request?.content?.title,
        body: notification?.request?.content?.body,
        data,
        requestId: notification?.request?.identifier,
      });
    });

    const handleNotificationTap = (response: Notifications.NotificationResponse) => {
      processNotificationResponse(response);
    };

    // Notificación que abrió la app desde cerrada
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationTap(response);
      }
    });

    // Notificación tocada con app abierta/en background
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationTap);
    return () => {
      subscription.remove();
      receivedSubscription.remove();
    };
  }, []);

  // Cuando el navigator esté listo, procesar URL pendiente
  useEffect(() => {
    if (isNavigatorReady && pendingUrlRef.current && navigationRef.current) {
      const url = pendingUrlRef.current;
      pendingUrlRef.current = null;
      
      if (url) {
        setTimeout(() => {
          void processAuthUrl(url);
        }, 100);
      }
    }

    if (isNavigatorReady && pendingNotificationRef.current && navigationRef.current) {
      const pendingResponse = pendingNotificationRef.current;
      pendingNotificationRef.current = null;
      processNotificationResponse(pendingResponse);
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

  // Log para depuración de la clave de Stripe y la URL del backend
  console.log('🔑 Stripe publishable key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  console.log('🌐 Backend URL:', process.env.EXPO_PUBLIC_BACKEND_URL);

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