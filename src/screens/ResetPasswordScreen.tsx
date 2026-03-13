import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';

export default function ResetPasswordScreen({ route }: any) {
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleExitScreen = async () => {
    try {
      if ((navigation as any).canGoBack?.()) {
        (navigation as any).goBack();
        return;
      }

      try {
        (navigation as any).navigate('Login');
      } catch {
        (navigation as any).navigate('Dashboard');
      }
    } catch (err) {
      console.error('No se pudo salir de ResetPassword:', err);
    }
  };

  const parseDeepLinkParams = (url: string) => {
    const parsed = Linking.parse(url);
    const queryParams = (parsed.queryParams ?? {}) as Record<string, string | undefined>;

    let fragmentParams: Record<string, string> = {};
    const hashIndex = url.indexOf('#');
    if (hashIndex >= 0) {
      const hash = url.slice(hashIndex + 1);
      fragmentParams = Object.fromEntries(new URLSearchParams(hash).entries());
    }

    return {
      ...queryParams,
      ...fragmentParams,
    } as Record<string, string | undefined>;
  };

  const isRecoveryLink = (url: string) => {
    const params = parseDeepLinkParams(url);
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

  useEffect(() => {
    // Si llega el URL desde la navegación, procesarlo inmediatamente
    if (route?.params?.resetUrl) {
      handleDeepLink(route.params.resetUrl);
      return;
    }

    // 1. Manejar deep link inicial (cuando abren la app desde el correo)
    Linking.getInitialURL().then(url => {
      if (url && isRecoveryLink(url)) {
        handleDeepLink(url);
      }
    });

    // 2. Escuchar deep links mientras la app está abierta
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isRecoveryLink(url)) {
        handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, [route?.params?.resetUrl]);

  useEffect(() => {
    if (sessionReady) {
      return;
    }

    const timeout = setTimeout(() => {
      if (!sessionReady) {
        setMessage('No se detectó un enlace válido. Te regresamos a inicio de sesión.');
        handleExitScreen();
      }
    }, 12000);

    return () => clearTimeout(timeout);
  }, [sessionReady]);

  const handleDeepLink = async (url: string) => {
    try {
      const params = parseDeepLinkParams(url);
      const type = params.type;
      const code = params.code;
      const tokenHash = params.token_hash;
      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;
      const hasCredentials = Boolean(code || tokenHash || (accessToken && refreshToken));

      if (!hasCredentials) {
        setMessage('Enlace inválido o expirado. Solicita un nuevo restablecimiento.');
        return;
      }

      let recoveryError: any = null;

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        recoveryError = error;
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        });
        recoveryError = error;
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        recoveryError = error;
      } else {
        recoveryError = new Error('Enlace de recuperación incompleto');
      }

      if (recoveryError) {
        console.error('Error al activar sesión de recuperación:', recoveryError);
        setMessage('El enlace ha expirado o es inválido. Solicita uno nuevo.');
        return;
      }

      setSessionReady(true);
      setMessage('¡Enlace válido! Ahora puedes cambiar tu contraseña.');
      Alert.alert('Listo', 'Puedes ingresar tu nueva contraseña ahora.');
    } catch (err: any) {
      console.error('Error al manejar deep link:', err);
      setMessage('Error al procesar el enlace. Intenta de nuevo o solicita otro restablecimiento.');
    }
  };

  const handleReset = async () => {
    if (!sessionReady) {
      Alert.alert('Espera', 'Aún no se ha recuperado la sesión. Asegúrate de abrir el enlace enviado a tu correo.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setMessage('¡Contraseña cambiada exitosamente!');
      Alert.alert('Éxito', 'Tu contraseña ha sido actualizada. Ahora inicia sesión.', [
        {
          text: 'Ir a Login',
          onPress: async () => {
            await supabase.auth.signOut(); // Cierra cualquier sesión parcial
            navigation.navigate('Login' as never);
          },
        },
      ]);
    } catch (err: any) {
      console.error('Error en handleReset:', err);
      const rawMessage = String(err?.message || '');
      const samePasswordError = rawMessage.toLowerCase().includes('different from the old password');

      const friendlyMessage = samePasswordError
        ? 'Tu nueva contraseña debe ser diferente a la anterior.'
        : (rawMessage || 'No se pudo cambiar la contraseña.');

      setMessage('Error: ' + friendlyMessage);
      Alert.alert('Error', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Text style={styles.title}>Restablecer Contraseña</Text>
        <Text style={styles.subtitle}>
          {sessionReady
            ? 'Ingresa tu nueva contraseña'
            : 'Abre el enlace enviado a tu correo para continuar'}
        </Text>

        {sessionReady ? (
          <>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Nueva contraseña"
                placeholderTextColor="#8b8b8b"
                secureTextEntry={!showNewPassword}
                value={password}
                onChangeText={setPassword}
                autoFocus
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(prev => !prev)}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#4a4a4a"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Confirmar contraseña"
                placeholderTextColor="#8b8b8b"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(prev => !prev)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#4a4a4a"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Cambiar Contraseña</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="large" color="#2E8B57" />
            <Text style={styles.waitingText}>
              Esperando enlace de recuperación...
            </Text>
            <Text style={styles.waitingSubtext}>
              Revisa tu correo (incluyendo spam) y abre el enlace enviado.
            </Text>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleExitScreen}>
              <Text style={styles.secondaryButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        )}

        {message ? (
          <Text style={[styles.message, message.startsWith('Error:') ? styles.messageError : styles.messageSuccess]}>
            {message}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', padding: 30 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#2E8B57' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 30, color: '#666' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#1f1f1f',
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#2E8B57',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  message: { marginTop: 20, textAlign: 'center', fontSize: 16 },
  messageSuccess: { color: '#2E8B57' },
  messageError: { color: '#D32F2F' },
  waitingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  waitingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E8B57',
    marginTop: 20,
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  secondaryButton: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2E8B57',
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#2E8B57',
    fontSize: 15,
    fontWeight: '600',
  },
});