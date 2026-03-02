import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUser } from '../hooks/useUser';
import { routineService } from '../services/routineService';
import { Picker } from '@react-native-picker/picker';
import NetInfo from '@react-native-community/netinfo';
import { saveToCache, getFromCache } from '../utils/offlineCache';
import { useNetwork } from '../utils/NetworkHandler';

const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#D1E8D5',
  danger: '#FF6B6B',
  info: '#3498db',
  success: '#27ae60',
  warning: '#f39c12',
};

// OpciOLA SE SUBIO
const SETS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REPS_OPTIONS = [5, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

// Días de la semana con valores numéricos para BD (1=Lunes, 7=Domingo)
const DAYS_OF_WEEK = [
  { id: 'monday', name: 'Lunes', short: 'LUN', value: 1 },
  { id: 'tuesday', name: 'Martes', short: 'MAR', value: 2 },
  { id: 'wednesday', name: 'Miércoles', short: 'MIÉ', value: 3 },
  { id: 'thursday', name: 'Jueves', short: 'JUE', value: 4 },
  { id: 'friday', name: 'Viernes', short: 'VIE', value: 5 },
  { id: 'saturday', name: 'Sábado', short: 'SÁB', value: 6 },
  { id: 'sunday', name: 'Domingo', short: 'DOM', value: 7 },
];

export default function MyRoutinesScreen({ navigation }: any) {
  const { user, loading: userLoading } = useUser();
  const { isOffline, notifyOffline } = useNetwork();
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState('monday');

  const [showSetsPicker, setShowSetsPicker] = useState(false);
  const [showRepsPicker, setShowRepsPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: 12,
    duration: 15,
  });

  // Animaciones para el modal
  const modalAnimation = useRef(new Animated.Value(0)).current;

  // Animaciones de loading
  const spinValue = useRef(new Animated.Value(0)).current;
  const bounceValue = useRef(new Animated.Value(0)).current;
  const weightScale = useRef(new Animated.Value(1)).current;
  const weightOpacity = useRef(new Animated.Value(0.5)).current;
  const loadingTextOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (showSetsPicker || showRepsPicker || showDurationPicker) {
      Animated.spring(modalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      modalAnimation.setValue(0);
    }
  }, [showSetsPicker, showRepsPicker, showDurationPicker]);

  const loadRoutine = async () => {
    console.log('[loadRoutine] user actual:', user);

    if (!user) {
      console.log('[loadRoutine] No hay user aún → esperando');
      setLoading(false);
      return;
    }

    if (!user.id_paciente) {
      console.log('[loadRoutine] user existe pero NO tiene id_paciente');
      Alert.alert('Error', 'No se encontró ID de paciente. Verifica tu perfil.');
      setLoading(false);
      return;
    }

    const cacheKey = `exercises_${user.id_paciente}`;
    setLoading(true);
    try {
      const cachedData = await getFromCache(cacheKey);
      const cachedExercises = Array.isArray(cachedData) ? cachedData : [];

      if (cachedExercises.length > 0) {
        setExercises(cachedExercises);
      }

      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);

      if (!isOnline) {
        notifyOffline();
        return;
      }

      const { data, error } = await routineService.getPatientRoutineExercises(user.id_paciente);

      if (error) {
        console.error('Error al cargar rutina:', error);
        if (cachedExercises.length === 0) {
          Alert.alert('Error', error || 'No se pudo cargar la rutina. Intenta más tarde.');
          setExercises([]);
        }
      } else {
        const safeData = Array.isArray(data) ? data : [];
        console.log('[loadRoutine] Ejercicios cargados:', safeData.length || 0);
        setExercises(safeData);
        await saveToCache(cacheKey, safeData);
      }
    } catch (err) {
      console.error('Excepción al cargar rutina:', err);
      setExercises((prev) => (Array.isArray(prev) ? prev : []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('useEffect MyRoutinesScreen → user:', user);
    console.log('user?.id_paciente:', user?.id_paciente);
    console.log('user loading status:', userLoading);

    if (userLoading) {
      console.log('Esperando a que useUser termine de cargar...');
      return;
    }

    loadRoutine();
  }, [user, userLoading, user?.id_paciente]);

  // Función para pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRoutine();
    setRefreshing(false);
  };

  // Agregar ejercicio con día de la semana
  const handleAddExercise = async () => {
    if (!newExercise.name.trim()) {
      Alert.alert('Atención', 'Ingresa el nombre del ejercicio');
      return;
    }

    if (!user?.id_paciente) {
      Alert.alert('Error', 'Sesión no válida');
      return;
    }

    const selectedDayObj = DAYS_OF_WEEK.find((d) => d.id === selectedDay);
    const diaSemana = selectedDayObj ? selectedDayObj.value : 1;

    setSaving(true);

    try {
      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);

      if (!isOnline) {
        return;
      }

      const exerciseData = {
        name: newExercise.name.trim(),
        sets: newExercise.sets,
        reps: newExercise.reps.toString(),
        duration: newExercise.duration,
        day: diaSemana,
      };

      console.log('[handleAddExercise] Enviando datos:', exerciseData);

      const { data, error } = await routineService.addExercise(user.id_paciente, exerciseData);

      if (error) {
        console.error('Error al agregar ejercicio:', error);
        Alert.alert('Error', typeof error === 'string' ? error : error?.message || 'No se pudo agregar el ejercicio');
      } else if (data) {
        console.log('[handleAddExercise] Ejercicio agregado:', data);
        setExercises((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return [...safePrev, { ...data, dia_semana: diaSemana }];
        });
        Alert.alert('Éxito', 'Ejercicio agregado correctamente');

        setNewExercise({ name: '', sets: 3, reps: 12, duration: 15 });
      }
    } catch (err) {
      console.error('Excepción al agregar ejercicio:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar ejercicio
  const deleteExercise = async (id_ejercicio: number) => {
    Alert.alert('Confirmar', '¿Eliminar este ejercicio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const netInfo = await NetInfo.fetch();
            const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);

            if (!isOnline) {
              notifyOffline();
              return;
            }

            const { error } = await routineService.deleteExercise(id_ejercicio);
            if (error) {
              Alert.alert('Error', typeof error === 'string' ? error : 'No se pudo eliminar el ejercicio.');
            } else {
              setExercises((prev) => {
                const safePrev = Array.isArray(prev) ? prev : [];
                return safePrev.filter((ex) => ex.id_ejercicio !== id_ejercicio);
              });
              Alert.alert('Éxito', 'Ejercicio eliminado');
            }
          } catch (err) {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  // Filtrar ejercicios por día seleccionado
  const selectedDayObj = DAYS_OF_WEEK.find((d) => d.id === selectedDay);
  const dayValue = selectedDayObj ? selectedDayObj.value : 1;

  const safeExercises = Array.isArray(exercises) ? exercises : [];
  const filteredExercises = safeExercises.filter((ex) => ex.dia_semana === dayValue);

  // Componente Modal Picker Mejorado
  const CustomPickerModal = ({ visible, onClose, value, onValueChange, options, title, icon }: any) => {
    const modalScale = modalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
    });

    const modalOpacity = modalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    const getIcon = () => {
      switch(icon) {
        case 'sets':
          return 'barbell';
        case 'reps':
          return 'repeat';
        case 'duration':
          return 'timer-outline';
        default:
          return 'options-outline';
      }
    };

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
          <Animated.View 
            style={[
              styles.pickerContainer,
              {
                transform: [{ scale: modalScale }],
                opacity: modalOpacity,
              }
            ]}
          >
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <View style={styles.pickerHeaderLeft}>
                  <View style={styles.pickerIconContainer}>
                    <Ionicons name={getIcon()} size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.pickerTitle}>{title}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.pickerCloseButton}>
                  <Ionicons name="close" size={22} color={COLORS.textDark} />
                </TouchableOpacity>
              </View>

              <View style={styles.pickerValuePreview}>
                <Text style={styles.pickerValuePreviewLabel}>Valor seleccionado:</Text>
                <Text style={styles.pickerValuePreviewValue}>{value}</Text>
              </View>

              <View style={styles.pickerOptionsContainer}>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.pickerOption,
                        value === item && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        onValueChange(item);
                        onClose();
                      }}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        value === item && styles.pickerOptionTextSelected,
                      ]}>
                        {item}
                      </Text>
                      {value === item && (
                        <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
                />
              </View>

              <TouchableOpacity style={styles.pickerCancelButton} onPress={onClose}>
                <Text style={styles.pickerCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Pantalla de Loading inicial
  if (loading) {
    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['-15deg', '15deg'],
    });

    const bounce = bounceValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -15],
    });

    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ rotate: spin }, { translateY: bounce }, { scale: weightScale }],
                opacity: weightOpacity,
              },
            ]}
          >
            <Ionicons name="barbell" size={80} color={COLORS.primary} />
          </Animated.View>

          <Animated.Text style={[styles.loadingText, { opacity: loadingTextOpacity }]}>
            Cargando rutinas...
          </Animated.Text>

          <View style={styles.dotsContainer}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    opacity: loadingTextOpacity.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.3, 1],
                    }),
                    transform: [
                      {
                        scale: loadingTextOpacity.interpolate({
                          inputRange: [0.3, 1],
                          outputRange: [0.8, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render principal con pull-to-refresh
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>MI RUTINA</Text>
          <View style={styles.underlineSmall} />
        </View>
        <View style={styles.headerIcon} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
              title="Actualizando rutinas..."
              titleColor={COLORS.primary}
            />
          }
        >
          <View style={styles.heroSection}>
            <Text style={styles.mainTitle}>Gestión de Rutina</Text>
            <Text style={styles.subtitle}>Crea y organiza tus ejercicios diarios</Text>
          </View>

          {/* SELECTOR DE DÍAS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.daysScroll}
            contentContainerStyle={styles.daysContainer}
          >
            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayChip, selectedDay === day.id && styles.dayChipActive]}
                onPress={() => setSelectedDay(day.id)}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    selectedDay === day.id && styles.dayChipTextActive,
                  ]}
                >
                  {day.short}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FORMULARIO */}
          <View style={styles.registrationCard}>
            <Text style={styles.cardHeaderTitle}>
              Nuevo Ejercicio - {DAYS_OF_WEEK.find((d) => d.id === selectedDay)?.name}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre del ejercicio (ej. Flexiones)"
              value={newExercise.name}
              onChangeText={(text) => setNewExercise({ ...newExercise, name: text })}
              placeholderTextColor="#999"
            />

            <View style={styles.rowInputs}>
              <View style={[styles.pickerField, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.pickerLabel}>Series</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowSetsPicker(true)}>
                  <View style={styles.pickerButtonContent}>
                    <Ionicons name="barbell" size={18} color={COLORS.primary} />
                    <Text style={styles.pickerButtonText}>{newExercise.sets}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.pickerField, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.pickerLabel}>Reps</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowRepsPicker(true)}>
                  <View style={styles.pickerButtonContent}>
                    <Ionicons name="repeat" size={18} color={COLORS.primary} />
                    <Text style={styles.pickerButtonText}>{newExercise.reps}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.pickerField, { flex: 1 }]}>
                <Text style={styles.pickerLabel}>Dur. (min)</Text>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDurationPicker(true)}>
                  <View style={styles.pickerButtonContent}>
                    <Ionicons name="timer-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.pickerButtonText}>{newExercise.duration}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addButton, saving && { opacity: 0.7 }]}
              onPress={handleAddExercise}
              disabled={saving || isOffline}
            >
              <Ionicons name="add-circle" size={20} color={COLORS.white} />
              <Text style={styles.addButtonText}>REGISTRAR EJERCICIO</Text>
              {saving && <ActivityIndicator size="small" color={COLORS.white} style={{ marginLeft: 10 }} />}
            </TouchableOpacity>
          </View>

          {/* LISTA FILTRADA POR DÍA */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {DAYS_OF_WEEK.find((d) => d.id === selectedDay)?.name}
            </Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{filteredExercises.length} ejercicios</Text>
            </View>
          </View>

          {filteredExercises.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="dumbbell" size={60} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No hay ejercicios</Text>
              <Text style={styles.emptyText}>
                Agrega tu primer ejercicio para {DAYS_OF_WEEK.find((d) => d.id === selectedDay)?.name}
              </Text>
            </View>
          ) : (
            filteredExercises.map((item: any) => (
              <View key={item.id_ejercicio} style={styles.exerciseCard}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{item.nombre_ejercicio}</Text>
                  <View style={styles.exerciseDetails}>
                    <View style={styles.detailBadge}>
                      <MaterialCommunityIcons name="counter" size={12} color={COLORS.primary} />
                      <Text style={styles.detailBadgeText}>{item.series} series</Text>
                    </View>
                    <View style={styles.detailBadge}>
                      <MaterialCommunityIcons name="repeat" size={12} color={COLORS.accent} />
                      <Text style={styles.detailBadgeText}>{item.repeticiones} reps</Text>
                    </View>
                    {item.duracion && item.duracion !== 'N/A' && (
                      <View style={styles.detailBadge}>
                        <MaterialCommunityIcons name="clock-outline" size={12} color={COLORS.info} />
                        <Text style={styles.detailBadgeText}>{item.duracion} min</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => deleteExercise(item.id_ejercicio)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODALES SELECTORES MEJORADOS */}
      <CustomPickerModal
        visible={showSetsPicker}
        onClose={() => setShowSetsPicker(false)}
        value={newExercise.sets}
        onValueChange={(value: number) => setNewExercise({ ...newExercise, sets: value })}
        options={SETS_OPTIONS}
        title="Seleccionar Series"
        icon="sets"
      />

      <CustomPickerModal
        visible={showRepsPicker}
        onClose={() => setShowRepsPicker(false)}
        value={newExercise.reps}
        onValueChange={(value: number) => setNewExercise({ ...newExercise, reps: value })}
        options={REPS_OPTIONS}
        title="Seleccionar Repeticiones"
        icon="reps"
      />

      <CustomPickerModal
        visible={showDurationPicker}
        onClose={() => setShowDurationPicker(false)}
        value={newExercise.duration}
        onValueChange={(value: number) => setNewExercise({ ...newExercise, duration: value })}
        options={DURATION_OPTIONS}
        title="Seleccionar Duración"
        icon="duration"
      />
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

  scrollView: { flex: 1, paddingHorizontal: 20 },
  heroSection: { marginVertical: 20 },
  mainTitle: { fontSize: 24, fontWeight: '900', color: COLORS.textDark },
  subtitle: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },

  daysScroll: { marginBottom: 15 },
  daysContainer: { paddingVertical: 5, gap: 8 },
  dayChip: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  dayChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  dayChipTextActive: { color: COLORS.white },

  registrationCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 25,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 15,
  },
  input: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: '600',
  },
  rowInputs: { flexDirection: 'row', marginBottom: 15 },
  pickerField: { marginBottom: 5 },
  pickerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 4,
    marginLeft: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    marginLeft: 8,
    fontSize: 14,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textDark },
  sectionCount: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 16, fontWeight: '900', color: COLORS.textDark, marginBottom: 8 },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  detailBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  deleteButton: { padding: 8 },

  emptyBox: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textLight,
    marginTop: 15,
    marginBottom: 5,
  },
  emptyText: {
    color: COLORS.textLight,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  spacer: { height: 40 },

  // Estilos mejorados para el modal - CORREGIDOS
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  pickerContent: {
    padding: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  pickerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textDark,
  },
  pickerCloseButton: {
    padding: 5,
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    width: 35,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerValuePreview: {
    backgroundColor: COLORS.secondary,
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  pickerValuePreviewLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: 5,
  },
  pickerValuePreviewValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primary,
  },
  pickerOptionsContainer: {
    maxHeight: 300,
    marginBottom: 15,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.secondary,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  pickerOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  pickerOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '900',
  },
  pickerSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 10,
  },
  pickerCancelButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginTop: 5,
  },
  pickerCancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: { alignItems: 'center', justifyContent: 'center' },
  iconContainer: { marginBottom: 30 },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});