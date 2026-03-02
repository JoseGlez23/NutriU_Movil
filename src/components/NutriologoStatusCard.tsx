import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNutriologo } from '../context/NutriologoContext';

interface NutriologoStatusCardProps {
  onActionPress?: () => void;
  variant?: 'compact' | 'full';
}

export const NutriologoStatusCard: React.FC<NutriologoStatusCardProps> = ({ 
  onActionPress,
  variant = 'full' 
}) => {
  const { estadoAsignacion, loading, getMensajeEstado, nutriologo } = useNutriologo();

  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles.loadingText}>Verificando asignación...</Text>
      </View>
    );
  }

  if (!estadoAsignacion) {
    return null;
  }

  const mensaje = getMensajeEstado();

  if (variant === 'compact') {
    return (
      <TouchableOpacity 
        style={[styles.compactCard, { backgroundColor: mensaje.bgColor }]}
        onPress={onActionPress}
      >
        <Ionicons name={mensaje.icon as any} size={24} color={mensaje.color} />
        <View style={styles.compactTextContainer}>
          <Text style={[styles.compactTitle, { color: mensaje.color }]}>
            {mensaje.titulo}
          </Text>
          <Text style={styles.compactMessage} numberOfLines={2}>
            {mensaje.mensaje}
          </Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={20} color={mensaje.color} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: mensaje.bgColor, borderColor: mensaje.color }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: mensaje.color }]}>
          <Ionicons name={mensaje.icon as any} size={28} color="white" />
        </View>
        <Text style={[styles.title, { color: mensaje.color }]}>{mensaje.titulo}</Text>
      </View>
      
      <Text style={styles.message}>{mensaje.mensaje}</Text>
      
      {estadoAsignacion === 'asignado' && nutriologo && (
        <View style={styles.nutriologoInfo}>
          <Text style={styles.nutriologoLabel}>Tu nutriólogo:</Text>
          <Text style={styles.nutriologoName}>
            {nutriologo.nombre} {nutriologo.apellido}
          </Text>
          {nutriologo.especialidad && (
            <Text style={styles.nutriologoSpecialty}>{nutriologo.especialidad}</Text>
          )}
        </View>
      )}
      
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: mensaje.color }]}
        onPress={onActionPress}
      >
        <Text style={styles.actionButtonText}>{mensaje.accion}</Text>
        <Ionicons name="arrow-forward-outline" size={18} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingCard: {
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 20,
  },
  nutriologoInfo: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  nutriologoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  nutriologoName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  nutriologoSpecialty: {
    fontSize: 13,
    color: '#2E8B57',
    marginTop: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  // Estilos para versión compacta
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  compactTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  compactMessage: {
    fontSize: 12,
    color: '#666',
  },
});