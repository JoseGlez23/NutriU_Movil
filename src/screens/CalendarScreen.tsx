import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, SafeAreaView, StatusBar,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';

const { width } = Dimensions.get('window');

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

// Zona horaria Sonora (MST UTC-7 sin horario de verano)
const TIMEZONE = 'America/Hermosillo';

// Horario de la clínica en formato 24h
const CLINIC_OPEN_HOUR = 7;   // 07:00
const CLINIC_CLOSE_HOUR = 16; // 16:00 (hasta 15:59 permitido)

export default function CalendarScreen({ navigation, route }: any) {
  const { doctorName, doctorId, precio } = route.params || { 
    doctorName: 'el especialista seleccionado', 
    doctorId: null,
    precio: 800 
  };
  
  const { user: patientData } = useUser();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHour24, setSelectedHour24] = useState<string | null>(null); // ej: "13:30"
  const [occupiedDays, setOccupiedDays] = useState<number[]>([]);
  const [occupiedHours24, setOccupiedHours24] = useState<string[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [availableHours24, setAvailableHours24] = useState<string[]>([]); // ej: ["07:00", "07:30", ..., "15:30"]

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthNum = today.getMonth();
  const currentYearNum = today.getFullYear();
  const maxScheduleDate = new Date(currentYearNum + 1, currentMonthNum, currentDay);

  const currentMonth = {
    month: months[currentMonthIndex],
    year: currentYear.toString(),
    days: new Date(currentYear, currentMonthIndex + 1, 0).getDate(),
    startDay: new Date(currentYear, currentMonthIndex, 1).getDay()
  };

  // Generar horas disponibles en formato 24h (solo futuras y dentro de horario)
  useEffect(() => {
    if (!selectedDate) {
      setAvailableHours24([]);
      return;
    }

    const selectedFullDate = new Date(currentYear, currentMonthIndex, parseInt(selectedDate));
    const now = new Date();
    const isToday = selectedFullDate.toDateString() === now.toDateString();

    const hoursList: string[] = [];

    for (let h = CLINIC_OPEN_HOUR; h < CLINIC_CLOSE_HOUR; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hourDate = new Date(selectedFullDate);
        hourDate.setHours(h, m, 0, 0);

        if (isToday && hourDate <= now) continue;

        const hourStr = hourDate.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        hoursList.push(hourStr);
      }
    }

    setAvailableHours24(hoursList);
  }, [selectedDate, currentMonthIndex, currentYear]);

  useEffect(() => {
    const fetchOccupiedDays = async () => {
      if (!doctorId) return;

      try {
        const { data, error } = await supabase
          .from('citas')
          .select('fecha_hora')
          .eq('id_nutriologo', doctorId)
          .eq('estado', 'confirmada');

        if (error) throw error;

        const occupied = data?.map(cita => new Date(cita.fecha_hora).getDate()) || [];
        setOccupiedDays([...new Set(occupied)]);
      } catch (err) {
        console.error('Error al cargar días ocupados:', err);
      }
    };

    fetchOccupiedDays();
  }, [doctorId, currentMonthIndex, currentYear]);

  useEffect(() => {
    const fetchOccupiedHours = async () => {
      if (!selectedDate || !doctorId) return;

      const selectedFullDate = new Date(currentYear, currentMonthIndex, parseInt(selectedDate));
      const startOfDay = selectedFullDate.toISOString().split('T')[0] + 'T00:00:00';
      const endOfDay = selectedFullDate.toISOString().split('T')[0] + 'T23:59:59';

      try {
        const { data, error } = await supabase
          .from('citas')
          .select('fecha_hora')
          .eq('id_nutriologo', doctorId)
          .gte('fecha_hora', startOfDay)
          .lte('fecha_hora', endOfDay)
          .eq('estado', 'confirmada');

        if (error) throw error;

        const occupied = data?.map(cita => {
          const date = new Date(cita.fecha_hora);
          return date.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        }) || [];
        setOccupiedHours24([...new Set(occupied)]);
      } catch (err) {
        console.error('Error al cargar horas ocupadas:', err);
      }
    };

    fetchOccupiedHours();
  }, [selectedDate, doctorId, currentMonthIndex, currentYear]);

  const generateCalendarDays = () => {
    const days = [];
    for (let i = 0; i < currentMonth.startDay; i++) {
      days.push({ day: '', empty: true, occupied: false });
    }
    for (let i = 1; i <= currentMonth.days; i++) {
      days.push({ day: i, empty: false, occupied: occupiedDays.includes(i) });
    }
    return days;
  };

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonthIndex(currentMonthIndex - 1);
    }
    setSelectedDate(null);
    setSelectedHour24(null);
  };

  const handleNextMonth = () => {
    const nextMonthDate = new Date(currentYear, currentMonthIndex + 1, 1);
    const maxMonthDate = new Date(maxScheduleDate.getFullYear(), maxScheduleDate.getMonth(), 1);
    if (nextMonthDate > maxMonthDate) {
      return;
    }

    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonthIndex(currentMonthIndex + 1);
    }
    setSelectedDate(null);
    setSelectedHour24(null);
  };

  const isSunday = (day: number) => {
    const date = new Date(currentYear, currentMonthIndex, day);
    return date.getDay() === 0;
  };

  const handleDayPress = (day: number) => {
    const selectedFullDate = new Date(currentYear, currentMonthIndex, day);
    const todayDate = new Date(currentYearNum, currentMonthNum, currentDay);

    if (selectedFullDate > maxScheduleDate) {
      Alert.alert('Atención', 'Solo puedes agendar citas hasta 1 año a partir de hoy.');
      return;
    }

    if (selectedFullDate < todayDate) {
      Alert.alert('Atención', 'No puedes agendar citas en fechas pasadas.');
      return;
    }

    if (isSunday(day)) {
      Alert.alert('Atención', 'El consultorio está cerrado los domingos.');
      return;
    }

    if (day && !occupiedDays.includes(day)) {
      setSelectedDate(day.toString());
      setSelectedHour24(null);
    }
  };

  const handleHourPress = (hour24: string) => {
    if (occupiedHours24.includes(hour24)) {
      Alert.alert('Hora no disponible', 'Esta hora ya está ocupada por otro paciente.');
      return;
    }
    setSelectedHour24(hour24);
  };

  const scheduleAppointment = () => {
    if (!selectedDate || !selectedHour24) {
      Alert.alert('Atención', 'Por favor selecciona un día y una hora disponibles.');
      return;
    }

    confirmFinalAppointment();
  };

  const confirmFinalAppointment = async () => {
    if (!patientData?.id_paciente) {
      Alert.alert('Error', 'No se pudo identificar al paciente. Inicia sesión nuevamente.');
      return;
    }

    try {
      // Parsear hora 24h seleccionada (ej: "13:30" → hour24 = 13, minute = 30)
      const [hourStr, minuteStr] = selectedHour24!.split(':');
      const hour24 = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      // Log para depurar
      console.log('Hora seleccionada (24h):', selectedHour24);
      console.log('Hora:', hour24, 'Minutos:', minute);

      // Validación de horario - comparación directa
      const openHour = CLINIC_OPEN_HOUR;
      const closeHour = CLINIC_CLOSE_HOUR;

      // Bloqueo de horas pasadas si es hoy
      const now = new Date();
      const isToday = selectedDate === now.getDate().toString() && 
                      currentMonthIndex === now.getMonth() && 
                      currentYear === now.getFullYear();

      if (isToday) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        if (hour24 < currentHour || 
            (hour24 === currentHour && minute <= currentMinute)) {
          Alert.alert('Hora no válida', 'No puedes agendar en una hora que ya pasó o es la actual.');
          return;
        }
      }

      // Bloqueo fuera de horario (permite hasta 15:59)
      if (hour24 < openHour || hour24 > closeHour || 
          (hour24 === closeHour && minute > 0)) {
        Alert.alert('Horario fuera de servicio', 'La clínica atiende de 7:00 a 16:00.');
        return;
      }

      // Crear fecha local
      const fechaHoraLocal = new Date(currentYear, currentMonthIndex, parseInt(selectedDate!), hour24, minute);

      if (fechaHoraLocal > maxScheduleDate) {
        Alert.alert('Fecha fuera de rango', 'Solo puedes agendar citas hasta 1 año a partir de hoy.');
        return;
      }

      // Formato ISO manual
      const year = fechaHoraLocal.getFullYear();
      const month = String(fechaHoraLocal.getMonth() + 1).padStart(2, '0');
      const day = String(fechaHoraLocal.getDate()).padStart(2, '0');
      const hours = String(fechaHoraLocal.getHours()).padStart(2, '0');
      const minutes = String(fechaHoraLocal.getMinutes()).padStart(2, '0');

      const fechaHoraISO = `${year}-${month}-${day}T${hours}:${minutes}:00`;

      console.log('Enviando fecha a Supabase:', fechaHoraISO);

      // Crear cita
      const { data: citaResult, error } = await supabase.rpc('crear_cita_pendiente', {
        p_id_paciente: patientData.id_paciente,
        p_id_nutriologo: doctorId,
        p_fecha_hora: fechaHoraISO,
        p_tipo_cita: 'presencial',
        p_motivo: 'Consulta inicial',
      });

      if (error || !citaResult) {
        console.error('Error creando cita con RPC:', error);
        Alert.alert('Error', 'No se pudo reservar la cita. Intenta nuevamente.');
        return;
      }

      const citaId = citaResult;

      // Navegar a pago sin alerta
      navigation.navigate('Schedule', {
        citaId,
        doctorName,
        doctorId,
        precio: precio || 800,
      });

    } catch (err: any) {
      console.error('Error al crear cita:', err);
      Alert.alert('Error', 'Ocurrió un problema inesperado: ' + err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>CALENDARIO</Text>
          <View style={styles.underlineSmall} />
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.doctorInfoCard}>
          <Ionicons name="medical" size={20} color={COLORS.primary} />
          <Text style={styles.doctorText}>Cita con: <Text style={styles.bold}>{doctorName}</Text></Text>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{currentMonth.month} {currentMonth.year}</Text>
            <TouchableOpacity
              onPress={handleNextMonth}
              style={styles.navButton}
              disabled={new Date(currentYear, currentMonthIndex + 1, 1) > new Date(maxScheduleDate.getFullYear(), maxScheduleDate.getMonth(), 1)}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={new Date(currentYear, currentMonthIndex + 1, 1) > new Date(maxScheduleDate.getFullYear(), maxScheduleDate.getMonth(), 1) ? COLORS.textLight : COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.weekDaysContainer}>
            {daysOfWeek.map((day) => (
              <Text key={day} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {generateCalendarDays().map((item, index) => {
              const dayNum = item.day as number;
              const dayDate = new Date(currentYear, currentMonthIndex, dayNum);
              const isPast = (currentYear < currentYearNum) || 
                            (currentYear === currentYearNum && currentMonthIndex < currentMonthNum) || 
                            (currentYear === currentYearNum && currentMonthIndex === currentMonthNum && dayNum < currentDay);
              const isBeyondMaxDate = !item.empty && dayDate > maxScheduleDate;
              const isSundayDay = isSunday(dayNum);
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    item.empty && styles.emptyDay,
                    item.occupied && styles.occupiedDay,
                    !item.empty && selectedDate === item.day?.toString() && styles.selectedDay,
                    isPast && styles.pastDay,
                    isBeyondMaxDate && styles.pastDay,
                    isSundayDay && styles.occupiedDay
                  ]}
                  onPress={() => !item.empty && !item.occupied && !isPast && !isBeyondMaxDate && !isSundayDay && handleDayPress(dayNum)}
                  disabled={item.empty || item.occupied || isPast || isBeyondMaxDate || isSundayDay}
                >
                  {!item.empty && (
                    <>
                      <Text style={[
                        styles.dayText,
                        item.occupied && styles.occupiedDayText,
                        selectedDate === item.day?.toString() && styles.selectedDayText,
                        isPast && styles.occupiedDayText,
                        isBeyondMaxDate && styles.occupiedDayText,
                        isSundayDay && styles.occupiedDayText
                      ]}>
                        {item.day}
                      </Text>
                      {(item.occupied || isSundayDay) && <View style={styles.occupiedDot} />}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedDate && (
          <View style={styles.hourPickerContainer}>
            <Text style={styles.hourTitle}>Horarios disponibles (24h)</Text>
            
            {availableHours24.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
                {availableHours24.map((hour24) => {
                  const isOccupied = occupiedHours24.includes(hour24);
                  return (
                    <TouchableOpacity
                      key={hour24}
                      style={[
                        styles.hourButton,
                        selectedHour24 === hour24 && styles.selectedHourButton,
                        isOccupied && styles.occupiedHourButton
                      ]}
                      onPress={() => !isOccupied && setSelectedHour24(hour24)}
                      disabled={isOccupied}
                    >
                      <Text style={[
                        styles.hourText,
                        selectedHour24 === hour24 && styles.selectedHourText,
                        isOccupied && styles.occupiedHourText
                      ]}>
                        {hour24}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: COLORS.error, textAlign: 'center', marginTop: 10 }}>
                No hay horarios disponibles para este día.
              </Text>
            )}
          </View>
        )}

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: COLORS.primary}]} /><Text style={styles.legendText}>Disponible</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#E2E8F0'}]} /><Text style={styles.legendText}>Ocupado</Text></View>
        </View>

        <TouchableOpacity 
          style={[styles.mainButton, (!selectedDate || !selectedHour24) && styles.disabledButton]} 
          onPress={scheduleAppointment}
          disabled={!selectedDate || !selectedHour24}
        >
          <Text style={styles.mainButtonText}>CONFIRMAR CITA</Text>
        </TouchableOpacity>
      </ScrollView>
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

  scrollContent: { padding: 20 },
  doctorInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 20
  },
  doctorText: { marginLeft: 10, fontSize: 14, color: COLORS.textDark, fontWeight: '600' },
  bold: { fontWeight: '900', color: COLORS.primary },

  calendarCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 20
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  navButton: { padding: 8 },
  monthTitle: { fontSize: 20, fontWeight: '900', color: COLORS.primary, textAlign: 'center' },
  weekDaysContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  weekDayText: { width: '14%', textAlign: 'center', fontSize: 12, fontWeight: '900', color: COLORS.textLight },
  
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayButton: {
    width: '14.28%',
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    borderRadius: 12,
  },
  emptyDay: { backgroundColor: 'transparent' },
  occupiedDay: { backgroundColor: '#F1F5F9', opacity: 0.6 },
  selectedDay: { backgroundColor: COLORS.primary },
  pastDay: { backgroundColor: '#E5E7EB', opacity: 0.6 },
  dayText: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  occupiedDayText: { color: '#94A3B8', textDecorationLine: 'line-through' },
  selectedDayText: { color: COLORS.white, fontWeight: '900' },
  occupiedDot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.error },

  hourPickerContainer: { marginBottom: 20 },
  hourTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 10 },
  hourScroll: { marginTop: 10 },
  hourButton: { 
    backgroundColor: COLORS.secondary, 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 12, 
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 90,
    alignItems: 'center'
  },
  selectedHourButton: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  occupiedHourButton: { backgroundColor: '#E5E7EB', opacity: 0.6 },
  hourText: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  selectedHourText: { color: COLORS.white },
  occupiedHourText: { color: COLORS.textLight },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },

  mainButton: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 18, alignItems: 'center' },
  disabledButton: { backgroundColor: '#CBD5E1' },
  mainButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
});