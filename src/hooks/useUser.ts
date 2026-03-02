// useUser.ts con caché implementado (TTL reducido a 5 segundos para forzar refresco frecuente)
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

// TTL muy agresivo: 5 segundos (5000 ms) - se fuerza refresh frecuente
const CACHE_TTL = 5000;
const OFFLINE_MESSAGE = "No tienes internet. Revisa tu conexión.";

export const useUser = () => {
  const { user: authUser, session } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && authUser) {
      fetchUserData();
    } else {
      setUserData(null);
      setLoading(false);
      setError(null);
    }
  }, [session, authUser]);

  // Función de caché auxiliar con TTL de 5 segundos
  const getCachedData = async (key: string) => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      if (jsonValue == null) return null;

      const parsed = JSON.parse(jsonValue);
      if (Date.now() - parsed.timestamp > CACHE_TTL) {
        console.log(`Caché expirado para ${key} (más de 5 segundos)`);
        await AsyncStorage.removeItem(key);
        return null;
      }

      console.log(`Caché fresco usado para ${key}`);
      return parsed.data;
    } catch (e) {
      console.error("Error al leer caché:", e);
      return null;
    }
  };

  const setCachedData = async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ data: value, timestamp: Date.now() }),
      );
    } catch (e) {
      console.error("Error al guardar caché:", e);
    }
  };

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!authUser?.email) {
        setUserData(null);
        setLoading(false);
        return;
      }

      const email = authUser.email.toLowerCase();
      const cacheKey = `user_${email}`;

      // Intenta cargar desde caché
      let cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        setUserData(cachedData);
      }

      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(
        netInfo.isConnected && netInfo.isInternetReachable !== false,
      );

      if (!isOnline) {
        if (cachedData) {
          setError(OFFLINE_MESSAGE);
          return;
        }

        setError(OFFLINE_MESSAGE);
        setUserData(null);
        return;
      }

      // Obtener datos del paciente
      const { data: paciente, error: pacienteError } = await supabase
        .from("pacientes")
        .select("*")
        .eq("correo", email)
        .single();

      if (pacienteError) {
        setError(OFFLINE_MESSAGE);
        if (!cachedData) {
          setUserData(null);
        }
        return;
      }

      if (!paciente) {
        setError("No se encontró perfil de paciente para este usuario");
        setUserData(null);
        return;
      }

      // Obtener puntos
      const { data: puntos, error: puntosError } = await supabase
        .from("puntos_paciente")
        .select("*")
        .eq("id_paciente", paciente.id_paciente)
        .maybeSingle();

      if (puntosError && puntosError.code !== "PGRST116") {
        console.error("Error al cargar puntos:", puntosError);
      }

      // Formatear los datos
      const formattedData = {
        ...paciente,
        tipo_usuario: "paciente",
        puntos_totales: puntos?.puntos_totales || 0,
        puntos_hoy: puntos?.puntos_hoy || 0,
        nivel: puntos?.nivel || "principiante",
      };

      // Guardar en caché y actualizar estado
      await setCachedData(cacheKey, formattedData);
      setUserData(formattedData);

      console.log(
        "✅ Datos de usuario cargados, id_paciente:",
        paciente.id_paciente,
      );
    } catch (error: any) {
      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(
        netInfo.isConnected && netInfo.isInternetReachable !== false,
      );

      if (!isOnline) {
        setError(OFFLINE_MESSAGE);
      } else {
        setError(OFFLINE_MESSAGE);
      }

      setUserData((prev) => prev ?? null);
    } finally {
      setLoading(false);
    }
  }, [authUser?.email]);

  // Función para refrescar manualmente (fuerza la carga desde BD)
  const refreshUser = useCallback(async () => {
    console.log("🔄 Refrescando datos de usuario manualmente...");
    // Limpiar caché primero
    if (authUser?.email) {
      const cacheKey = `user_${authUser.email.toLowerCase()}`;
      await AsyncStorage.removeItem(cacheKey);
      console.log("🗑️ Caché eliminada para:", authUser.email);
    }
    await fetchUserData();
    console.log(
      "✅ Usuario refrescado, nuevo id_paciente:",
      userData?.id_paciente,
    );
  }, [authUser?.email, fetchUserData]);

  const updateProfile = async (updates: any) => {
    try {
      if (!authUser || !userData) {
        throw new Error("No hay usuario autenticado");
      }

      // Validar altura si se está actualizando
      if (updates.altura !== undefined) {
        const alturaStr = updates.altura.toString();
        if (alturaStr.includes(".")) {
          throw new Error("La altura debe ser ingresada sin punto decimal");
        }

        if (updates.altura < 50 || updates.altura > 250) {
          throw new Error("La altura debe estar entre 50 y 250 centímetros");
        }
      }

      // Validar peso si se está actualizando
      if (
        updates.peso !== undefined &&
        (updates.peso < 20 || updates.peso > 300)
      ) {
        throw new Error("El peso debe estar entre 20 y 300 kilogramos");
      }

      const { error: updateError } = await supabase
        .from("pacientes")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id_paciente", userData.id_paciente);

      if (updateError) throw updateError;

      // Actualizar caché después de actualización
      await refreshUser();
      return { success: true, message: "Perfil actualizado correctamente" };
    } catch (error: any) {
      console.error("Error al actualizar perfil:", error);
      return { success: false, error: error.message };
    }
  };

  const updatePoints = async (puntosAgregados: number) => {
    try {
      if (!userData?.id_paciente) {
        throw new Error("No hay paciente identificado");
      }

      const { data: puntosActuales, error: puntosError } = await supabase
        .from("puntos_paciente")
        .select("*")
        .eq("id_paciente", userData.id_paciente)
        .single();

      if (puntosError) throw puntosError;

      const nuevosPuntosTotales =
        (puntosActuales.puntos_totales || 0) + puntosAgregados;
      const nuevosPuntosHoy =
        (puntosActuales.puntos_hoy || 0) + puntosAgregados;

      let nuevoNivel = "principiante";
      if (nuevosPuntosTotales >= 1000) nuevoNivel = "intermedio";
      if (nuevosPuntosTotales >= 5000) nuevoNivel = "avanzado";
      if (nuevosPuntosTotales >= 10000) nuevoNivel = "experto";

      const { error: updateError } = await supabase
        .from("puntos_paciente")
        .update({
          puntos_totales: nuevosPuntosTotales,
          puntos_hoy: nuevosPuntosHoy,
          nivel: nuevoNivel,
          ultima_actividad: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id_paciente", userData.id_paciente);

      if (updateError) throw updateError;

      await supabase.from("log_puntos").insert({
        id_paciente: userData.id_paciente,
        puntos: puntosAgregados,
        tipo_accion: "registro_alimento",
        descripcion: "Puntos por registrar alimento saludable",
        fecha: new Date().toISOString(),
      });

      // Actualización local
      setUserData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          puntos_totales: nuevosPuntosTotales,
          puntos_hoy: nuevosPuntosHoy,
          nivel: nuevoNivel,
        };
      });

      // Actualizar caché después de actualizar puntos
      const email = authUser?.email?.toLowerCase();
      if (email) {
        const updatedData = {
          ...userData,
          puntos_totales: nuevosPuntosTotales,
          puntos_hoy: nuevosPuntosHoy,
          nivel: nuevoNivel,
        };
        await setCachedData(`user_${email}`, updatedData);
      }

      return { success: true, message: "Puntos actualizados correctamente" };
    } catch (error: any) {
      console.error("Error al actualizar puntos:", error);
      return { success: false, error: error.message };
    }
  };

  // Función rápida para cargar SOLO puntos con caché de 5 segundos
  const fetchUserPointsFast = async () => {
    try {
      if (!authUser?.email) {
        return { puntos_totales: 0, puntos_hoy: 0, nivel: "principiante" };
      }

      const email = authUser.email.toLowerCase();
      const cacheKey = `user_points_${email}`;

      // 1. Intenta cargar desde caché (expira en 5 seg)
      let cachedPoints = await getCachedData(cacheKey);
      if (cachedPoints) {
        console.log("Puntos cargados DESDE CACHÉ (fresco <5 seg)");
        return cachedPoints;
      }

      console.log("Caché de puntos expirado o no existe → fetch fresco");

      // 2. Consulta fresca si no hay caché o expiró
      const { data: paciente, error: err1 } = await supabase
        .from("pacientes")
        .select("id_paciente")
        .eq("correo", email)
        .single();

      if (err1 || !paciente) {
        return { puntos_totales: 0, puntos_hoy: 0, nivel: "principiante" };
      }

      const { data: puntos, error: err2 } = await supabase
        .from("puntos_paciente")
        .select("puntos_totales, puntos_hoy, nivel")
        .eq("id_paciente", paciente.id_paciente)
        .maybeSingle();

      if (err2 && err2.code !== "PGRST116") {
        console.error("Error en fetchUserPointsFast:", err2);
      }

      const result = {
        puntos_totales: puntos?.puntos_totales || 0,
        puntos_hoy: puntos?.puntos_hoy || 0,
        nivel: puntos?.nivel || "principiante",
      };

      // Guardar en caché
      await setCachedData(cacheKey, result);
      return result;
    } catch (err) {
      console.error("Error fetchUserPointsFast:", err);
      return { puntos_totales: 0, puntos_hoy: 0, nivel: "principiante" };
    }
  };

  return {
    user: userData,
    loading,
    error,
    updateProfile,
    updatePoints,
    refreshUserData: fetchUserData,
    refreshUser,
    fetchUserPointsFast,
  };
};
