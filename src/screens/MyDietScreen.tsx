import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Paleta Nutri U Coherente
const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#D1E8D5',
  error: '#FF6B6B'
};

export default function MyDietScreen({ navigation }: any) {
  const [diet] = useState({
    title: 'Plan Nutricional Balanceado',
    assignedBy: 'Dr. Miguel Torres',
    assignmentDate: '20 de Noviembre, 2025',
    description: 'Programa alimenticio diseñado para optimizar tu salud y bienestar general mediante nutrientes de alta calidad.',
    meals: {
      desayuno: '2 huevos revueltos + 1 rebanada de pan integral + 1 taza de frutas frescas',
      almuerzo: 'Pechuga de pollo a la plancha (150g) + Ensalada verde mixta + 1/2 taza de arroz integral',
      comida: 'Salmón al horno (200g) + Brócoli al vapor + 1/2 camote asado',
      cena: 'Yogur griego natural + Almendras (20g) + 1 manzana verde',
      snacks: '1 puñado de nueces mixtas o 1 yogurt natural sin azúcar'
    }
  });

  const [showModificationModal, setShowModificationModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('');
  const [modificationReason, setModificationReason] = useState('');
  const [suggestedChange, setSuggestedChange] = useState('');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertType, setAlertType] = useState(''); 

  const handleModificationRequest = (mealType: string) => {
    setSelectedMeal(mealType);
    setModificationReason('');
    setSuggestedChange('');
    setShowModificationModal(true);
  };

  const submitModificationRequest = () => {
    if (!modificationReason.trim() || !suggestedChange.trim()) {
      setAlertType('required');
      setShowAlertModal(true);
      return;
    }
    setShowModificationModal(false);
    setAlertType('success');
    setShowAlertModal(true);
  };

  const getMealDisplayName = (mealType: string) => {
    const names: any = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', comida: 'Comida', cena: 'Cena', snacks: 'Snacks' };
    return names[mealType] || mealType;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER UNIFICADO */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>MI DIETA</Text>
          <View style={styles.underlineSmall} />
        </View>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* RESUMEN DEL PLAN */}
        <View style={styles.heroSection}>
          
          <Text style={styles.mainTitle}>{diet.title}</Text>
          <Text style={styles.assignedBy}>Asignado por {diet.assignedBy}</Text>
        </View>

        <View style={styles.assignmentCard}>
          <Text style={styles.descriptionText}>{diet.description}</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>Válido desde: {diet.assignmentDate}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>DISTRIBUCIÓN DIARIA</Text>
        
        {/* COMIDAS GRID */}
        <View style={styles.mealsGrid}>
          {Object.entries(diet.meals).map(([mealType, mealDescription]) => (
            <View key={mealType} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTime}>{getMealDisplayName(mealType)}</Text>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeText}>
                    {mealType === 'desayuno' ? '08:00 AM' : mealType === 'almuerzo' ? '11:00 AM' : mealType === 'comida' ? '02:00 PM' : 'Tarde/Noche'}
                  </Text>
                </View>
              </View>
              <Text style={styles.mealDescription}>{mealDescription}</Text>
              
              <TouchableOpacity 
                style={styles.modifyButton}
                onPress={() => handleModificationRequest(mealType)}
              >
                <MaterialCommunityIcons name="pencil-outline" size={14} color={COLORS.primary} />
                <Text style={styles.modifyButtonText}>Solicitar cambio</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* MODAL MODIFICACIÓN ESTILO DASHBOARD */}
      <Modal visible={showModificationModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Solicitar Cambio</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>¿Por qué deseas cambiar el {getMealDisplayName(selectedMeal)}?</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. No me gusta este alimento..."
                value={modificationReason}
                onChangeText={setModificationReason}
                multiline
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>¿Qué te gustaría comer en su lugar?</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. Sustituir por avena con leche..."
                value={suggestedChange}
                onChangeText={setSuggestedChange}
                multiline
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModificationModal(false)}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitModificationRequest}>
                <Text style={styles.submitBtnText}>ENVIAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ALERT MODAL (SIN MANZY) */}
      <Modal visible={showAlertModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.alertContent, { borderColor: alertType === 'success' ? COLORS.primary : COLORS.error }]}>
            <Ionicons 
              name={alertType === 'success' ? "checkmark-circle" : "alert-circle"} 
              size={60} 
              color={alertType === 'success' ? COLORS.primary : COLORS.error} 
            />
            <Text style={styles.alertTitle}>{alertType === 'success' ? 'Enviado' : 'Error'}</Text>
            <Text style={styles.alertMessage}>
              {alertType === 'success' 
                ? 'Tu solicitud ha sido enviada. El nutriólogo te responderá pronto.' 
                : 'Debes completar todos los campos del formulario.'}
            </Text>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: alertType === 'success' ? COLORS.primary : COLORS.error }]} 
              onPress={() => setShowAlertModal(false)}
            >
              <Text style={styles.modalButtonText}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.secondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: { padding: 5 },
  brandContainer: { alignItems: 'center' },
  brandName: { fontSize: 18, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  underlineSmall: { width: 20, height: 3, backgroundColor: COLORS.accent, borderRadius: 2, marginTop: 2 },
  placeholder: { width: 40 },

  scrollView: { flex: 1, paddingHorizontal: 20 },
  heroSection: { alignItems: 'center', marginVertical: 25 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  mainTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textDark, marginTop: 15 },
  assignedBy: { fontSize: 13, fontWeight: '700', color: COLORS.primary, opacity: 0.8 },

  assignmentCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 25,
    alignItems: 'center'
  },
  descriptionText: { fontSize: 14, color: COLORS.textLight, lineHeight: 22, textAlign: 'center', fontWeight: '600', fontStyle: 'italic' },
  dateBadge: { backgroundColor: COLORS.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 15 },
  dateText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },

  sectionHeader: { fontSize: 12, fontWeight: '900', color: COLORS.primary, letterSpacing: 2, marginBottom: 15, textAlign: 'center' },
  
  mealsGrid: { gap: 15 },
  mealCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  mealTime: { fontSize: 16, fontWeight: '900', color: COLORS.textDark },
  timeBadge: { backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  timeText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  mealDescription: { fontSize: 14, color: COLORS.textLight, fontWeight: '600', lineHeight: 20, marginBottom: 15 },
  
  modifyButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 10, 
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondary 
  },
  modifyButtonText: { fontSize: 12, fontWeight: '800', color: COLORS.primary, marginLeft: 6 },

  // Modales
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26, 48, 38, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 25, padding: 25, width: '100%', borderWidth: 2, borderColor: COLORS.primary },
  modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.primary, textAlign: 'center', marginBottom: 20 },
  inputContainer: { marginBottom: 15 },
  inputLabel: { fontSize: 13, fontWeight: '800', color: COLORS.textDark, marginBottom: 8 },
  textInput: { backgroundColor: COLORS.secondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border, height: 80, textAlignVertical: 'top', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
  cancelBtnText: { fontWeight: '900', color: COLORS.textLight },
  submitBtn: { flex: 2, backgroundColor: COLORS.primary, padding: 15, borderRadius: 15, alignItems: 'center' },
  submitBtnText: { fontWeight: '900', color: COLORS.white },

  alertContent: { backgroundColor: COLORS.white, borderRadius: 25, padding: 30, width: '90%', alignItems: 'center', borderWidth: 3 },
  alertTitle: { fontSize: 22, fontWeight: '900', marginTop: 15, marginBottom: 10 },
  alertMessage: { textAlign: 'center', fontSize: 14, color: COLORS.textLight, fontWeight: '600', lineHeight: 20, marginBottom: 20 },
  modalButton: { width: '100%', padding: 15, borderRadius: 15, alignItems: 'center' },
  modalButtonText: { color: COLORS.white, fontWeight: '900' },

  spacer: { height: 40 }
});