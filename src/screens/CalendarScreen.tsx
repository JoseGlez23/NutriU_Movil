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

// Zona horaria San Luis Río Colorado, Sonora
const TIMEZONE = 'America/Hermosillo';
const SONORA_TO_UTC_OFFSET_HOURS = 7;

const APPOINTMENT_TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
];
const BLOCKING_APPOINTMENT_STATES = ['pendiente', 'confirmada'];

const pad2 = (value: number) => String(value).padStart(2, '0');

const parseDbTimestampAsUtc = (value: string) => {
  const baseValue = String(value || '').trim().replace(' ', 'T');
  const hasTimezone = /([zZ]|[+\-]\d{2}(?::?\d{2})?)$/.test(baseValue);

  if (hasTimezone) {
    return new Date(baseValue);
  }

  const match = baseValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
  if (!match) {
    return new Date(`${baseValue}Z`);
  }

  const [, year, month, day, hour, minute, second = '00', millis = '0'] = match;
  const milliseconds = Number(millis.padEnd(3, '0'));

  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds,
  ));
};

const getSonoraNowParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || '00';

  const year = Number(getPart('year'));
  const month = Number(getPart('month'));
  const day = Number(getPart('day'));
  const hour = Number(getPart('hour'));
  const minute = Number(getPart('minute'));

  return {
    year,
    month,
    day,
    hour,
    minute,
    dateKey: `${year}-${pad2(month)}-${pad2(day)}`,
  };
};

const toUtcIsoFromSonoraDateTime = (
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
) => {
  const utcMs = Date.UTC(year, monthIndex, day, hour + SONORA_TO_UTC_OFFSET_HOURS, minute, second);
  return new Date(utcMs).toISOString();
};

const getSonoraDateKeyFromISO = (isoDate: string) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parseDbTimestampAsUtc(isoDate));
};

