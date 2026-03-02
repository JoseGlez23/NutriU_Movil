import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useUser } from '../hooks/useUser';
import { useNutriologo } from '../context/NutriologoContext';
import { foodService } from '../services/foodService';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#D1E8D5',
  kcalBar: '#FF7043',
  ptsBar: '#42A5F5',
  disabled: '#E0E0E0',
  inactiveDay: '#F1F5F9',
  todayDay: '#D4F4E2',
  activeDayText: '#2E8B57',
  blockedDay: '#EAEAEA',
  blockedText: '#AAAAAA',
  warning: '#FFA500',
  info: '#17A2B8',
  completed: '#4CAF50',
};

const DAYS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
const MEALS = ['Desayuno', 'Colación 1', 'Almuerzo', 'Colación 2', 'Cena'];
const CALORIE_GOAL = 2000;
const POINTS_GOAL = 20;

const normalizeMealType = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const UI_TO_DB_MEAL_TYPE: Record<string, 'desayuno' | 'almuerzo' | 'comida' | 'cena' | 'snack'> = {
  desayuno: 'desayuno',
  almuerzo: 'almuerzo',
  comida: 'comida',
  cena: 'cena',
  snack: 'snack',
  'colacion 1': 'snack',
  'colacion 2': 'comida',
};

const DB_TO_UI_MEALS = (dbMealType: string): string[] => {
  const key = normalizeMealType(dbMealType);
  if (key === 'desayuno') return ['Desayuno'];
  if (key === 'almuerzo') return ['Almuerzo'];
  if (key === 'comida') return ['Colación 2'];
  if (key === 'cena') return ['Cena'];
  if (key === 'snack') return ['Colación 1'];
  return [];
};

