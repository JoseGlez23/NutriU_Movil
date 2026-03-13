import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import NetInfo from '@react-native-community/netinfo';
import { useNetwork } from '../utils/NetworkHandler';
import { patientPlanService } from '../services/patientPlanService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NUTRIOLOGO_CACHE_TTL = 5 * 60 * 1000;

// Tipos de datos
export interface Nutriologo {
  id_nutriologo: number;
  nombre: string;
  apellido: string;
  correo: string;
  especialidad?: string;
  cedula_profesional?: string;
  foto_perfil?: string;
  descripcion?: string;
  calificacion_promedio?: number;
}

export type EstadoNutriologo = 'sin_asignar' | 'asignado_sin_dieta' | 'asignado_con_dieta';

export interface MensajeEstado {
  titulo: string;
  mensaje: string;
  accion: string;
  icon: string;
  color: string;
  bgColor: string;
}

interface NutriologoContextType {
  nutriologo: Nutriologo | null;
  loading: boolean;
  estadoNutriologo: EstadoNutriologo | null;
  tieneDietaAsignada: boolean;
  solicitarNutriologo: (id_nutriologo: number) => Promise<{ success: boolean; error?: string }>;
  puedeAcceder: (funcionalidad: string) => boolean;
  getMensajeEstado: () => MensajeEstado;
  refreshNutriologo: () => Promise<void>;
}

const NutriologoContext = createContext<NutriologoContextType | undefined>(undefined);

export const useNutriologo = () => {
  const context = useContext(NutriologoContext);
  if (!context) {
    throw new Error('useNutriologo debe usarse dentro de NutriologoProvider');
  }
  return context;
};

interface NutriologoProviderProps {
  children: ReactNode;
}