const getSonoraHourMinuteFromISO = (isoDate: string) => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parseDbTimestampAsUtc(isoDate));
};

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
  const sonoraNowAtLoad = getSonoraNowParts();
  const [currentMonthIndex, setCurrentMonthIndex] = useState(sonoraNowAtLoad.month - 1);
  const [currentYear, setCurrentYear] = useState(sonoraNowAtLoad.year);
  const [availableHours24, setAvailableHours24] = useState<string[]>([]); // ej: ["08:00", "08:30", ..., "17:00"]

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const sonoraNow = getSonoraNowParts();
  const currentDay = sonoraNow.day;
  const currentMonthNum = sonoraNow.month - 1;
  const currentYearNum = sonoraNow.year;
  const todayKey = sonoraNow.dateKey;
  const maxScheduleDate = new Date(currentYearNum + 1, currentMonthNum, currentDay);
  const maxMonthDate = new Date(maxScheduleDate.getFullYear(), maxScheduleDate.getMonth(), 1);
  const minMonthDate = new Date(currentYearNum, currentMonthNum, 1);

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

    const nowInSonora = getSonoraNowParts();
    const selectedDateKey = `${currentYear}-${pad2(currentMonthIndex + 1)}-${pad2(Number(selectedDate))}`;
    const isTodayInSonora = selectedDateKey === nowInSonora.dateKey;

    const hoursList = APPOINTMENT_TIME_SLOTS.filter((slot) => {
      if (!isTodayInSonora) return true;

      const [slotHour, slotMinute] = slot.split(':').map(Number);
      const nowMinutes = nowInSonora.hour * 60 + nowInSonora.minute;
      const slotMinutes = slotHour * 60 + slotMinute;
      return slotMinutes > nowMinutes;
    });

    setAvailableHours24(hoursList);
  }, [selectedDate, currentMonthIndex, currentYear]);

  useEffect(() => {
    const fetchOccupiedDays = async () => {
      if (!doctorId) return;

      try {
        const monthStartUtcIso = toUtcIsoFromSonoraDateTime(currentYear, currentMonthIndex, 1, 0, 0, 0);
        const monthEndUtcIso = toUtcIsoFromSonoraDateTime(
          currentYear,
          currentMonthIndex,
          new Date(currentYear, currentMonthIndex + 1, 0).getDate(),
          23,
          59,
          59,
        );

        const { data, error } = await supabase
          .from('citas')
          .select('fecha_hora, estado')
          .eq('id_nutriologo', doctorId)
          .in('estado', BLOCKING_APPOINTMENT_STATES)
          .gte('fecha_hora', monthStartUtcIso)
          .lte('fecha_hora', monthEndUtcIso);

        if (error) throw error;

        const occupiedByDate = new Map<string, Set<string>>();

        (data || []).forEach((cita) => {
          const dateKey = getSonoraDateKeyFromISO(cita.fecha_hora);
          const hourMinute = getSonoraHourMinuteFromISO(cita.fecha_hora);

          if (!APPOINTMENT_TIME_SLOTS.includes(hourMinute)) return;

          if (!occupiedByDate.has(dateKey)) {
            occupiedByDate.set(dateKey, new Set<string>());
          }

          occupiedByDate.get(dateKey)!.add(hourMinute);
        });

        const fullOccupiedDays = Array.from(occupiedByDate.entries())
          .filter(([, hours]) => hours.size >= APPOINTMENT_TIME_SLOTS.length)
          .map(([dateKey]) => Number(dateKey.split('-')[2]));

        setOccupiedDays(fullOccupiedDays);
      } catch (err) {
        console.error('Error al cargar días ocupados:', err);
      }
    };

    fetchOccupiedDays();
  }, [doctorId, currentMonthIndex, currentYear]);

  useEffect(() => {
    const fetchOccupiedHours = async () => {
      if (!selectedDate || !doctorId) return;

      const selectedDay = Number(selectedDate);
      const startOfDay = toUtcIsoFromSonoraDateTime(currentYear, currentMonthIndex, selectedDay, 0, 0, 0);
      const endOfDay = toUtcIsoFromSonoraDateTime(currentYear, currentMonthIndex, selectedDay, 23, 59, 59);

      try {
        const { data, error } = await supabase
          .from('citas')
          .select('fecha_hora, estado')
          .eq('id_nutriologo', doctorId)
          .gte('fecha_hora', startOfDay)
          .lte('fecha_hora', endOfDay)
          .in('estado', BLOCKING_APPOINTMENT_STATES);

        if (error) throw error;

        const occupied = data?.map(cita => {
          return getSonoraHourMinuteFromISO(cita.fecha_hora);
        }).filter((hourMinute) => APPOINTMENT_TIME_SLOTS.includes(hourMinute)) || [];
        setOccupiedHours24([...new Set(occupied)]);
      } catch (err) {
        console.error('Error al cargar horas ocupadas:', err);
      }
    };

    fetchOccupiedHours();
  }, [selectedDate, doctorId, currentMonthIndex, currentYear]);

  useEffect(() => {
    if (selectedHour24 && occupiedHours24.includes(selectedHour24)) {
      setSelectedHour24(null);
    }
  }, [occupiedHours24, selectedHour24]);

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
    const prevMonthDate = new Date(currentYear, currentMonthIndex - 1, 1);
    if (prevMonthDate < minMonthDate) {
      return;
    }

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
    const selectedDateKey = `${currentYear}-${pad2(currentMonthIndex + 1)}-${pad2(day)}`;
    const maxDateKey = `${maxScheduleDate.getFullYear()}-${pad2(maxScheduleDate.getMonth() + 1)}-${pad2(maxScheduleDate.getDate())}`;

    if (selectedDateKey > maxDateKey) {
      Alert.alert('Atención', 'Solo puedes agendar citas hasta 1 año a partir de hoy.');
      return;
    }

    if (selectedDateKey < todayKey) {
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

      // Bloqueo de horas pasadas si es hoy
      const nowInSonora = getSonoraNowParts();
      const selectedDateKey = `${currentYear}-${pad2(currentMonthIndex + 1)}-${pad2(Number(selectedDate))}`;
      const isToday = selectedDateKey === nowInSonora.dateKey;

      if (isToday) {
        const currentHour = nowInSonora.hour;
        const currentMinute = nowInSonora.minute;
        if (hour24 < currentHour || 
            (hour24 === currentHour && minute <= currentMinute)) {
          Alert.alert('Hora no válida', 'No puedes agendar en una hora que ya pasó o es la actual.');
          return;
        }
      }

      // Bloqueo de horario no permitido
      if (!APPOINTMENT_TIME_SLOTS.includes(selectedHour24!)) {
        Alert.alert('Horario fuera de servicio', 'La clínica atiende de 08:00 a 17:00.');
        return;
      }

      // Bloqueo por hora ocupada
      if (occupiedHours24.includes(selectedHour24!)) {
        setSelectedHour24(null);
        return;
      }

      const selectedDateObj = new Date(currentYear, currentMonthIndex, parseInt(selectedDate!, 10));
      if (selectedDateObj > maxScheduleDate) {
        Alert.alert('Fecha fuera de rango', 'Solo puedes agendar citas hasta 1 año a partir de hoy.');
        return;
      }

      const fechaHoraISO = toUtcIsoFromSonoraDateTime(
        currentYear,
        currentMonthIndex,
        parseInt(selectedDate!, 10),
        hour24,
        minute,
        0,
      );


      const slotEndISO = new Date(new Date(fechaHoraISO).getTime() + 30 * 60 * 1000).toISOString();

      const { data: existingAppointments, error: existingAppointmentsError } = await supabase
        .from('citas')
        .select('id_cita, fecha_hora, estado')
        .eq('id_nutriologo', doctorId)
        .in('estado', BLOCKING_APPOINTMENT_STATES)
        .gte('fecha_hora', fechaHoraISO)
        .lt('fecha_hora', slotEndISO)
        .limit(1);

      if (existingAppointmentsError) {
        throw existingAppointmentsError;
      }

      if ((existingAppointments || []).length > 0) {
        setSelectedHour24(null);
        await (async () => {
          const selectedDay = Number(selectedDate);
          const startOfDay = toUtcIsoFromSonoraDateTime(currentYear, currentMonthIndex, selectedDay, 0, 0, 0);
          const endOfDay = toUtcIsoFromSonoraDateTime(currentYear, currentMonthIndex, selectedDay, 23, 59, 59);

          const { data } = await supabase
            .from('citas')
            .select('fecha_hora, estado')
            .eq('id_nutriologo', doctorId)
            .gte('fecha_hora', startOfDay)
            .lte('fecha_hora', endOfDay)
            .in('estado', BLOCKING_APPOINTMENT_STATES);

          const occupied = data?.map(cita => getSonoraHourMinuteFromISO(cita.fecha_hora)).filter((hourMinute) => APPOINTMENT_TIME_SLOTS.includes(hourMinute)) || [];
          setOccupiedHours24([...new Set(occupied)]);
        })();
        return;
      }

      console.log('Enviando fecha a Supabase (UTC):', fechaHoraISO);

      const { data: citaInsertada, error } = await supabase
        .from('citas')
        .insert({
          id_paciente: patientData.id_paciente,
          id_nutriologo: doctorId,
          fecha_hora: fechaHoraISO,
          estado: 'pendiente',
          duracion_minutos: 60,
          tipo_cita: 'presencial',
          motivo_consulta: 'Consulta inicial',
        })
        .select('id_cita')
        .single();

      if (error || !citaInsertada?.id_cita) {
        console.error('Error creando cita:', error);
        Alert.alert('Error', 'No se pudo reservar la cita. Intenta nuevamente.');
        return;
      }

      const citaId = citaInsertada.id_cita;

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
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={styles.navButton}
              disabled={new Date(currentYear, currentMonthIndex - 1, 1) < minMonthDate}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={new Date(currentYear, currentMonthIndex - 1, 1) < minMonthDate ? COLORS.textLight : COLORS.primary}
              />
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
            <Text style={styles.hourTitle}>Horarios disponibles (08:00 a 17:00)</Text>
            
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
                      onPress={() => setSelectedHour24(hour24)}
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