const parseTimestampAsUTC = (value?: string | null): Date | null => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function FoodTrackingScreen({ navigation }: any) {
  const { user, updatePoints } = useUser();
  const { 
    estadoNutriologo, 
    loading: nutriologoLoading, 
    nutriologo,
    refreshNutriologo,
    getMensajeEstado
  } = useNutriologo();
  
  const [viewMode, setViewMode] = useState('registro');
  const [selectedDay, setSelectedDay] = useState('LUNES');
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [foods, setFoods] = useState<any[]>([]);
  const [todayHistory, setTodayHistory] = useState<any[]>([]);
  const [dietaRecomendada, setDietaRecomendada] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [todayDayIndex, setTodayDayIndex] = useState(0);
  const [registeredMealsToday, setRegisteredMealsToday] = useState<Set<string>>(new Set());

  // Loading animation values
  const spinValue = useRef(new Animated.Value(0)).current;
  const leafScale = useRef(new Animated.Value(1)).current;
  const leafOpacity = useRef(new Animated.Value(0.5)).current;
  const loadingTextOpacity = useRef(new Animated.Value(0.3)).current;

  // Refrescar cuando la pantalla gana foco
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      console.log('🔄 FoodTracking enfocada - refrescando');
      await refreshNutriologo();
      await loadData();
    });
    return unsubscribe;
  }, [navigation, refreshNutriologo, user?.id_paciente, estadoNutriologo, selectedDay]);

  // Detectar día actual
  useEffect(() => {
    const updateToday = () => {
      const today = new Date();
      const dayIndex = today.getDay(); // 0=domingo, 1=lunes...
      const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      setTodayDayIndex(adjustedIndex);
      const dayName = DAYS[adjustedIndex];
      setSelectedDay(dayName);
    };

    updateToday();
    const unsubscribe = navigation.addListener('focus', updateToday);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (user) {
      setUserLoaded(true);
      loadTotalPoints();
    }
  }, [user]);

  const loadTotalPoints = async () => {
    if (!user?.id_paciente) return;
    try {
      const { data, error } = await supabase
        .from('puntos_paciente')
        .select('puntos_totales')
        .eq('id_paciente', user.id_paciente)
        .single();
      if (error) throw error;
      setTotalPoints(data?.puntos_totales || 0);
    } catch (err) {
      console.error('Error cargando puntos:', err);
    }
  };

  // Loading animation
  useEffect(() => {
    if (loading || nutriologoLoading) {
      Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })).start();
      Animated.loop(Animated.sequence([Animated.timing(leafScale, { toValue: 1.2, duration: 1000, useNativeDriver: true }), Animated.timing(leafScale, { toValue: 1, duration: 1000, useNativeDriver: true })])).start();
      Animated.loop(Animated.sequence([Animated.timing(leafOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }), Animated.timing(leafOpacity, { toValue: 0.5, duration: 1000, useNativeDriver: true })])).start();
      Animated.loop(Animated.sequence([Animated.timing(loadingTextOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }), Animated.timing(loadingTextOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true })])).start();
    }
  }, [loading, nutriologoLoading]);

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadData = async () => {
    if (!user?.id_paciente) return;

    setLoading(true);
    setRegisteredMealsToday(new Set());

    try {
      // Alimentos disponibles
      const { data: foodData } = await foodService.getAvailableFoods();
      setFoods(foodData || []);

      // Si no hay dieta activa/asignada, limpiar para evitar datos residuales
      if (estadoNutriologo !== 'asignado_con_dieta') {
        setTodayHistory([]);
        setDietaRecomendada([]);
        return;
      }

      // Historial SOLO de hoy
      const today = new Date().toISOString().split('T')[0];
      const { data: historyData, error: histError } = await foodService.getFoodHistory(user.id_paciente, today, today);
      if (histError) throw histError;

      const mapped = (historyData || []).map((item: any) => {
        const rawPoints = item.puntos_obtenidos ?? item.alimentos?.puntos ?? item.alimentos?.puntos_obtenidos;
        const numericPoints = Number(rawPoints);
        const resolvedPoints = Number.isFinite(numericPoints) && numericPoints > 0 ? numericPoints : 3;

        return {
        id: item.id_registro,
        food: {
          id: item.id_alimento || `custom-${item.id_registro}`,
          name: item.alimento_personalizado || (item.alimentos?.nombre || 'Personalizado'),
          unit: item.unidad || 'g',
          kcalPerUnit: item.alimentos?.calorias_por_100g ? item.alimentos.calorias_por_100g / 100 : 0,
          pts: resolvedPoints,
        },
        grams: item.cantidad,
        kcal: item.calorias_totales,
        points: resolvedPoints,
        assignedDate: item.fecha || today,
        assignedTime: item.hora || null,
        confirmedAt: item.created_at || null,
        mealType: item.tipo_comida?.trim(), // Guardamos tal cual viene (con acentos y mayúsculas)
        };
      });
      setTodayHistory(mapped);

      // Marcar comidas registradas HOY usando etiquetas de UI
      const completedToday = new Set<string>();
      mapped.forEach((item: any) => {
        DB_TO_UI_MEALS(item.mealType).forEach((mealLabel) => completedToday.add(mealLabel));
      });
      setRegisteredMealsToday(completedToday);

      // Cargar dieta recomendada para el día seleccionado
      if (estadoNutriologo === 'asignado_con_dieta') {
        const diaMap: Record<(typeof DAYS)[number], number> = {
          LUNES: 1,
          MARTES: 2,
          MIÉRCOLES: 3,
          JUEVES: 4,
          VIERNES: 5,
          SÁBADO: 6,
          DOMINGO: 7,
        };
        const diaNumero = diaMap[selectedDay] || 1;

        const { data: dietaData, error: dietaError } = await supabase
          .from('dieta_detalle')
          .select(`
            *,
            dietas!inner(id_paciente)
          `)
          .eq('dietas.id_paciente', user.id_paciente)
          .eq('dia_semana', diaNumero)
          .in('tipo_comida', MEALS)
          .order('orden', { ascending: true });

        if (dietaError) throw dietaError;

        const normalizeText = (value: any) =>
          String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const alimentosPorDescripcion = new Map<string, any>();
        const alimentosPorNombre = new Map<string, any>();
        const catalogoNormalizado = (foodData || []).map((alimento: any) => ({
          alimento,
          nombreNorm: normalizeText(alimento?.nombre),
        }));

        (foodData || []).forEach((alimento: any) => {
          const keyDescripcion = normalizeText(alimento?.descripcion);
          const keyNombre = normalizeText(alimento?.nombre);

          if (keyDescripcion) alimentosPorDescripcion.set(keyDescripcion, alimento);
          if (keyNombre) alimentosPorNombre.set(keyNombre, alimento);
        });

        const dietaEnriquecida = (dietaData || []).map((item: any) => {
          const platilloAsignado = String(item?.descripcion || '').trim();
          const keyDescripcionDetalle = normalizeText(item?.descripcion);
          let matchedFood =
            alimentosPorDescripcion.get(keyDescripcionDetalle) ||
            alimentosPorNombre.get(keyDescripcionDetalle) ||
            null;

          if (!matchedFood && keyDescripcionDetalle) {
            const candidates = catalogoNormalizado
              .filter((entry: any) => entry.nombreNorm && entry.nombreNorm.length >= 3)
              .filter((entry: any) => keyDescripcionDetalle.includes(entry.nombreNorm))
              .sort((a: any, b: any) => b.nombreNorm.length - a.nombreNorm.length);

            matchedFood = candidates[0]?.alimento || null;
          }

          return {
            ...item,
            platillo_asignado: platilloAsignado || matchedFood?.nombre || 'Alimento asignado',
            id_alimento_resuelto: matchedFood?.id_alimento || null,
            nombre_alimento_resuelto: matchedFood?.nombre || null,
          };
        });

        setDietaRecomendada(dietaEnriquecida);
      } else {
        setDietaRecomendada([]);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
      Alert.alert('Error', 'No se pudieron cargar los datos. Intenta refrescar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLoaded && user?.id_paciente) {
      loadData();
    }
  }, [userLoaded, user?.id_paciente, selectedDay, estadoNutriologo]);

  const stats = useMemo(() => {
    const totalKcal = todayHistory.reduce((acc, curr) => acc + (curr.kcal || 0), 0);
    const totalPoints = todayHistory.reduce((acc, curr) => acc + (curr.points || 0), 0);
    return {
      totalKcal,
      kcalProgress: (totalKcal / CALORIE_GOAL) * 100,
      pointsProgress: (totalPoints / POINTS_GOAL) * 100,
      remainingKcal: Math.max(CALORIE_GOAL - totalKcal, 0),
      totalPoints,
    };
  }, [todayHistory]);

  const handleAmountChange = (text: string) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText === '') { setAmount(''); return; }
    const numericValue = parseInt(cleanText);
    if (numericValue > (selectedFood?.max || 999)) {
      setAmount((selectedFood?.max || 999).toString());
    } else {
      setAmount(numericValue.toString());
    }
  };

  const confirmRegister = async () => {
    if (!user?.id_paciente) {
      Alert.alert('Error', 'No se encontró ID de paciente.');
      return;
    }

    // Bloqueo fuerte: si ya está registrada, no proceder
    if (registeredMealsToday.has(selectedFood.type)) {
      Alert.alert('Ya completado', 'Esta comida ya fue registrada hoy.');
      setSelectedFood(null);
      setAmount('');
      return;
    }

    const qty = parseInt(amount);
    if (!qty || qty <= 0) {
      Alert.alert('Atención', 'Ingresa una cantidad válida.');
      return;
    }

    setIsRegistering(true);

    try {
      const kcalTotal = qty * (selectedFood.kcalPerUnit || 0);
      const maxQty = selectedFood.max || 100;
      const pointsEarned = Math.round((qty / maxQty) * (selectedFood.pts || 3));
      const pointsFinal = Math.max(1, Math.min(pointsEarned, selectedFood.pts || 3));

      // Mapear tipo de comida UI -> valores permitidos en BD (check constraint)
      const mealTypeRaw = String(selectedFood.type || '').trim();
      const normalizedMealKey = normalizeMealType(mealTypeRaw);
      const mealTypeNormalized = UI_TO_DB_MEAL_TYPE[normalizedMealKey];

      if (!mealTypeNormalized) {
        Alert.alert('Error de validación', 'El tipo de comida no coincide con los permitidos.');
        return;
      }

      console.log('Enviando tipo_comida:', mealTypeNormalized); // ← Para depurar

      const payload = {
        id_alimento: selectedFood.id_alimento || null,
        alimento_personalizado: selectedFood.platillo || selectedFood.name || null,
        cantidad: qty,
        unidad: selectedFood.unit || 'g',
        calorias_totales: kcalTotal,
        puntos_obtenidos: pointsFinal,
        fecha: new Date().toISOString().split('T')[0],
        tipo_comida: mealTypeNormalized,
      };

      let { error } = await foodService.registerFood(user.id_paciente, payload);

      if (error?.code === '23505') {
        const fallbackPayload = {
          ...payload,
          id_alimento: null,
          alimento_personalizado: `${selectedFood.platillo || selectedFood.name || 'Alimento'} (${mealTypeRaw})`,
        };

        const retry = await foodService.registerFood(user.id_paciente, fallbackPayload);
        error = retry.error;
      }

      if (error) {
        console.error('Error Supabase:', error);
        if (error.code === '23514') {
          Alert.alert('Error de validación', 'El tipo de comida no coincide con los permitidos. Contacta soporte o verifica la dieta.');
        } else if (error.code === '23505') {
          Alert.alert('Ya registrado', 'Esta comida ya fue completada hoy en la base de datos.');
        } else {
          Alert.alert('Error', 'No se pudo registrar: ' + (error.message || 'Desconocido'));
        }
      } else {
        await updatePoints(pointsFinal);
        Alert.alert('Éxito', `¡${qty} ${selectedFood.unit || 'g'} registrados! +${pointsFinal} pts`);

        // Bloqueo inmediato + refresco
        setRegisteredMealsToday(prev => new Set([...prev, mealTypeRaw]));
        await loadData();

        setSelectedFood(null);
        setAmount('');
      }
    } catch (error) {
      console.error('Error al registrar:', error);
      Alert.alert('Error', 'Ocurrió un error al registrar el alimento.');
    } finally {
      setIsRegistering(false);
    }
  };

  const hasAnyDiet = useMemo(() => dietaRecomendada.length > 0, [dietaRecomendada]);

  const getAssignedFoodName = (item: any) => {
    const platillo = String(item?.platillo_asignado || item?.descripcion || '').trim();
    if (platillo) return platillo;

    const explicitName =
      item?.nombre_alimento_resuelto ||
      item?.alimentos?.nombre_alimento ||
      item?.alimentos?.nombre ||
      item?.nombre_alimento ||
      item?.nombre ||
      item?.alimento ||
      item?.titulo;

    if (explicitName) return explicitName;

    const description = String(item?.descripcion || '').trim();
    if (!description) return 'Alimento asignado';

    const separators = [' - ', ' — ', ': ', ' | '];
    for (const separator of separators) {
      if (description.includes(separator)) {
        const [possibleName] = description.split(separator);
        if (possibleName?.trim()) return possibleName.trim();
      }
    }

    return description;
  };


  const getDayStyle = (day: string) => {
    const dayIndex = DAYS.indexOf(day);
    const isSelected = selectedDay === day;
    const isToday = dayIndex === todayDayIndex;
    const isPast = dayIndex < todayDayIndex;
    const shouldBlockPastDays = estadoNutriologo === 'asignado_con_dieta';

    if (isPast && shouldBlockPastDays) {
      return {
        chip: { 
          ...styles.dayChip, 
          backgroundColor: COLORS.blockedDay, 
          borderColor: COLORS.disabled,
          opacity: 0.7,
        },
        text: { 
          ...styles.dayText, 
          color: COLORS.blockedText, 
          fontWeight: '500' as const,
        },
        isBlocked: true,
      };
    }

    if (isSelected) {
      return {
        chip: { 
          ...styles.dayChip, 
          backgroundColor: COLORS.primary, 
          borderColor: COLORS.primary 
        },
        text: { 
          ...styles.dayText, 
          color: COLORS.white, 
          fontWeight: '900' as const,
        },
        isBlocked: false,
      };
    }

    if (isToday) {
      return {
        chip: { 
          ...styles.dayChip, 
          backgroundColor: COLORS.todayDay, 
          borderColor: COLORS.border 
        },
        text: { 
          ...styles.dayText, 
          color: COLORS.activeDayText, 
          fontWeight: '800' as const,
        },
        isBlocked: false,
      };
    }

    return {
      chip: { 
        ...styles.dayChip, 
        backgroundColor: COLORS.inactiveDay, 
        borderColor: COLORS.disabled 
      },
      text: { 
        ...styles.dayText, 
        color: COLORS.textLight, 
        fontWeight: '600' as const,
      },
      isBlocked: false,
    };
  };

  const isToday = DAYS.indexOf(selectedDay) === todayDayIndex;
  const hasAssignedDiet = estadoNutriologo === 'asignado_con_dieta';

  const renderBlockedPlanState = () => {
    const isUnassigned = estadoNutriologo === 'sin_asignar';

    return (
      <View style={styles.noDietContainer}>
        <Ionicons
          name={isUnassigned ? 'person-outline' : 'time-outline'}
          size={60}
          color={isUnassigned ? COLORS.primary : COLORS.warning}
          style={styles.noDietIcon}
        />
        <Text style={[styles.noDietTitle, !isUnassigned && { color: COLORS.warning }]}>
          {isUnassigned ? 'Sin Nutriólogo Asignado' : 'Esperando dieta'}
        </Text>
        <Text style={styles.noDietText}>
          {isUnassigned
            ? 'No tienes un nutriólogo asignado. Agenda una consulta para habilitar historial y progreso.'
            : 'Tu nutriólogo aún no ha asignado tu plan, por eso no hay historial ni progreso disponible.'}
        </Text>
        {isUnassigned && (
          <TouchableOpacity
            style={styles.noDietButton}
            onPress={() => navigation.navigate('Schedule', { view: 'agendar' })}
          >
            <Text style={styles.noDietButtonText}>Agendar consulta</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getHistoryMealVisual = (meal: string) => {
    switch (meal) {
      case 'Desayuno':
        return { icon: 'sunny-outline', color: COLORS.warning };
      case 'Colación 1':
        return { icon: 'nutrition-outline', color: COLORS.accent };
      case 'Almuerzo':
        return { icon: 'restaurant-outline', color: COLORS.primary };
      case 'Colación 2':
        return { icon: 'cafe-outline', color: COLORS.info };
      case 'Cena':
        return { icon: 'moon-outline', color: COLORS.completed };
      default:
        return { icon: 'restaurant-outline', color: COLORS.primary };
    }
  };

  const renderContentByNutriologoState = () => {
    switch (estadoNutriologo) {
      case 'sin_asignar':
        return (
          <View style={styles.noDietContainer}>
            <Ionicons name="person-outline" size={60} color={COLORS.primary} style={styles.noDietIcon} />
            <Text style={styles.noDietTitle}>Sin Nutriólogo Asignado</Text>
            <Text style={styles.noDietText}>
              Agenda una consulta para obtener tu plan personalizado.
            </Text>
            <TouchableOpacity 
              style={styles.noDietButton}
              onPress={() => navigation.navigate('Schedule', { view: 'agendar' })}
            >
              <Text style={styles.noDietButtonText}>Agendar consulta</Text>
            </TouchableOpacity>
          </View>
        );

      case 'asignado_sin_dieta':
        return (
          <View style={[styles.noDietContainer, { backgroundColor: '#FFF3CD' }]}>
            <Ionicons name="time-outline" size={60} color="#FFA500" style={styles.noDietIcon} />
            <Text style={[styles.noDietTitle, { color: '#FFA500' }]}>Esperando dieta</Text>
            <Text style={styles.noDietText}>
              Tu nutriólogo aún no ha asignado tu plan.
            </Text>
          </View>
        );

      case 'asignado_con_dieta':
        if (!hasAnyDiet) {
          return (
            <View style={styles.noDietContainer}>
              <Ionicons name="restaurant-outline" size={60} color={COLORS.primary} style={styles.noDietIcon} />
              <Text style={styles.noDietTitle}>Sin dieta</Text>
              <Text style={styles.noDietText}>
                No hay alimentos asignados.
              </Text>
            </View>
          );
        }

        return MEALS.map((meal) => {
          const items = dietaRecomendada.filter((d) => d.tipo_comida === meal);
          if (items.length === 0) return null;

          const isRegistered = registeredMealsToday.has(meal);

          return (
            <View key={meal} style={styles.mealSection}>
              <Text style={[
                styles.mealTitle,
                isRegistered && isToday && { color: COLORS.completed, fontWeight: '900' }
              ]}>
                {meal.toUpperCase()}
                {isRegistered && isToday && ' ✓ Completado'}
              </Text>
              {items.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.foodItem,
                    (isRegistered && isToday) && styles.disabledItem
                  ]}
                  onPress={() => {
                    if (!isToday) {
                      Alert.alert('Solo hoy', 'Solo puedes registrar alimentos para el día de hoy.');
                      return;
                    }
                    if (isRegistered) {
                      Alert.alert('Ya completado', 'Esta comida ya fue registrada hoy. No puedes agregar más.');
                      return;
                    }
                    if (isRegistering) return;

                    setSelectedFood({
                      id_alimento: item.id_alimento || item.id_alimento_resuelto || null,
                      name: getAssignedFoodName(item),
                      platillo: String(item?.platillo_asignado || item?.descripcion || '').trim() || null,
                      max: 100,
                      unit: item.porcion_sugerida?.includes('g') ? 'g' : 'unidad',
                      kcalPerUnit: item.calorias_por_100g ? item.calorias_por_100g / 100 : 1,
                      pts: 3,
                      horario: item.horario || null,
                      type: meal, // ← Valor original, con acentos y mayúsculas
                    });
                    setAmount('100');
                  }}
                  disabled={isRegistering || (isRegistered && isToday)}
                >
                  <View style={styles.foodContent}>
                    <View style={styles.foodInfo}>
                      <Text style={styles.foodName}>{getAssignedFoodName(item)}</Text>
                      <View style={styles.infoRow}>
                        <Text style={styles.foodDesc}>
                          Cal: ~{item.calorias_por_100g ? Math.round(item.calorias_por_100g) : '?'} kcal/100g
                        </Text>
                        {item.porcion_sugerida && (
                          <Text style={styles.foodDesc}> • {item.porcion_sugerida}</Text>
                        )}
                        {item.horario && (
                          <Text style={styles.foodHorario}> • {new Date(`2000-01-01T${item.horario}`).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })}</Text>
                        )}
                      </View>
                      <Text style={styles.foodNutrient}>
                        {item.categoria ? item.categoria.charAt(0).toUpperCase() + item.categoria.slice(1) : 'General'}
                      </Text>
                    </View>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.ptsValue}>+3</Text>
                      <Text style={styles.ptsLabel}>pts</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        });

      default:
        return null;
    }
  };

  if (loading || nutriologoLoading) {
    const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <Animated.View
            style={[
              styles.leafContainer,
              {
                transform: [{ rotate: spin }, { scale: leafScale }],
                opacity: leafOpacity,
              },
            ]}
          >
            <Ionicons name="leaf" size={80} color={COLORS.primary} />
          </Animated.View>
          
          <Animated.Text style={[styles.loadingText, { opacity: loadingTextOpacity }]}>
            {nutriologoLoading ? 'Verificando asignación...' : 'Cargando tu plan alimenticio'}
          </Animated.Text>
          
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    opacity: loadingTextOpacity.interpolate({ inputRange: [0.3, 1], outputRange: [0.3, 1] }),
                    transform: [{
                      scale: loadingTextOpacity.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.2] })
                    }]
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER CON PUNTOS */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>PLAN SEMANAL</Text>
          <View style={styles.underlineSmall} />
        </View>
        <View style={styles.pointsPill}>
          <Text style={styles.pointsVal}>{totalPoints} PTS</Text>
        </View>
      </View>

      {/* NAVBAR */}
      <View style={styles.navBar}>
        {['registro', 'historial', 'progreso'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setViewMode(tab)}
            style={[styles.navItem, viewMode === tab && styles.navItemActive]}
          >
            <Text style={[styles.navText, viewMode === tab && styles.navTextActive]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'registro' && (
        <View style={{ flex: 1 }}>
          <View style={styles.daysBarWrapper}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.daysBarContent}
            >
              {DAYS.map((day) => {
                const { chip, text, isBlocked } = getDayStyle(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => {
                      if (!isBlocked) handleDayChange(day);
                    }}
                    style={chip}
                    disabled={isBlocked}
                  >
                    <Text style={text}>
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.planContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
                title="Actualizando plan..."
                titleColor={COLORS.primary}
              />
            }
          >
            <Text style={styles.dayTitle}>{selectedDay}</Text>

            {renderContentByNutriologoState()}
          </ScrollView>
        </View>
      )}

      {/* Historial */}
      {viewMode === 'historial' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.planContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
                title="Actualizando historial..."
                titleColor={COLORS.primary}
              />
            }
          >
            {!hasAssignedDiet ? (
              renderBlockedPlanState()
            ) : (
              <>
                <Text style={styles.dayTitle}>Historial de Hoy</Text>
                {todayHistory.length > 0 ? (
                  MEALS.map((meal) => {
                    const mealItems = todayHistory.filter((item) => DB_TO_UI_MEALS(item.mealType).includes(meal));
                    if (mealItems.length === 0) return null;

                    const mealVisual = getHistoryMealVisual(meal);

                    return (
                      <View key={meal} style={styles.historyMealSection}>
                        <View style={styles.historyMealHeader}>
                          <View style={[styles.historyMealIconWrap, { borderColor: mealVisual.color }]}> 
                            <Ionicons name={mealVisual.icon as any} size={14} color={mealVisual.color} />
                          </View>
                          <Text style={styles.historyMealTitle}>{meal.toUpperCase()}</Text>
                        </View>

                        {mealItems.map((item) => (
                          <View key={item.id} style={[styles.historyItem, { borderLeftColor: mealVisual.color }]}> 
                            <View style={styles.historyContent}>
                              <View style={styles.historyInfo}>
                                <Text style={styles.historyFoodName}>{item.food.name}</Text>
                                <Text style={styles.historyDetail}>
                                  {item.grams} {item.food.unit}
                                </Text>
                                <Text style={styles.historyNutrient}>
                                  {item.food.nutrient || item.food.categoria || 'General'}
                                </Text>
                              </View>
                              <View style={styles.historyStats}>
                                <View style={styles.historyStatItem}>
                                  <Text style={styles.historyKcal}>{Math.round(item.kcal)}</Text>
                                  <Text style={styles.historyStatLabel}>kcal</Text>
                                </View>
                                <View style={styles.historyStatItem}>
                                  <Text style={styles.historyPts}>+{item.points}</Text>
                                  <Text style={styles.historyStatLabel}>pts</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })
            ) : (
              <Text style={styles.emptyText}>No hay alimentos registrados hoy.</Text>
            )}
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* Progreso */}
      {viewMode === 'progreso' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.planContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
                title="Actualizando progreso..."
                titleColor={COLORS.primary}
              />
            }
          >
            {!hasAssignedDiet ? (
              renderBlockedPlanState()
            ) : (
              <>
                <Text style={styles.dayTitle}>Progreso del Día</Text>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>CALORÍAS</Text>
                <Text style={styles.progressValue}>
                  {Math.round(stats.totalKcal)} / {CALORIE_GOAL} kcal
                </Text>
              </View>

              <View style={styles.calorieCardsGrid}>
                <View style={styles.calorieCard}>
                  <Text style={styles.calorieCardLabel}>Consumidas</Text>
                  <Text style={styles.calorieCardValue}>{Math.round(stats.totalKcal)}</Text>
                </View>

                <View style={styles.calorieCard}>
                  <Text style={styles.calorieCardLabel}>
                    {stats.remainingKcal > 0 ? 'Restantes' : 'Excedidas'}
                  </Text>
                  <Text
                    style={[
                      styles.calorieCardValue,
                      stats.remainingKcal === 0 && { color: COLORS.warning },
                    ]}
                  >
                    {stats.remainingKcal > 0
                      ? Math.round(stats.remainingKcal)
                      : Math.round(stats.totalKcal - CALORIE_GOAL)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.progressInfo}>
                  {stats.remainingKcal > 0
                    ? `${Math.round(stats.remainingKcal)} kcal restantes`
                    : `${Math.round(stats.totalKcal - CALORIE_GOAL)} kcal excedidas`}
                </Text>
                <Text style={styles.progressPercent}>{Math.round(stats.kcalProgress)}%</Text>
              </View>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>PUNTOS</Text>
                <Text style={styles.progressValue}>
                  {stats.totalPoints} / {POINTS_GOAL} pts
                </Text>
              </View>

              <View style={styles.pointsCardsGrid}>
                <View style={styles.pointsCardSmall}>
                  <Text style={styles.pointsCardLabel}>Ganados</Text>
                  <Text style={styles.pointsCardValue}>{stats.totalPoints}</Text>
                </View>

                <View style={styles.pointsCardSmall}>
                  <Text style={styles.pointsCardLabel}>
                    {stats.pointsProgress <= 100 ? 'Restantes' : 'Extra'}
                  </Text>
                  <Text
                    style={[
                      styles.pointsCardValue,
                      stats.pointsProgress > 100 && { color: COLORS.warning },
                    ]}
                  >
                    {stats.pointsProgress <= 100
                      ? Math.round(POINTS_GOAL - stats.totalPoints)
                      : Math.round(stats.totalPoints - POINTS_GOAL)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressFooter}>
                <Text style={styles.progressInfo}>
                  {stats.pointsProgress <= 100
                    ? `${Math.round(POINTS_GOAL - stats.totalPoints)} pts restantes`
                    : '¡Meta alcanzada!'}
                </Text>
                <Text style={styles.progressPercent}>{Math.round(stats.pointsProgress)}%</Text>
              </View>
            </View>

            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Resumen</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Alimentos registrados:</Text>
                <Text style={styles.summaryValue}>{todayHistory.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Promedio por alimento:</Text>
                <Text style={styles.summaryValue}>
                  {todayHistory.length > 0
                    ? Math.round(stats.totalKcal / todayHistory.length)
                    : 0}{' '}
                  kcal
                </Text>
              </View>
            </View>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* Modal de registro */}
      <Modal transparent visible={!!selectedFood} animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
            <View style={styles.sheet}>
              <Text style={styles.sheetName}>{selectedFood?.name}</Text>
              <Text style={styles.sheetLimit}>
                Cantidad (máx sugerido: {selectedFood?.max || 999})
              </Text>

              {/* Indicador fuerte si ya está registrada */}
              {registeredMealsToday.has(selectedFood?.type) && (
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: COLORS.completed + '20',
                  padding: 12,
                  borderRadius: 12,
                  marginVertical: 12,
                  borderWidth: 1,
                  borderColor: COLORS.completed
                }}>
                  <Ionicons name="checkmark-circle" size={28} color={COLORS.completed} />
                  <Text style={{ 
                    color: COLORS.completed, 
                    fontWeight: '900', 
                    marginLeft: 12,
                    fontSize: 16
                  }}>
                    COMIDA YA COMPLETADA HOY
                  </Text>
                </View>
              )}

              <View style={styles.inputArea}>
                <TextInput
                  style={[
                    styles.inputMassive,
                    registeredMealsToday.has(selectedFood?.type) && { color: COLORS.disabled }
                  ]}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  autoFocus
                  editable={!isRegistering && !registeredMealsToday.has(selectedFood?.type)}
                />
                <Text style={styles.unitSmall}>
                  {selectedFood?.unit?.toUpperCase() || 'G'}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.btnConfirm,
                  (!amount || isRegistering || registeredMealsToday.has(selectedFood?.type)) && { backgroundColor: COLORS.border }
                ]}
                disabled={!amount || isRegistering || registeredMealsToday.has(selectedFood?.type)}
                onPress={confirmRegister}
              >
                {isRegistering ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.btnText}>CONFIRMAR REGISTRO</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!isRegistering) {
                    setSelectedFood(null);
                    setAmount('');
                  }
                }}
                style={styles.btnCancel}
                disabled={isRegistering}
              >
                <Text style={[styles.btnCancelText, isRegistering && { color: COLORS.disabled }]}>
                  CERRAR
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 10 : 40,
    paddingBottom: 15,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  headerIcon: { padding: 5 },
  brandContainer: { alignItems: 'center' },
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  underlineSmall: {
    width: 30,
    height: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    marginTop: 2,
  },
  pointsPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pointsVal: { fontWeight: '900', color: COLORS.white, fontSize: 13 },

  navBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 5,
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 3,
  },
  navItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  navItemActive: { backgroundColor: COLORS.primary },
  navText: { fontWeight: '800', color: COLORS.textLight, fontSize: 10 },
  navTextActive: { color: COLORS.white },

  daysBarWrapper: {
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  daysBarContent: {
    paddingHorizontal: 16,
  },
  dayChip: {
    width: 44,
    height: 44,
    marginRight: 10,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 11, fontWeight: '900', color: COLORS.textLight },

  planContainer: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: COLORS.secondary,
    paddingTop: 15,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textDark,
    marginBottom: 15,
  },
  mealSection: { marginBottom: 20 },
  mealTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  foodItem: {
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  disabledItem: {
    backgroundColor: COLORS.disabled,
    opacity: 0.7,
  },
  foodContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 14, fontWeight: '900', color: COLORS.textDark },
  foodDesc: { fontSize: 11, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  foodNutrient: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
    fontStyle: 'italic',
  },
  foodHorario: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '700',
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ptsValue: { fontWeight: '900', color: COLORS.primary, fontSize: 13 },
  ptsLabel: { fontSize: 8, color: COLORS.primary, fontWeight: '700' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  historyItem: {
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyMealSection: { marginBottom: 14 },
  historyMealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyMealIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginRight: 8,
  },
  historyMealTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  historyContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyInfo: { flex: 1 },
  historyFoodName: { fontSize: 14, fontWeight: '900', color: COLORS.textDark },
  historyDetail: { fontSize: 11, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  historyNutrient: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
    fontStyle: 'italic',
  },
  historyStats: { flexDirection: 'row', gap: 12 },
  historyStatItem: {
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyKcal: { fontWeight: '900', color: COLORS.kcalBar, fontSize: 12 },
  historyPts: { fontWeight: '900', color: COLORS.ptsBar, fontSize: 12 },
  historyStatLabel: { fontSize: 8, color: COLORS.textLight, fontWeight: '700' },

  progressSection: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressLabel: { fontSize: 12, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.8 },
  progressValue: { fontSize: 13, fontWeight: '800', color: COLORS.textDark },
  progressBar: {
    width: '100%',
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: COLORS.kcalBar },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressInfo: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  progressPercent: { fontSize: 12, fontWeight: '900', color: COLORS.primary },

  calorieCardsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  calorieCard: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  calorieCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  calorieCardValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.kcalBar,
  },

  pointsCardsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  pointsCardSmall: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  pointsCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  pointsCardValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ptsBar,
  },

  summarySection: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryTitle: { fontSize: 14, fontWeight: '900', color: COLORS.textDark, marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: '900', color: COLORS.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    alignItems: 'center',
  },
  sheetName: { fontSize: 22, fontWeight: '900', color: COLORS.textDark },
  sheetLimit: { fontSize: 12, color: COLORS.primary, fontWeight: '800', marginTop: 5 },
  inputArea: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 30 },
  inputMassive: { fontSize: 60, fontWeight: '900', color: COLORS.primary },
  unitSmall: { fontSize: 18, fontWeight: '700', marginLeft: 10, color: COLORS.textLight },
  btnConfirm: {
    width: '100%',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
  btnCancel: { marginTop: 10 },
  btnCancelText: { color: COLORS.textLight, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 20, color: COLORS.textLight },
  
  // Loading styles
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafContainer: {
    marginBottom: 30,
  },
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
  
  // Estilos para cuando no hay dieta
  noDietContainer: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noDietIcon: {
    marginBottom: 15,
  },
  noDietTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  noDietText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  noDietButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 15,
  },
  noDietButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },

  // Estilos para días bloqueados
  blockedDayContainer: {
    backgroundColor: COLORS.white,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  blockedDayTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textLight,
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  blockedDayText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },

  infoContainer: {
    backgroundColor: COLORS.white,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});