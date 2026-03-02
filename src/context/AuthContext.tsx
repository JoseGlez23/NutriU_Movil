import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    // Verificar sesión existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
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

      // Verificar que el usuario sea un paciente
      const { data: pacienteData } = await supabase
        .from('pacientes')
        .select('id_paciente')
        .eq('correo', email.trim().toLowerCase())
        .maybeSingle();

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

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(), 
        {
          redirectTo: 'nutriu://reset-password',
        }
      );

      if (error) {
        console.error('Error de Supabase Auth al resetear password:', error);

        // Manejo específico del rate limit
        if (error.message.includes('rate limit') || error.message.includes('exceeded')) {
          return {
            success: false,
            error: 'Has excedido el límite temporal de solicitudes de recuperación. ' +
                   'Por seguridad, espera entre 30 minutos y 1 hora antes de intentarlo nuevamente.' 
          };
        }

        return { 
          success: false, 
          error: 'Error al enviar enlace de recuperación.' 
        };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error al restablecer contraseña:', error);
      return { 
        success: false, 
        error: 'Error inesperado. Por favor intenta nuevamente.' 
      };
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};