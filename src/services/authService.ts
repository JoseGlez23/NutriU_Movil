import { supabase } from '../lib/supabase';

export const authService = {
  // Verificar si el usuario existe
  checkUserExists: async (email: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('correo', email)
      .single();
    
    return { exists: !!data, error };
  },

  // Obtener rol del usuario
  getUserRole: async (email: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('correo', email)
      .single();
    
    return { role: data?.rol, error };
  },

  // Verificar correo confirmado
  isEmailConfirmed: async (email: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('correo_confirmado')
      .eq('correo', email)
      .single();
    
    return { confirmed: data?.correo_confirmado, error };
  },
};