import { useNutriologo } from '../context/NutriologoContext';
import { Alert } from 'react-native';

export const useNutriologoCheck = () => {
  const { estadoAsignacion, puedeAcceder } = useNutriologo();

  const verificarAcceso = (funcionalidad: string, mensajePersonalizado?: string): boolean => {
    const tieneAcceso = puedeAcceder(funcionalidad);
    
    if (!tieneAcceso) {
      let mensaje = '';
      
      switch (estadoAsignacion) {
        case 'sin_asignar':
          mensaje = mensajePersonalizado || 
            'No puedes acceder a esta funcionalidad porque no tienes un nutriólogo asignado. Por favor, solicita una cita con uno de nuestros nutriólogos.';
          break;
        default:
          mensaje = mensajePersonalizado || 
            'No tienes permiso para acceder a esta funcionalidad.';
      }
      
      Alert.alert(
        'Acceso restringido',
        mensaje,
        [
          { text: 'Entendido', style: 'cancel' },
          ...(estadoAsignacion === 'sin_asignar' ? [{ text: 'Ver nutriólogos', onPress: () => console.log('Navegar a lista de nutriólogos') }] : [])
        ]
      );
    }
    
    return tieneAcceso;
  };

  const getMensajeRestriccion = (funcionalidad: string): string => {
    switch (estadoAsignacion) {
      case 'sin_asignar':
        return `⚠️ No tienes un nutriólogo asignado. Para ${funcionalidad}, primero debes solicitar una cita con un nutriólogo.`;
      case 'asignado':
        return `✅ Tu nutriólogo ha personalizado esta sección para ti.`;
      default:
        return `❌ No puedes acceder a ${funcionalidad} en este momento.`;
    }
  };

  return {
    verificarAcceso,
    getMensajeRestriccion,
    estadoAsignacion
  };
};