export const NutriologoProvider: React.FC<NutriologoProviderProps> = ({ children }) => {
  const { user: authUser } = useAuth();
  const { notifyOffline } = useNetwork();
  const [nutriologo, setNutriologo] = useState<Nutriologo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [estadoNutriologo, setEstadoNutriologo] = useState<EstadoNutriologo | null>(null);
  const [tieneDietaAsignada, setTieneDietaAsignada] = useState<boolean>(false);
  const [idPaciente, setIdPaciente] = useState<number | null>(null);

  const getNutriologoCacheKey = (pacienteId: number) => `nutriologo_state_${pacienteId}`;

  const getCachedNutriologoState = async (pacienteId: number) => {
    try {
      const raw = await AsyncStorage.getItem(getNutriologoCacheKey(pacienteId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > NUTRIOLOGO_CACHE_TTL) {
        await AsyncStorage.removeItem(getNutriologoCacheKey(pacienteId));
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  };

  const setCachedNutriologoState = async (pacienteId: number, value: any) => {
    try {
      await AsyncStorage.setItem(
        getNutriologoCacheKey(pacienteId),
        JSON.stringify({ data: value, timestamp: Date.now() }),
      );
    } catch {
      // noop
    }
  };

  // Obtener ID del paciente desde la BD usando el email del auth user
  const obtenerIdPaciente = async (email: string) => {
    try {
      console.log('🔍 Buscando id_paciente para email:', email);
      const { data, error } = await supabase
        .from('pacientes')
        .select('id_paciente')
        .eq('correo', email)
        .single();

      if (error) {
        const netInfo = await NetInfo.fetch();
        const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
        if (!isOnline) {
          notifyOffline();
        }
        return null;
      }

      console.log('✅ id_paciente encontrado:', data?.id_paciente);
      return data?.id_paciente;
    } catch (error) {
      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
      if (!isOnline) {
        notifyOffline();
      }
      return null;
    }
  };

  useEffect(() => {
    const cargarDatos = async () => {
      if (authUser?.email) {
        const id = await obtenerIdPaciente(authUser.email);
        setIdPaciente(id);
      } else {
        setIdPaciente(null);
        setLoading(false);
        setNutriologo(null);
        setEstadoNutriologo(null);
        setTieneDietaAsignada(false);
      }
    };

    cargarDatos();
  }, [authUser]);

  useEffect(() => {
    if (idPaciente) {
      verificarNutriologoAsignado(idPaciente);
    } else {
      setLoading(false);
    }
  }, [idPaciente]);

  const verificarNutriologoAsignado = async (pacienteId: number): Promise<void> => {
    try {
      const cachedState = await getCachedNutriologoState(pacienteId);
      if (cachedState) {
        setNutriologo(cachedState.nutriologo);
        setTieneDietaAsignada(Boolean(cachedState.tieneDietaAsignada));
        setEstadoNutriologo(cachedState.estadoNutriologo);
        setLoading(false);
      } else {
        setLoading(true);
      }
      console.log('🔍 Verificando nutriólogo para paciente ID:', pacienteId);

      // PASO 1: Verificar si tiene nutriólogo asignado (relación activa)
      const { data: relacionData, error: relacionError } = await supabase
        .from('paciente_nutriologo')
        .select(`
          id_nutriologo,
          activo,
          nutriologos (
            id_nutriologo,
            nombre,
            apellido,
            correo,
            especialidad,
            cedula_profesional,
            foto_perfil,
            descripcion,
            calificacion_promedio
          )
        `)
        .eq('id_paciente', pacienteId)
        .eq('activo', true)
        .maybeSingle();

      if (relacionError && relacionError.code !== 'PGRST116') {
        throw relacionError;
      }

      // CASO 1: NO tiene nutriólogo asignado
      if (!relacionData) {
        console.log('🔵 CASO: Sin nutriólogo asignado');
        setNutriologo(null);
        setTieneDietaAsignada(false);
        setEstadoNutriologo('sin_asignar');
        await setCachedNutriologoState(pacienteId, {
          nutriologo: null,
          tieneDietaAsignada: false,
          estadoNutriologo: 'sin_asignar',
        });
        setLoading(false);
        return;
      }

      // SÍ tiene nutriólogo asignado
      console.log('🟢 Tiene nutriólogo asignado');
      const nutriologoInfo = relacionData.nutriologos as any;
      setNutriologo({
        id_nutriologo: nutriologoInfo.id_nutriologo,
        nombre: nutriologoInfo.nombre,
        apellido: nutriologoInfo.apellido,
        correo: nutriologoInfo.correo,
        especialidad: nutriologoInfo.especialidad,
        cedula_profesional: nutriologoInfo.cedula_profesional,
        foto_perfil: nutriologoInfo.foto_perfil,
        descripcion: nutriologoInfo.descripcion,
        calificacion_promedio: nutriologoInfo.calificacion_promedio
      });

      // PASO 2: Verificar si tiene dieta asignada
      const { data: dietaData, error: dietaError } = await supabase
        .from('dietas')
        .select('id_dieta')
        .eq('id_paciente', pacienteId)
        .eq('activa', true)
        .maybeSingle();

      if (dietaError && dietaError.code !== 'PGRST116') {
        const netInfo = await NetInfo.fetch();
        const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
        if (!isOnline) {
          notifyOffline();
        }
      }

      const tieneDieta = !!dietaData;
      setTieneDietaAsignada(tieneDieta);

      // CASO 2: Tiene nutriólogo pero SIN dieta
      if (!tieneDieta) {
        console.log('🟡 CASO: Nutriólogo asignado pero SIN dieta');
        setEstadoNutriologo('asignado_sin_dieta');
      } 
      // CASO 3: Tiene nutriólogo y CON dieta
      else {
        console.log('🟢 CASO: Nutriólogo asignado y CON dieta');
        setEstadoNutriologo('asignado_con_dieta');
      }

      await setCachedNutriologoState(pacienteId, {
        nutriologo: {
          id_nutriologo: nutriologoInfo.id_nutriologo,
          nombre: nutriologoInfo.nombre,
          apellido: nutriologoInfo.apellido,
          correo: nutriologoInfo.correo,
          especialidad: nutriologoInfo.especialidad,
          cedula_profesional: nutriologoInfo.cedula_profesional,
          foto_perfil: nutriologoInfo.foto_perfil,
          descripcion: nutriologoInfo.descripcion,
          calificacion_promedio: nutriologoInfo.calificacion_promedio,
        },
        tieneDietaAsignada: tieneDieta,
        estadoNutriologo: tieneDieta ? 'asignado_con_dieta' : 'asignado_sin_dieta',
      });

    } catch (error) {
      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
      if (!isOnline) {
        notifyOffline();
      }
      setNutriologo(null);
      setTieneDietaAsignada(false);
      setEstadoNutriologo('sin_asignar');
    } finally {
      setLoading(false);
    }
  };

  // Función para solicitar asignación de nutriólogo
  const solicitarNutriologo = async (id_nutriologo: number): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!idPaciente) {
        throw new Error('No se pudo identificar al paciente');
      }

      console.log('📝 Solicitando nutriólogo:', id_nutriologo);

      const { success: plansCleared, error: clearPlansError } = await patientPlanService.clearActivePlans(idPaciente);
      if (!plansCleared) {
        throw new Error(clearPlansError || 'No se pudieron limpiar dieta y rutina activas');
      }

      // Primero, desactivar cualquier relación anterior
      await supabase
        .from('paciente_nutriologo')
        .update({ activo: false })
        .eq('id_paciente', idPaciente);

      // Crear nueva relación ACTIVA
      const { error } = await supabase
        .from('paciente_nutriologo')
        .insert({
          id_paciente: idPaciente,
          id_nutriologo: id_nutriologo,
          fecha_asignacion: new Date().toISOString(),
          activo: true
        });

      if (error) throw error;

      console.log('✅ Nutriólogo asignado correctamente');
      
      // Refrescar el estado
      await verificarNutriologoAsignado(idPaciente);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error al solicitar nutriólogo:', error);
      return { success: false, error: error.message };
    }
  };

  const refreshNutriologo = async () => {
    if (idPaciente) {
      await verificarNutriologoAsignado(idPaciente);
    }
  };

  // Función para verificar si puede acceder a ciertas funcionalidades
  const puedeAcceder = (funcionalidad: string): boolean => {
    if (!estadoNutriologo) return false;

    // Funcionalidades que requieren nutriólogo asignado
    const funcionalidadesRestringidas = [
      'ver_plan_alimenticio',
      'ver_rutina_ejercicios',
      'chatear_con_nutriologo',
      'ver_progreso_detallado',
      'recibir_recomendaciones',
      'ver_dieta_personalizada',
      'ver_ejercicios_asignados',
      'solicitar_asesoria',
      'registrar_alimento'
    ];

    if (funcionalidadesRestringidas.includes(funcionalidad)) {
      return estadoNutriologo === 'asignado_con_dieta';
    }

    return true;
  };

  // Obtener mensaje según el estado
  const getMensajeEstado = (): MensajeEstado => {
    switch (estadoNutriologo) {
      case 'sin_asignar':
        return {
          titulo: '🔵 Sin Nutriólogo Asignado',
          mensaje: 'No tienes un nutriólogo asignado actualmente. Agenda una consulta con uno de nuestros profesionales para obtener un plan personalizado.',
          accion: 'Agendar consulta',
          icon: 'calendar-outline',
          color: '#17A2B8',
          bgColor: '#E3F2FD'
        };
      case 'asignado_sin_dieta':
        return {
          titulo: '🟡 Nutriólogo Asignado - Sin Dieta',
          mensaje: nutriologo 
            ? `Tu nutriólogo ${nutriologo.nombre} ${nutriologo.apellido} aún no ha asignado tu plan alimenticio. Espera a que tu nutriólogo asigne tu dieta personalizada.`
            : 'Tu nutriólogo aún no ha asignado tu plan alimenticio. Espera a que tu nutriólogo asigne tu dieta personalizada.',
          accion: 'Ver perfil del nutriólogo',
          icon: 'time-outline',
          color: '#FFA500',
          bgColor: '#FFF3CD'
        };
      case 'asignado_con_dieta':
        return {
          titulo: '🟢 Plan Alimenticio Asignado',
          mensaje: nutriologo 
            ? `Tu nutriólogo ${nutriologo.nombre} ${nutriologo.apellido} ha preparado un plan personalizado para ti.`
            : 'Tu nutriólogo ha preparado un plan personalizado para ti.',
          accion: 'Ver plan alimenticio',
          icon: 'checkmark-circle-outline',
          color: '#28A745',
          bgColor: '#D4EDDA'
        };
      default:
        return {
          titulo: '⚪ Estado no disponible',
          mensaje: 'No se pudo determinar el estado de tu asignación. Intenta de nuevo más tarde.',
          accion: 'Reintentar',
          icon: 'refresh-outline',
          color: '#6C757D',
          bgColor: '#E2E3E5'
        };
    }
  };

  return (
    <NutriologoContext.Provider value={{
      nutriologo,
      loading,
      estadoNutriologo,
      tieneDietaAsignada,
      solicitarNutriologo,
      puedeAcceder,
      getMensajeEstado,
      refreshNutriologo
    }}>
      {children}
    </NutriologoContext.Provider>
  );
};