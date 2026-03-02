import { supabase } from '../lib/supabase';

export const patientPlanService = {
  clearActivePlans: async (id_paciente: number) => {
    if (!id_paciente || Number.isNaN(id_paciente)) {
      return { success: false, error: 'ID de paciente inválido' };
    }

    const { error: dietaError } = await supabase
      .from('dietas')
      .update({ activa: false })
      .eq('id_paciente', id_paciente)
      .eq('activa', true);

    if (dietaError) {
      return {
        success: false,
        error: dietaError.message || 'No se pudo desactivar la dieta activa'
      };
    }

    const { error: rutinaError } = await supabase
      .from('rutinas')
      .update({ activa: false })
      .eq('id_paciente', id_paciente)
      .eq('activa', true);

    if (rutinaError) {
      return {
        success: false,
        error: rutinaError.message || 'No se pudo desactivar la rutina activa'
      };
    }

    return { success: true };
  }
};