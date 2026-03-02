import { supabase } from '../lib/supabase';

export const foodService = {
  // Registrar alimento consumido
  registerFood: async (userId: number, foodData: {
    id_alimento?: number | null;
    alimento_personalizado?: string | null;
    cantidad: number;
    unidad?: string;
    calorias_totales: number;
    fecha: string;
    tipo_comida?: string;
  }) => {
    const { data, error } = await supabase
      .from('registro_alimentos')
      .insert({
        id_paciente: userId,          // ← Corregido: id_paciente (no id_usuario)
        ...foodData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al registrar alimento:', error);
    }

    return { data, error };
  },

  // Obtener historial de alimentos
  getFoodHistory: async (userId: number, startDate?: string, endDate?: string) => {
    let query = supabase
      .from('registro_alimentos')
      .select(`
        *,
        alimentos (*)
      `)
      .eq('id_paciente', userId)      // ← Corregido: id_paciente (no id_usuario)
      .order('fecha', { ascending: false });

    if (startDate && endDate) {
      query = query.gte('fecha', startDate).lte('fecha', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener historial:', error);
    }

    return { data, error };
  },

  // Obtener alimentos disponibles
  getAvailableFoods: async () => {
    const { data, error } = await supabase
      .from('alimentos')
      .select('*')
      .order('nombre');

    if (error) {
      console.error('Error al obtener alimentos:', error);
    }

    return { data, error };
  },
};