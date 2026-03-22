import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
// ...existing code...

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (userData: {
    nombre: string;
    apellido: string;
    username: string;
    email: string;
    celular: string;
    password: string;
    peso?: number;
    altura?: number;
    objetivo?: string;
    fecha_nacimiento: string;
    genero: string;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyPasswordResetOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  completePasswordReset: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  abortPasswordResetFlow: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isPasswordRecoveryFlowRef = useRef(false);

  const syncPatientEmailWithAuth = async (authUser: User) => {
    const normalizedEmail = authUser.email?.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      const { data: paciente, error: pacienteError } = await supabase
        .from('pacientes')
        .select('id_paciente, correo')
        .eq('id_auth_user', authUser.id)
        .maybeSingle();

      if (pacienteError || !paciente?.id_paciente) return;

      const currentEmail = String(paciente.correo || '').trim().toLowerCase();
      if (currentEmail === normalizedEmail) return;

      await supabase
        .from('pacientes')
        .update({ correo: normalizedEmail })
        .eq('id_paciente', paciente.id_paciente);
    } catch (error) {
      console.warn('[AUTH] No se pudo sincronizar correo en pacientes:', error);
    }
  };

  useEffect(() => {
    // Verificar sesión existente
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (isPasswordRecoveryFlowRef.current && session) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      setLoading(false);

      if (session?.user) {
        void syncPatientEmailWithAuth(session.user);
      }
    });

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isPasswordRecoveryFlowRef.current && session) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      setLoading(false);

      if (session?.user) {
        void syncPatientEmailWithAuth(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ...existing code...

  const signIn = async (email: string, password: string) => {
    try {
      // Si el usuario decide volver a iniciar sesión manualmente,
      // cerramos cualquier estado previo de recuperación.
      isPasswordRecoveryFlowRef.current = false;

      if (!email.trim() || !password.trim()) {
        return { 
          success: false, 
          error: 'Por favor, ingresa tu correo y contraseña.' 
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        let errorMessage = 'Error al iniciar sesión';
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Correo o contraseña incorrectos.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Por favor verifica tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Correo electrónico inválido.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Error de conexión. Verifica tu internet.';
        } else {
          errorMessage = error.message;
        }
        
        return { success: false, error: errorMessage };
      }

      // Verificar que el usuario sea un paciente usando id_auth_user (mas robusto que correo)
      const { data: pacienteData, error: pacienteError } = await supabase
        .from('pacientes')
        .select('id_paciente')
        .eq('id_auth_user', data.user.id)
        .maybeSingle();

      if (pacienteError) {
        console.error('[AUTH] Error validando perfil de paciente:', pacienteError);
        return {
          success: false,
          error: 'No se pudo validar tu perfil en este momento. Verifica tu conexion e intenta de nuevo.'
        };
      }

      if (!pacienteData) {
        // Si no es paciente, cerrar sesión y mostrar error
        await supabase.auth.signOut();
        return { 
          success: false, 
          error: 'Esta aplicación es solo para pacientes. Los nutriólogos y administradores deben usar la versión web.' 
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      return { 
        success: false, 
        error: 'Error inesperado. Por favor intenta nuevamente.' 
      };
    }
  };

  const signUp = async (userData: {
    nombre: string;
    apellido: string;
    username: string;
    email: string;
    celular: string;
    password: string;
    peso?: number;
    altura?: number;
    objetivo?: string;
    fecha_nacimiento: string;
    genero: string;
  }) => {
    try {
      // Validar altura sin punto decimal
      if (userData.altura) {
        const alturaStr = userData.altura.toString();
        if (alturaStr.includes('.')) {
          return { 
            success: false, 
            error: 'La altura debe ser ingresada sin punto decimal. Ejemplo: 170 en lugar de 1.70' 
          };
        }
        
        // Validar rango de altura (50-250 cm)
        if (userData.altura < 50 || userData.altura > 250) {
          return { 
            success: false, 
            error: 'La altura debe estar entre 50 y 250 centímetros.' 
          };
        }
      }

      // Validar peso
      if (userData.peso && (userData.peso < 20 || userData.peso > 300)) {
        return { 
          success: false, 
          error: 'El peso debe estar entre 20 y 300 kilogramos.' 
        };
      }

      // PRIMERO: Verificar si el correo ya existe en pacientes
      const { data: pacienteExistente } = await supabase
        .from('pacientes')
        .select('id_paciente')
        .eq('correo', userData.email.trim().toLowerCase())
        .maybeSingle();

      if (pacienteExistente) {
        return { 
          success: false, 
          error: 'Este correo ya está registrado como paciente.' 
        };
      }

      // Verificar si el nombre de usuario ya existe
      const { data: usernameExistente } = await supabase
        .from('pacientes')
        .select('id_paciente')
        .eq('nombre_usuario', userData.username.trim())
        .maybeSingle();

      if (usernameExistente) {
        return { 
          success: false, 
          error: 'Este nombre de usuario ya está en uso.' 
        };
      }

      // 1. Registrar en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        options: {
          data: {
            nombre: userData.nombre.trim(),
            apellido: userData.apellido.trim(),
            username: userData.username.trim(),
            celular: userData.celular.trim(),
          },
          emailRedirectTo: 'nutriu://login-callback',
        },
      });

      if (authError) {
        let errorMessage = 'Error al crear cuenta de autenticación';
        
        if (authError.message.includes('already registered')) {
          errorMessage = 'Este correo ya tiene una cuenta de autenticación. Intenta iniciar sesión.';
        } else if (authError.message.includes('Invalid email')) {
          errorMessage = 'Correo electrónico inválido.';
        } else if (authError.message.includes('Password')) {
          errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
        } else {
          errorMessage = authError.message;
        }
        
        return { success: false, error: errorMessage };
      }

      if (!authData.user) {
        return { 
          success: false, 
          error: 'No se pudo crear el usuario en el sistema de autenticación.' 
        };
      }

      // 2. Insertar en tabla PACIENTES
      const pacienteData: any = {
        id_auth_user: authData.user.id,
        nombre: userData.nombre.trim(),
        apellido: userData.apellido.trim(),
        nombre_usuario: userData.username.trim(),
        correo: userData.email.trim().toLowerCase(),
        numero_celular: userData.celular.trim(),
        foto_perfil: 'usu.webp',
        fecha_nacimiento: userData.fecha_nacimiento,
        genero: userData.genero,
        nivel_actividad: 'moderado', // Valor por defecto
      };

      // Agregar campos opcionales
      if (userData.peso) pacienteData.peso = userData.peso;
      if (userData.altura) pacienteData.altura = userData.altura;
      if (userData.objetivo) pacienteData.objetivo = userData.objetivo;

      const { data: pacienteResult, error: dbError } = await supabase
        .from('pacientes')
        .insert(pacienteData)
        .select('id_paciente')
        .single();

      if (dbError) {
        console.error('Error al insertar paciente en la BD:', dbError);
        
        // Intentar eliminar el usuario de Auth si falla la inserción
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error('Error al eliminar usuario de Auth:', deleteError);
        }
        
        let errorMessage = 'Error al crear perfil de paciente';
        if (dbError.code === '23505') {
          if (dbError.message.includes('nombre_usuario')) {
            errorMessage = 'Este nombre de usuario ya está en uso.';
          } else if (dbError.message.includes('correo')) {
            errorMessage = 'Este correo ya está registrado.';
          }
        } else if (dbError.message.includes('violates check constraint')) {
          errorMessage = 'Algún dato ingresado no es válido. Por favor revisa los campos.';
        } else if (dbError.message.includes('invalid input syntax')) {
          errorMessage = 'Formato de datos incorrecto. Revisa que todos los campos estén en el formato correcto.';
        }
        
        return { success: false, error: errorMessage };
      }

      // 3. Crear registro en puntos_paciente
      if (pacienteResult) {
        await supabase
          .from('puntos_paciente')
          .insert({
            id_paciente: pacienteResult.id_paciente,
            puntos_totales: 0,
            puntos_hoy: 0,
            nivel: 'principiante',
          });
      }

      // NO intentamos iniciar sesión automáticamente
      return { 
        success: true, 
        message: '¡Cuenta creada exitosamente! Por favor verifica tu correo electrónico para activar tu cuenta. Revisa tu bandeja de entrada y spam.' 
      };

    } catch (error: any) {
      console.error('Error inesperado en el registro:', error);
      return { 
        success: false, 
        error: `Error inesperado: ${error.message || 'Por favor intenta nuevamente.'}` 
      };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      if (!email.trim()) {
        return { 
          success: false, 
          error: 'Por favor ingresa tu correo electrónico.' 
        };
      }

      // Verificar si el correo existe en pacientes
      const { data: paciente } = await supabase
        .from('pacientes')
        .select('id_paciente')
        .eq('correo', email.trim().toLowerCase())
        .maybeSingle();

      if (!paciente) {
        return { 
          success: false, 
          error: 'No se encontró una cuenta de paciente con este correo electrónico.' 
        };
      }

      // Flujo OTP numérico: Supabase envía un código al correo.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        // Manejo específico del rate limit (sin mostrar error técnico al usuario)
        const normalizedError = String(error.message || '').toLowerCase();
        if (
          normalizedError.includes('rate limit') ||
          normalizedError.includes('exceeded') ||
          normalizedError.includes('too many requests') ||
          normalizedError.includes('security purposes')
        ) {
          return {
            success: false,
            error: 'Has excedido el límite temporal de solicitudes de recuperación. ' +
                   'Por seguridad, espera entre 30 minutos y 1 hora antes de intentarlo nuevamente.' 
          };
        }

        return { 
          success: false, 
          error: 'No se pudo enviar el código de verificación. Intenta nuevamente.' 
        };
      }
      
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: 'Error inesperado. Por favor intenta nuevamente.' 
      };
    }
  };

  const verifyPasswordResetOtp = async (email: string, token: string) => {
    try {
      isPasswordRecoveryFlowRef.current = true;

      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedToken = String(token || '').trim();

      if (!normalizedEmail || !normalizedToken) {
        return {
          success: false,
          error: 'Completa correo y código para continuar.',
        };
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'email',
      });

      if (verifyError) {
        const verifyMessage = String(verifyError.message || '').toLowerCase();
        if (
          verifyMessage.includes('expired') ||
          verifyMessage.includes('invalid') ||
          verifyMessage.includes('token')
        ) {
          return {
            success: false,
            error: 'El código es inválido o ya expiró. Solicita uno nuevo.',
          };
        }

        return {
          success: false,
          error: 'No se pudo validar el código de verificación.',
        };
      }

      // Refuerzo: mantener la UI en estado no autenticado durante el flujo de recuperación,
      // aunque Supabase cree internamente una sesión temporal para updateUser(password).
      setSession(null);
      setUser(null);
      setLoading(false);

      return { success: true };
    } catch (_error) {
      isPasswordRecoveryFlowRef.current = false;
      return {
        success: false,
        error: 'Error inesperado al confirmar el código.',
      };
    }
  };

  const completePasswordReset = async (newPassword: string) => {
    try {
      if (!newPassword || newPassword.trim().length < 6) {
        return {
          success: false,
          error: 'La nueva contraseña debe tener al menos 6 caracteres.',
        };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        const updateMessage = String(updateError.message || '').toLowerCase();
        if (updateMessage.includes('different from the old password')) {
          return {
            success: false,
            error: 'La nueva contraseña debe ser diferente a la anterior.',
          };
        }

        return {
          success: false,
          error: 'No se pudo actualizar la contraseña. Intenta nuevamente.',
        };
      }

      // Dejar al usuario en estado limpio para relogin con nuevas credenciales.
      await supabase.auth.signOut();
      isPasswordRecoveryFlowRef.current = false;

      return { success: true };
    } catch (_error) {
      return {
        success: false,
        error: 'Error inesperado al actualizar la contraseña.',
      };
    }
  };

  const abortPasswordResetFlow = async () => {
    try {
      isPasswordRecoveryFlowRef.current = false;
      await supabase.auth.signOut();
    } catch {
      // No bloquear UX por errores de limpieza.
    } finally {
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        verifyPasswordResetOtp,
        completePasswordReset,
        abortPasswordResetFlow,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};