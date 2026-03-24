import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  StatusBar, 
  Modal, 
  ActivityIndicator, 
  Dimensions,
  Image, 
  Alert, 
  Animated, 
  Easing,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNutriologo } from '../context/NutriologoContext';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import NetInfo from '@react-native-community/netinfo';
import { saveToCache, getFromCache } from '../utils/offlineCache';
import { useNetwork } from '../utils/NetworkHandler';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#D1E8D5',
  card: '#FFFFFF',
  warning: '#FFA500',
  danger: '#FF4444',
  success: '#4CAF50',
  pending: '#FFC107',
  pendingLight: '#FFF3CD',
  info: '#17A2B8',
  infoLight: '#E3F2FD',
  pendingPayment: '#FF9800',
  pendingPaymentLight: '#FFF3E0',
  paid: '#2196F3',
  paidLight: '#E3F2FD',
};

const PAYMENT_COLORS = {
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  border: '#DEE2E6',
  label: '#212529',
  placeholder: '#6C757D',
  button: '#0D6EFD',
  buttonText: '#FFFFFF',
  error: '#DC3545',
};

const SONORA_TIMEZONE = 'America/Phoenix';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://servidor-nutri-u.vercel.app';

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

const CLINIC_OPEN_HOUR = 7;
const CLINIC_CLOSE_HOUR = 16;

const roundCurrency = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const inferDiscountPercentFromReward = (reward: any) => {
  const text = `${reward?.descripcion || ''} ${reward?.nombre || ''}`;
  const match = String(text).match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) return Number(match[1]);
  return 10;
};

const getCanjePreview = (basePrice: number, canjePaciente: any) => {
  const montoOriginal = roundCurrency(Number(basePrice || 0));

  if (!canjePaciente?.canjes) {
    return {
      montoOriginal,
      descuentoAplicado: 0,
      montoFinal: montoOriginal,
      descripcion: null,
      eligible: true,
      ineligibleReason: null,
    };
  }

  const canje = canjePaciente.canjes;
  const montoMinimo = canje.monto_minimo_consulta ? Number(canje.monto_minimo_consulta) : null;
  if (montoMinimo && montoOriginal < montoMinimo) {
    return {
      montoOriginal,
      descuentoAplicado: 0,
      montoFinal: montoOriginal,
      descripcion: null,
      eligible: false,
      ineligibleReason: `Disponible para consultas desde $${montoMinimo.toFixed(2)} MXN`,
    };
  }

  if (canje.tipo_canje === 'descuento') {
    const descuentoTeorico = montoOriginal * (Number(canje.valor_descuento || 0) / 100);
    const descuentoAplicado = roundCurrency(Math.min(descuentoTeorico, Math.max(0, montoOriginal - 1)));
    return {
      montoOriginal,
      descuentoAplicado,
      montoFinal: roundCurrency(Math.max(1, montoOriginal - descuentoAplicado)),
      descripcion: `${canje.valor_descuento}% de descuento`,
      eligible: true,
      ineligibleReason: null,
    };
  }

  const descuentoAplicado = roundCurrency(Math.max(0, montoOriginal - 1));
  return {
    montoOriginal,
    descuentoAplicado,
    montoFinal: roundCurrency(Math.max(1, montoOriginal - descuentoAplicado)),
    descripcion: 'Consulta bonificada',
    eligible: true,
    ineligibleReason: null,
  };
};

const logScheduleWarning = (message: string, error?: any) => {};

const buildReceiptPdfHtml = (receipt: any, logoBase64: string = '') => {
  const logoImg = logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" style="width: 80px; margin: 0 auto 10px; display: block;" />` : '';
  return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Comprobante NutriU</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #1a3026; background: #f5fbf7; }
      .card { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #d1e8d5; border-radius: 14px; overflow: hidden; }
      .header { background: #2e8b57; color: #fff; padding: 20px; }
      .header h1 { margin: 0; font-size: 21px; }
      .header p { margin: 6px 0 0; font-size: 13px; opacity: .95; }
      .section { padding: 16px 20px; border-bottom: 1px solid #e8f2eb; }
      .row { display: flex; justify-content: space-between; gap: 10px; margin: 8px 0; }
      .label { font-size: 13px; color: #4a4a4a; }
      .value { font-size: 13px; color: #1a3026; font-weight: 700; text-align: right; }
      .total { color: #2e8b57; font-size: 20px; font-weight: 900; }
      .footer { padding: 14px 20px; background: #f8fbf9; font-size: 12px; color: #4a4a4a; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        ${logoImg}
        <h1>Comprobante de pago - NutriU</h1>
        <p>Referencia Stripe: ${receipt.paymentIntentId || 'N/D'}</p>
      </div>
      <div class="section">
        <div class="row"><span class="label">Paciente</span><span class="value">${receipt.patientName || 'Paciente'}</span></div>
        <div class="row"><span class="label">Correo</span><span class="value">${receipt.patientEmail || 'N/D'}</span></div>
      </div>
      <div class="section">
        <div class="row"><span class="label">Nutriólogo</span><span class="value">${receipt.nutriologoName || 'Nutriólogo'}</span></div>
        <div class="row"><span class="label">Especialidad</span><span class="value">${receipt.nutriologoSpecialty || 'Nutrición'}</span></div>
        <div class="row"><span class="label">Fecha de la cita</span><span class="value">${receipt.appointmentDate || 'N/D'}</span></div>
      </div>
      <div class="section">
        <div class="row"><span class="label">Monto pagado</span><span class="value total">$${receipt.amount || '0.00'} MXN</span></div>
        <div class="row"><span class="label">Estado</span><span class="value">${receipt.paymentStatus || 'completado'}</span></div>
        <div class="row"><span class="label">Fecha de pago</span><span class="value">${receipt.paymentDate || 'N/D'}</span></div>
      </div>
      <div class="footer">Comprobante generado desde la app móvil NutriU.</div>
    </div>
  </body>
</html>`;
};

export default function ScheduleScreen({ navigation, route }: any) {
  const { user: authUser } = useAuth();
  const { user: patientData, refreshUser } = useUser();
  const { refreshNutriologo, nutriologo } = useNutriologo();
  const { notifyOffline } = useNetwork();

  const [viewMode, setViewMode] = useState('agendar');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'selection' | 'checkout' | 'success'>('selection');

  const [cardDetails, setCardDetails] = useState<any>(null);
  const [cardName, setCardName] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [citaId, setCitaId] = useState<number | null>(null);
  const [availableCanjes, setAvailableCanjes] = useState<any[]>([]);
  const [selectedCanjePaciente, setSelectedCanjePaciente] = useState<any | null>(null);
  const [loadingCanjes, setLoadingCanjes] = useState(false);

  // Separar citas pendientes en dos categorías
  const [pendingPaymentAppointments, setPendingPaymentAppointments] = useState<any[]>([]);
  const [paidPendingAppointments, setPaidPendingAppointments] = useState<any[]>([]);
  const [confirmedAppointments, setConfirmedAppointments] = useState<any[]>([]);
  const [activeRelationSince, setActiveRelationSince] = useState<string | null>(null);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);

  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [downloadingReceiptFor, setDownloadingReceiptFor] = useState<number | null>(null);

  const [nutriologoAssignedModal, setNutriologoAssignedModal] = useState(false);
  const [nutriologoInfoModal, setNutriologoInfoModal] = useState(false);
  const [nutriologoInfoMsg, setNutriologoInfoMsg] = useState('');

  const { confirmPayment } = useStripe();

  const paymentPreview = useMemo(() => {
    return getCanjePreview(Number(selectedDoctor?.price || 0), selectedCanjePaciente);
  }, [selectedDoctor?.price, selectedCanjePaciente]);

  const loadAvailableCanjes = useCallback(async (nutriologoId: number) => {
    if (!patientData?.id_paciente) {
      setAvailableCanjes([]);
      setSelectedCanjePaciente(null);
      return;
    }

    setLoadingCanjes(true);
    try {
      let query = supabase
        .from('canje_recompensas')
        .select(`
          id_canje,
          id_paciente,
          fecha_canje,
          estado,
          recompensas(
            id_recompensa,
            nombre,
            descripcion,
            tipo_recompensa,
            activa
          )
        `)
        .eq('id_paciente', patientData.id_paciente)
        .eq('estado', 'pendiente')
        .order('fecha_canje', { ascending: false });

      const { data: canjesPaciente, error } = await query;

      if (error) {
        setAvailableCanjes([]);
        setSelectedCanjePaciente(null);
        return;
      }

      const canjes = (canjesPaciente || [])
        .filter((item: any) => item?.recompensas && item.recompensas.activa !== false)
        .filter((item: any) => item.recompensas.tipo_recompensa === 'descuento')
        .map((item: any) => ({
          id_canje_paciente: item.id_canje,
          id_paciente: item.id_paciente,
          id_nutriologo: nutriologoId || selectedDoctor?.realId || null,
          estado: item.estado,
          canjes: {
            id_canje: item.recompensas.id_recompensa,
            nombre_canje: item.recompensas.nombre,
            tipo_canje: item.recompensas.tipo_recompensa === 'descuento' ? 'descuento' : 'consulta_gratis',
            valor_descuento: item.recompensas.tipo_recompensa === 'descuento'
              ? inferDiscountPercentFromReward(item.recompensas)
              : null,
            cantidad_consultas: 1,
            descripcion: item.recompensas.descripcion,
            monto_minimo_consulta: null,
          },
        }));

      setAvailableCanjes(canjes);

      setSelectedCanjePaciente((prevSelected: any) => {
        if (!prevSelected) return null;
        const stillExists = canjes.find(
          (item: any) => item.id_canje_paciente === prevSelected.id_canje_paciente,
        );
        return stillExists || null;
      });
    } catch (error) {
      setAvailableCanjes([]);
      setSelectedCanjePaciente(null);
    } finally {
      setLoadingCanjes(false);
    }
  }, [patientData?.id_paciente, selectedDoctor?.realId]);

  const lastNutriologoIdRef = useRef<number>(0);
  const lastProcessedRouteCitaIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (patientData?.id_paciente && lastNutriologoIdRef.current !== undefined) {
      loadAvailableCanjes(lastNutriologoIdRef.current);
    }
  }, [patientData?.id_paciente, loadAvailableCanjes]);

  const formatDoctors = (data: any[] = []) => {
    return data.map((d: any) => {
      const photoUrl = d.foto_perfil && d.foto_perfil.trim() !== '' && d.foto_perfil !== 'nutriologo_default.png'
        ? d.foto_perfil
        : null;

      return {
        id: d.id_nutriologo.toString(),
        name: `Dr. ${d.nombre} ${d.apellido}`,
        specialty: d.especialidad || 'Nutrición Clínica',
        price: d.tarifa_consulta || 800,
        realId: d.id_nutriologo,
        photoUrl,
      };
    });
  };

  useEffect(() => {
    const processIncomingCita = async () => {
      const incomingCitaId = Number(route.params?.citaId);
      if (incomingCitaId && lastProcessedRouteCitaIdRef.current !== incomingCitaId) {
        lastProcessedRouteCitaIdRef.current = incomingCitaId;
        setCitaId(incomingCitaId);
        
        let doctorId = Number(route.params.doctorId);
        let doctorPrice = Number(route.params.precio || 800);
        let doctorName = route.params.doctorName || 'Nutriólogo';

        // Si falta doctorId (viene desde notificación), obtener datos de la cita
        if (isNaN(doctorId) || doctorId === 0) {
          try {
            const { data: citaData, error } = await supabase
              .from('citas')
              .select(`
                id_nutriologo,
                nutriologos!inner (
                  nombre,
                  apellido,
                  tarifa_consulta
                )
              `)
              .eq('id_cita', incomingCitaId)
              .single();

            if (!error && citaData) {
              const nutri = Array.isArray(citaData.nutriologos) ? citaData.nutriologos[0] : citaData.nutriologos;
              if (nutri) {
                doctorId = citaData.id_nutriologo;
                doctorPrice = nutri.tarifa_consulta || 800;
                doctorName = `Dr. ${nutri.nombre} ${nutri.apellido}`;
              }
            }
          } catch (err) {
            // En caso de error, usar valores por defecto
          }
        }

        setSelectedDoctor({ 
          name: doctorName,
          realId: isNaN(doctorId) ? 0 : doctorId,
          price: doctorPrice,
          originalPrice: doctorPrice,
        });
        setSelectedCanjePaciente(null);
        const resolvedId = isNaN(doctorId) ? 0 : doctorId;
        lastNutriologoIdRef.current = resolvedId;
        loadAvailableCanjes(resolvedId);
        setPaymentStep('checkout');
      }
    };
    
    processIncomingCita();
  }, [loadAvailableCanjes, route.params]);

  useEffect(() => {
    const initialTab = route.params?.initialTab;
    if (initialTab && ['agendar', 'pendientes', 'confirmadas'].includes(initialTab)) {
      setViewMode(initialTab);
    }
  }, [route.params?.initialTab]);

  const pulseValue = useRef(new Animated.Value(1)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(0.5)).current;
  const textOpacityValue = useRef(new Animated.Value(0.3)).current;
  const bounceValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading || appointmentsLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, { toValue: 1.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseValue, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateValue, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(rotateValue, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceValue, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bounceValue, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleValue, { toValue: 1.1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scaleValue, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityValue, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacityValue, { toValue: 0.5, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(textOpacityValue, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(textOpacityValue, { toValue: 0.3, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading, appointmentsLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    if (viewMode === 'agendar') {
      await fetchDoctors();
    } else {
      await fetchAppointments();
    }
    
    setRefreshing(false);
  }, [viewMode]);

  const fetchDoctors = async () => {
    const cacheKey = 'schedule_doctors';

    try {
      setLoading(true);

      const cachedDoctors = await getFromCache(cacheKey);
      if (Array.isArray(cachedDoctors) && cachedDoctors.length > 0) {
        setDoctors(cachedDoctors);
      }

      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
      if (!isOnline) {
        notifyOffline();
        if (!Array.isArray(cachedDoctors) || cachedDoctors.length === 0) {
          Alert.alert('Sin conexión', 'No hay internet para cargar nutriólogos y no hay datos guardados en este dispositivo.');
        }
        return;
      }

      const { data, error } = await supabase
        .from('nutriologos')
        .select('id_nutriologo, nombre, apellido, especialidad, tarifa_consulta, foto_perfil')
        .eq('activo', true)
        .order('nombre');

      if (error) {
        if (!Array.isArray(cachedDoctors) || cachedDoctors.length === 0) {
          Alert.alert('Error', 'No se pudieron cargar los nutriólogos. Intenta más tarde.');
        }
        return;
      }

      const formatted = formatDoctors(data || []);

      setDoctors(formatted);
      await saveToCache(cacheKey, formatted);
    } catch (err) {
      const cachedDoctors = await getFromCache('schedule_doctors');
      if (!Array.isArray(cachedDoctors) || cachedDoctors.length === 0) {
        Alert.alert('Error', 'No se pudieron cargar los nutriólogos. Intenta más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    if (!patientData?.id_paciente) return;

    if (!nutriologo?.id_nutriologo) {
      setActiveRelationSince(null);
      setPendingPaymentAppointments([]);
      setPaidPendingAppointments([]);
      setConfirmedAppointments([]);
      setAppointmentsLoading(false);
      return;
    }

    try {
      setAppointmentsLoading(true);

      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
      if (!isOnline) {
        notifyOffline();
        return;
      }

      // Obtener fecha de asignación ACTIVA para mostrar solo citas del ciclo actual
      const { data: relationData, error: relationError } = await supabase
        .from('paciente_nutriologo')
        .select('fecha_asignacion')
        .eq('id_paciente', patientData.id_paciente)
        .eq('id_nutriologo', nutriologo.id_nutriologo)
        .eq('activo', true)
        .order('fecha_asignacion', { ascending: false })
        .limit(1);

      if (relationError) {
        logScheduleWarning('', relationError);
        return;
      }

      const relationStartDate = relationData?.[0]?.fecha_asignacion || null;
      setActiveRelationSince(relationStartDate);

      if (!relationStartDate) {
        setPendingPaymentAppointments([]);
        setPaidPendingAppointments([]);
        setConfirmedAppointments([]);
        return;
      }

      const { data, error } = await supabase
        .from('citas')
        .select(`
          id_cita,
          fecha_hora,
          estado,
          metodo_pago,
          pagos!left (
            id_pago,
            estado,
            stripe_payment_id
          ),
          nutriologos!inner (
            id_nutriologo,
            nombre,
            apellido,
            especialidad,
            tarifa_consulta,
            foto_perfil
          )
        `)
        .eq('id_paciente', patientData.id_paciente)
        .eq('id_nutriologo', nutriologo.id_nutriologo)
        .in('estado', ['pendiente', 'pendiente_pagado', 'confirmada', 'completada'])
        .order('fecha_hora', { ascending: false });

      if (error) {
        logScheduleWarning('', error);
        return;
      }

      const relationStartMs = parseDbTimestampAsUtc(relationStartDate).getTime();

      const formatted = ((data || []).map(cita => {
        const nutri: any = Array.isArray(cita.nutriologos) ? cita.nutriologos[0] : cita.nutriologos;
        if (!nutri) return null;

        const fechaHora = parseDbTimestampAsUtc(cita.fecha_hora);

        const fecha = fechaHora.toLocaleDateString('es-MX', { 
          timeZone: SONORA_TIMEZONE,
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });

        const hora = fechaHora.toLocaleTimeString('es-MX', { 
          timeZone: SONORA_TIMEZONE,
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });

        const photoUrl = nutri.foto_perfil && nutri.foto_perfil.trim() !== '' && nutri.foto_perfil !== 'nutriologo_default.png'
          ? nutri.foto_perfil
          : null;

        // Determinar si tiene pago
        const pagos = Array.isArray(cita.pagos) ? cita.pagos : [];
        const tienePago = pagos.length > 0 && pagos[0]?.estado === 'completado';
        
        // Estado derivado para UI: "pendiente_pagado" = cita pagada en espera de confirmación.
        let estadoReal = cita.estado;
        if (cita.estado === 'pendiente' && tienePago) {
          estadoReal = 'pendiente_pagado';
        }

        return {
          id: cita.id_cita,
          doctorName: `Dr. ${nutri.nombre} ${nutri.apellido}`,
          doctorPhoto: photoUrl,
          fecha,
          hora,
          fechaHoraOriginal: cita.fecha_hora,
          monto: nutri.tarifa_consulta || 800,
          especialidad: nutri.especialidad || 'Nutrición Clínica',
          estado: estadoReal,
          estadoOriginal: cita.estado,
          id_nutriologo: nutri.id_nutriologo,
          isCurrentCycle: Number.isFinite(parseDbTimestampAsUtc(cita.fecha_hora).getTime())
            ? parseDbTimestampAsUtc(cita.fecha_hora).getTime() >= relationStartMs
            : false,
          tienePago,
          pagoInfo: pagos.length > 0 ? pagos[0] : null,
        };
      }) || []).filter((item): item is any => item !== null);

      // Separar citas pendientes - solo mostrar las del ciclo actual
      const pendingPayment = formatted.filter((a: any) => 
        a && a.estado === 'pendiente' && !a.tienePago && a.isCurrentCycle
      );
      
      const paidPending = formatted.filter((a: any) => 
        a && (a.estado === 'pendiente_pagado' || (a.estado === 'pendiente' && a.tienePago)) && a.isCurrentCycle
      );
      
      const confirmed = formatted.filter((a: any) => 
        a && (a.estado === 'confirmada' || a.estado === 'completada') && a.isCurrentCycle
      );

      const confirmedForActiveNutriologo = nutriologo
        ? confirmed.filter((a: any) => a.id_nutriologo === nutriologo.id_nutriologo)
        : [];

      setPendingPaymentAppointments(pendingPayment);
      setPaidPendingAppointments(paidPending);
      setConfirmedAppointments(confirmedForActiveNutriologo);
    } catch (err) {
      logScheduleWarning('', err);
      setActiveRelationSince(null);
      setPendingPaymentAppointments([]);
      setPaidPendingAppointments([]);
      setConfirmedAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [patientData?.id_paciente, nutriologo?.id_nutriologo]);

  useEffect(() => {
    if (!nutriologo) {
      setActiveRelationSince(null);
      setPendingPaymentAppointments([]);
      setPaidPendingAppointments([]);
      setConfirmedAppointments([]);
    }
  }, [nutriologo]);

  const handleSelectDoctor = async (doctor: any) => {
    if (nutriologo && nutriologo.id_nutriologo !== doctor.realId) {
      setNutriologoAssignedModal(true);
      return;
    }
    if (nutriologo && nutriologo.id_nutriologo === doctor.realId) {
      setSelectedDoctor(doctor);
      setNutriologoInfoModal(true);
      return;
    }
    navigation.navigate('Calendar', {
      doctorName: doctor.name,
      doctorId: doctor.realId,
      precio: doctor.price,
    });
  };

  const clearConfirmedAppointments = async () => {
    if (!patientData?.id_paciente || confirmedAppointments.length === 0) return;

    Alert.alert(
      'Limpiar confirmadas',
      'Se ocultarán de esta vista tus citas confirmadas/atendidas actuales. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            try {
              const confirmedIds = confirmedAppointments.map((a: any) => a.id).filter(Boolean);
              if (confirmedIds.length === 0) return;

              const { error } = await supabase
                .from('citas')
                .update({ estado: 'cancelada' })
                .in('id_cita', confirmedIds)
                .eq('id_paciente', patientData.id_paciente);

              if (error) throw error;

              await fetchAppointments();
              Alert.alert('Listo', 'Se limpiaron las citas confirmadas.');
            } catch (err) {
              Alert.alert('Error', 'No se pudieron limpiar las citas confirmadas.');
            }
          },
        },
      ]
    );
  };

  const handlePaymentFromPending = async (appointment: any) => {
    setSelectedDoctor({
      name: appointment.doctorName,
      realId: appointment.id_nutriologo,
      price: appointment.monto,
      originalPrice: appointment.monto,
    });
    setCitaId(appointment.id);
    setSelectedCanjePaciente(null);
    await loadAvailableCanjes(Number(appointment.id_nutriologo));
    setPaymentStep('checkout');
  };

  const downloadPaymentReceipt = async (appointment: any) => {
    const paymentIntentId = String(appointment?.pagoInfo?.stripe_payment_id || '').trim();
    if (!paymentIntentId) {
      Alert.alert('Comprobante no disponible', 'Aún no se encontró el identificador de pago para esta cita.');
      return;
    }

    setDownloadingReceiptFor(Number(appointment?.id || 0));
    try {
      // Leer y convertir logo a base64
      let logoBase64 = '';
      try {
        const logoPath = `${FileSystem.documentDirectory}/../../../assets/logotipo_mini.png`;
        const logoFile = require('../../assets/logotipo_mini.png');
        const logoUri = Image.resolveAssetSource(logoFile).uri;
        logoBase64 = await FileSystem.readAsStringAsync(logoUri, { encoding: 'base64' });
      } catch (logoError) {
        console.warn('No se pudo cargar el logo:', logoError);
        // Continuar sin logo si hay error
      }

      const response = await fetch(`${BACKEND_URL}/payments/receipt/${encodeURIComponent(paymentIntentId)}`);
      const payload = await response.json();

      if (!response.ok || !payload?.receipt) {
        throw new Error(payload?.error || 'No se pudo obtener el comprobante.');
      }

      const receipt = payload.receipt;
      const html = buildReceiptPdfHtml(receipt, logoBase64);
      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Descargar comprobante de pago',
          UTI: '.pdf',
        });
      } else {
        Alert.alert('Comprobante generado', `Se creó el PDF en: ${uri}`);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo descargar el comprobante.');
    } finally {
      setDownloadingReceiptFor(null);
    }
  };

  const handlePayment = async () => {
    if (!citaId || !patientData?.id_paciente || !selectedDoctor) {
      Alert.alert('Error', 'No se pudo procesar el pago. Intenta nuevamente.');
      return;
    }

    const billingName = cardName.trim();

    const isCardReady =
      cardDetails?.complete ||
      (cardDetails?.validNumber === 'Valid' &&
        cardDetails?.validExpiryDate === 'Valid' &&
        cardDetails?.validCVC === 'Valid');

    if (!isCardReady || !billingName) {
      Alert.alert('Atención', 'Por favor completa todos los campos de pago.');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      // Validar cita antes de enviar al backend para evitar errores con IDs viejos.
      let effectiveCitaId = Number(citaId);
      const { data: citaActual, error: citaActualError } = await supabase
        .from('citas')
        .select('id_cita, estado, id_nutriologo')
        .eq('id_cita', effectiveCitaId)
        .eq('id_paciente', patientData.id_paciente)
        .maybeSingle();

      const citaEsValida = !citaActualError && citaActual && citaActual.estado === 'pendiente';

      if (!citaEsValida) {
        const fallbackQuery = supabase
          .from('citas')
          .select('id_cita, estado, id_nutriologo')
          .eq('id_paciente', patientData.id_paciente)
          .eq('estado', 'pendiente')
          .order('fecha_hora', { ascending: false })
          .limit(1);

        const { data: fallbackCitas, error: fallbackError } = selectedDoctor?.realId
          ? await fallbackQuery.eq('id_nutriologo', Number(selectedDoctor.realId))
          : await fallbackQuery;

        if (!fallbackError && fallbackCitas && fallbackCitas.length > 0) {
          effectiveCitaId = Number(fallbackCitas[0].id_cita);
          setCitaId(effectiveCitaId);
        } else {
          await fetchAppointments();
          closeModal();
          setViewMode('pendientes');
          Alert.alert(
            'Pago no disponible',
            'No encontramos una cita pendiente valida para pagar. Actualiza tus citas e intenta de nuevo.'
          );
          return;
        }
      }

      const response = await fetch(`${BACKEND_URL}/payments/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: effectiveCitaId,
          userId: patientData.id_paciente,
          appointmentTitle: `Consulta con ${selectedDoctor.name}`,
          monto: selectedDoctor.originalPrice || selectedDoctor.price,
          idCanjePaciente: selectedCanjePaciente?.id_canje_paciente || null,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        let backendMessage = '';
        try {
          backendMessage = JSON.parse(text)?.error || '';
        } catch {
          backendMessage = text;
        }

        if (response.status === 400 && backendMessage.includes('La cita no está en estado pendiente')) {
          await fetchAppointments();
          closeModal();
          setViewMode('pendientes');
          Alert.alert(
            'Pago no disponible',
            'Esta cita ya no está pendiente de pago. La lista de citas fue actualizada.'
          );
          return;
        }

        throw new Error(backendMessage || `Error del backend (${response.status})`);
      }

      const { clientSecret } = JSON.parse(text);

      const { paymentIntent, error } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: billingName,
              email: authUser?.email || 'no-email@nutriu.app',
            },
          },
        }
      );

      if (error) throw new Error(error.message || 'Error al confirmar pago');

      if (!paymentIntent || paymentIntent.status.toLowerCase() !== 'succeeded') {
        throw new Error('El pago no fue completado exitosamente');
      }

      // Registrar/confirmar en backend para centralizar lógica e idempotencia.
      const confirmResponse = await fetch(`${BACKEND_URL}/payments/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });

      const confirmBody = await confirmResponse.text();
      if (!confirmResponse.ok) {
        throw new Error(`Error confirmando pago en backend: ${confirmResponse.status} - ${confirmBody}`);
      }

      // 🔥 VERIFICAR RELACIÓN CON NUTRIÓLOGO
      try {
        // Verificar si ya tiene una relación activa con este nutriólogo
        const { data: relacionExistente } = await supabase
          .from('paciente_nutriologo')
          .select('id_relacion, activo')
          .eq('id_paciente', patientData.id_paciente)
          .eq('id_nutriologo', selectedDoctor.realId)
          .maybeSingle();

        let esNuevaRelacion = false;

        if (relacionExistente) {
          // Actualizar a activo si estaba inactivo
          if (!relacionExistente.activo) {
            await supabase
              .from('paciente_nutriologo')
              .update({ activo: true, fecha_asignacion: new Date().toISOString() })
              .eq('id_relacion', relacionExistente.id_relacion);
            esNuevaRelacion = true;
          }
        } else {
          // No tiene relación, crear nueva
          const nutriologoId = Number(selectedDoctor.realId);

          // Desactivar relaciones anteriores con otros nutriólogos
          await supabase
            .from('paciente_nutriologo')
            .update({ activo: false })
            .eq('id_paciente', patientData.id_paciente);

          // Crear nueva relación ACTIVA
          const { error: asignacionError } = await supabase
            .from('paciente_nutriologo')
            .insert({
              id_paciente: patientData.id_paciente,
              id_nutriologo: nutriologoId,
              fecha_asignacion: new Date().toISOString(),
              activo: true
            });

          if (asignacionError) {
            console.error('Error al asignar nutriólogo:', asignacionError);
          } else {
            esNuevaRelacion = true;
          }
        }

        // Crear notificación de bienvenida si es nueva relación
        if (esNuevaRelacion) {
          const { data: nutriologoData } = await supabase
            .from('nutriologos')
            .select('nombre, apellido')
            .eq('id_nutriologo', selectedDoctor.realId)
            .maybeSingle();

          const nutriologoNombre = nutriologoData 
            ? `Dr. ${nutriologoData.nombre} ${nutriologoData.apellido}`
            : selectedDoctor.name;

          await supabase
            .from('notificaciones')
            .insert({
              id_usuario: patientData.id_paciente,
              tipo_usuario: 'paciente',
              titulo: '¡Bienvenido!',
              mensaje: `Hola, soy tu nutriólogo ${nutriologoNombre}. Estoy aquí para ayudarte a alcanzar tus metas de salud. ¡Vamos a empezar!`,
              tipo: 'sistema',
              datos_adicionales: {
                subtipo: 'bienvenida_nutriologo',
                id_nutriologo: selectedDoctor.realId
              },
              leida: false
            });
        }
        
        // Refrescar datos
        await refreshUser();
        await new Promise(resolve => setTimeout(resolve, 1500));
        await refreshNutriologo();
        
      } catch (error) {
        console.error('Error en asignación de nutriólogo:', error);
      }

      // Recargar citas y regresar directamente a pendientes.
      if (patientData?.id_paciente && effectiveCitaId) {
        try {
          const { data: relatedNotifications } = await supabase
            .from('notificaciones')
            .select('id_notificacion, datos_adicionales')
            .eq('id_usuario', patientData.id_paciente)
            .eq('tipo_usuario', 'paciente')
            .eq('datos_adicionales->>id_cita', String(effectiveCitaId));

          for (const notif of relatedNotifications || []) {
            await supabase
              .from('notificaciones')
              .update({
                titulo: 'Cita pagada',
                mensaje: 'Tu cita fue pagada correctamente. Espera la confirmación del nutriólogo.',
                tipo: 'pago',
                datos_adicionales: {
                  ...(notif.datos_adicionales || {}),
                  id_cita: effectiveCitaId,
                  estado: 'pendiente_pagado',
                  requiere_pago: false,
                },
              })
              .eq('id_notificacion', notif.id_notificacion);
          }
        } catch (notificationUpdateError) {
          console.warn('No se pudieron actualizar las notificaciones post-pago:', notificationUpdateError);
        }
      }

      await fetchAppointments();
      setViewMode('pendientes');
      setPaymentStep('success');

    } catch (err: any) {
      console.error('Error completo en handlePayment:', err);
      const rawMessage = String(err?.message || '');
      const rawLower = rawMessage.toLowerCase();
      const isAppointmentNotFound =
        rawLower.includes('cita no encontrada') ||
        rawLower.includes('invalida') ||
        rawLower.includes('inválida');
      const userMessage = rawMessage.includes('La cita no está en estado pendiente')
        ? 'Esta cita ya no está disponible para pago.'
        : isAppointmentNotFound
          ? 'La cita ya no existe o cambió. Recargamos tus citas pendientes para que elijas una válida.'
        : rawMessage.includes('No se pudo conectar')
          ? 'No se pudo conectar con el servidor de pagos. Intenta nuevamente.'
          : rawMessage || 'No se pudo completar el pago.';
      if (isAppointmentNotFound) {
        await fetchAppointments();
        setViewMode('pendientes');
      }
      setPaymentError(userMessage);
      Alert.alert('Error en el pago', userMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    Keyboard.dismiss();
    setPaymentStep('selection');
    setSelectedDoctor(null);
    setPaymentError(null);
    setCardName('');
    setCitaId(null);
    setCardDetails(null);
    setAvailableCanjes([]);
    setSelectedCanjePaciente(null);
    if (route.params?.citaId) {
      navigation.setParams({
        citaId: undefined,
        doctorId: undefined,
        doctorName: undefined,
        precio: undefined,
      });
    }
  };

  const showAppointmentDetails = (appointment: any) => {
    setSelectedAppointment(appointment);
    setDetailsModalVisible(true);
  };

  if (loading || appointmentsLoading) {
    const rotate = rotateValue.interpolate({ inputRange: [0, 1], outputRange: ['-10deg', '10deg'] });
    const bounce = bounceValue.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <View style={styles.iconsRow}>
            <Animated.View style={[styles.iconContainer, { transform: [{ rotate }, { translateY: bounce }, { scale: pulseValue }], opacity: opacityValue }]}>
              <FontAwesome5 name="user-md" size={60} color={COLORS.primary} />
            </Animated.View>
            <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleValue }], opacity: opacityValue, marginLeft: 20 }]}>
              <MaterialCommunityIcons name="stethoscope" size={60} color={COLORS.accent} />
            </Animated.View>
          </View>
          <Animated.Text style={[styles.loadingText, { opacity: textOpacityValue }]}>
            Cargando información...
          </Animated.Text>
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map(i => (
              <Animated.View 
                key={i} 
                style={[
                  styles.dot, 
                  { 
                    opacity: textOpacityValue.interpolate({ inputRange: [0.3, 1], outputRange: [0.3, 1] }),
                    transform: [{ scale: textOpacityValue.interpolate({ inputRange: [0.3, 1], outputRange: [0.8, 1.2] }) }]
                  }
                ]} 
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (doctors.length === 0 && viewMode === 'agendar') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' }}>
            No hay nutriólogos disponibles en este momento
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 24, backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 }} 
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: COLORS.white, fontWeight: '700' }}>Regresar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>GESTIÓN DE CITAS</Text>
          <View style={styles.underlineSmall} />
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.navBar}>
        {['agendar', 'pendientes', 'confirmadas'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setViewMode(tab)}
            style={[
              styles.navItem,
              viewMode === tab && styles.navItemActive
            ]}
          >
            <Text style={[
              styles.navText,
              viewMode === tab && styles.navTextActive
            ]}>
              {tab === 'agendar' ? 'AGENDAR' : 
               tab === 'pendientes' ? 'PENDIENTES' : 'CONFIRMADAS'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
            title="Cargando..."
            titleColor={COLORS.primary}
          />
        }
      >
        {viewMode === 'agendar' && (
          <>
            <View style={styles.introSection}>
              <Text style={styles.mainTitle}>Reserva tu Consulta</Text>
              <Text style={styles.subtitle}>Elige entre todos los nutriólogos disponibles y agenda de forma rápida.</Text>
            </View>

            {doctors.map((doctor) => (
              <TouchableOpacity
                key={doctor.id}
                style={styles.doctorCard}
                onPress={() => handleSelectDoctor(doctor)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                  {doctor.photoUrl ? (
                    <Image 
                      source={{ uri: doctor.photoUrl }} 
                      style={{ width: '100%', height: '100%', borderRadius: 18 }} 
                      resizeMode="cover" 
                    />
                  ) : (
                    <MaterialCommunityIcons name="account-tie" size={30} color={COLORS.primary} />
                  )}
                </View>

                <View style={styles.doctorInfo}>
                  <View style={styles.doctorTopRow}>
                    <Text style={styles.doctorName} numberOfLines={1}>{doctor.name}</Text>
                    <View style={styles.availableBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                      <Text style={styles.availableBadgeText}>Disponible</Text>
                    </View>
                  </View>

                  <View style={styles.specialtyPill}>
                    <Ionicons name="medkit-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.doctorSpecialty} numberOfLines={1}>{doctor.specialty}</Text>
                  </View>

                  <View style={styles.doctorBottomRow}>
                    <View style={styles.priceTag}>
                      <Text style={styles.priceLabel}>Consulta</Text>
                      <Text style={styles.priceText}>${doctor.price.toLocaleString('es-MX')}</Text>
                    </View>

                    <View style={styles.doctorActionPill}>
                      <Text style={styles.doctorActionText}>Agendar</Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            <View style={styles.helpCard}>
              <Ionicons name="lock-closed" size={20} color={COLORS.primary} />
              <Text style={styles.helpText}>
                Tus pagos están protegidos de extremo a extremo por tecnología de encriptación bancaria.
              </Text>
            </View>
          </>
        )}

        {viewMode === 'pendientes' && (
          <View style={styles.appointmentsSection}>
            {/* CITAS PENDIENTES DE PAGO */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pendientes de Pago</Text>
              <MaterialCommunityIcons name="credit-card-outline" size={24} color={COLORS.pendingPayment} />
            </View>

            {pendingPaymentAppointments.length > 0 ? (
              <View style={styles.appointmentsList}>
                {pendingPaymentAppointments.map((appointment) => (
                  <View key={appointment.id} style={styles.appointmentCard}>
                    <View style={styles.appointmentHeader}>
                      <View style={styles.appointmentAvatar}>
                        {appointment.doctorPhoto ? (
                          <Image 
                            source={{ uri: appointment.doctorPhoto }} 
                            style={{ width: '100%', height: '100%', borderRadius: 12 }} 
                            resizeMode="cover" 
                          />
                        ) : (
                          <MaterialCommunityIcons name="doctor" size={20} color={COLORS.primary} />
                        )}
                      </View>
                      <View style={styles.appointmentInfo}>
                        <Text style={styles.appointmentDoctor}>{appointment.doctorName}</Text>
                        <Text style={styles.appointmentDateTime}>{appointment.fecha} - {appointment.hora}</Text>
                      </View>
                    </View>

                    <View style={styles.appointmentFooter}>
                      <View style={[styles.statusBadge, styles.pendingPaymentBadge]}>
                        <Ionicons name="time-outline" size={14} color={COLORS.pendingPayment} />
                        <Text style={styles.statusBadgeText}>Pendiente de pago</Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.payNowButton}
                        onPress={() => handlePaymentFromPending(appointment)}
                      >
                        <Text style={styles.payNowText}>PAGAR AHORA</Text>
                        <Ionicons name="card-outline" size={16} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyAppointments}>
                <MaterialCommunityIcons name="credit-card-outline" size={50} color={COLORS.border} />
                <Text style={styles.emptyAppointmentsText}>
                  No tienes citas pendientes de pago
                </Text>
              </View>
            )}

            {/* CITAS PAGADAS EN ESPERA DE CONFIRMACIÓN */}
            <View style={[styles.sectionHeader, { marginTop: 30 }]}>
              <Text style={styles.sectionTitle}>Pagadas - Esperando Confirmación</Text>
              <MaterialCommunityIcons name="clock-check-outline" size={24} color={COLORS.paid} />
            </View>

            {paidPendingAppointments.length > 0 ? (
              <View style={styles.appointmentsList}>
                {paidPendingAppointments.map((appointment) => (
                  <View key={appointment.id} style={styles.appointmentCard}>
                    <View style={styles.appointmentHeader}>
                      <View style={styles.appointmentAvatar}>
                        {appointment.doctorPhoto ? (
                          <Image 
                            source={{ uri: appointment.doctorPhoto }} 
                            style={{ width: '100%', height: '100%', borderRadius: 12 }} 
                            resizeMode="cover" 
                          />
                        ) : (
                          <MaterialCommunityIcons name="doctor" size={20} color={COLORS.primary} />
                        )}
                      </View>
                      <View style={styles.appointmentInfo}>
                        <Text style={styles.appointmentDoctor}>{appointment.doctorName}</Text>
                        <Text style={styles.appointmentDateTime}>{appointment.fecha} - {appointment.hora}</Text>
                      </View>
                    </View>

                    <View style={styles.appointmentFooter}>
                      <View style={[styles.statusBadge, styles.paidBadge]}>
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.paid} />
                        <Text style={styles.statusBadgeText}>Pagada - Pendiente</Text>
                      </View>

                      <View style={styles.appointmentActionsRow}>
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => downloadPaymentReceipt(appointment)}
                          disabled={downloadingReceiptFor === appointment.id}
                          activeOpacity={0.6}
                        >
                          {downloadingReceiptFor === appointment.id ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                          ) : (
                            <Ionicons name="download" size={18} color={COLORS.primary} />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.iconButton}
                          onPress={() => showAppointmentDetails(appointment)}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="information-circle" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyAppointments}>
                <MaterialCommunityIcons name="clock-check-outline" size={50} color={COLORS.border} />
                <Text style={styles.emptyAppointmentsText}>
                  No tienes citas pagadas en espera
                </Text>
              </View>
            )}
          </View>
        )}

        {viewMode === 'confirmadas' && (
          <View style={styles.appointmentsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Citas Confirmadas / Atendidas</Text>
              <MaterialCommunityIcons name="calendar-check" size={24} color={COLORS.success} />
            </View>

            {confirmedAppointments.length > 0 && (
              <View style={styles.clearConfirmedRow}>
                <TouchableOpacity style={styles.clearConfirmedButton} onPress={clearConfirmedAppointments}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            )}

            {confirmedAppointments.length > 0 ? (
              <View style={styles.appointmentsList}>
                {confirmedAppointments.map((appointment) => (
                  <View key={appointment.id} style={styles.appointmentCard}>
                    <View style={styles.appointmentHeader}>
                      <View style={styles.appointmentAvatar}>
                        {appointment.doctorPhoto ? (
                          <Image 
                            source={{ uri: appointment.doctorPhoto }} 
                            style={{ width: '100%', height: '100%', borderRadius: 12 }} 
                            resizeMode="cover" 
                          />
                        ) : (
                          <MaterialCommunityIcons name="doctor" size={20} color={COLORS.primary} />
                        )}
                      </View>
                      <View style={styles.appointmentInfo}>
                        <Text style={styles.appointmentDoctor}>{appointment.doctorName}</Text>
                        <Text style={styles.appointmentDateTime}>{appointment.fecha} - {appointment.hora}</Text>
                      </View>
                    </View>

                    <View style={styles.appointmentFooter}>
                      <View style={[styles.statusBadge, appointment.estado === 'confirmada' ? styles.confirmedBadge : styles.completedBadge]}>
                        <Ionicons 
                          name={appointment.estado === 'confirmada' ? "checkmark-circle" : "checkmark-done-circle"} 
                          size={14} 
                          color={appointment.estado === 'confirmada' ? COLORS.success : COLORS.primary} 
                        />
                        <Text style={styles.statusBadgeText}>
                          {appointment.estado === 'confirmada' ? 'Confirmada' : 'Atendida'}
                        </Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.viewDetailsButton}
                        onPress={() => showAppointmentDetails(appointment)}
                      >
                        <Text style={styles.viewDetailsText}>Ver detalles</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyAppointments}>
                <MaterialCommunityIcons name="calendar-check" size={50} color={COLORS.border} />
                <Text style={styles.emptyAppointmentsText}>
                  No tienes citas confirmadas o atendidas
                </Text>
                <Text style={styles.emptyAppointmentsSubtext}>
                  Una vez que el nutriólogo confirme la atención aparecerán aquí
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL DE DETALLES (MEJORADO) */}
      <Modal
        visible={detailsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={detailsModalStyles.overlay}>
          <View style={detailsModalStyles.container}>
            <View style={detailsModalStyles.header}>
              <View style={detailsModalStyles.headerIcon}>
                <MaterialCommunityIcons name="calendar-check" size={24} color={COLORS.white} />
              </View>
              <Text style={detailsModalStyles.headerTitle}>Detalles de la Cita</Text>
              <TouchableOpacity 
                onPress={() => setDetailsModalVisible(false)}
                style={detailsModalStyles.closeButton}
              >
                <Ionicons name="close" size={22} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <View style={detailsModalStyles.content}>
                <View style={detailsModalStyles.doctorSection}>
                  <View style={detailsModalStyles.doctorAvatar}>
                    {selectedAppointment.doctorPhoto ? (
                      <Image 
                        source={{ uri: selectedAppointment.doctorPhoto }} 
                        style={{ width: '100%', height: '100%', borderRadius: 30 }} 
                        resizeMode="cover" 
                      />
                    ) : (
                      <MaterialCommunityIcons name="doctor" size={30} color={COLORS.primary} />
                    )}
                  </View>
                  <View style={detailsModalStyles.doctorInfo}>
                    <Text style={detailsModalStyles.doctorName}>{selectedAppointment.doctorName}</Text>
                    <Text style={detailsModalStyles.doctorSpecialty}>{selectedAppointment.especialidad}</Text>
                  </View>
                </View>

                <View style={detailsModalStyles.divider} />

                <View style={detailsModalStyles.detailsCard}>
                  <View style={detailsModalStyles.detailRow}>
                    <View style={detailsModalStyles.detailIcon}>
                      <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={detailsModalStyles.detailContent}>
                      <Text style={detailsModalStyles.detailLabel}>Fecha</Text>
                      <Text style={detailsModalStyles.detailValue}>{selectedAppointment.fecha}</Text>
                    </View>
                  </View>

                  <View style={detailsModalStyles.detailRow}>
                    <View style={detailsModalStyles.detailIcon}>
                      <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={detailsModalStyles.detailContent}>
                      <Text style={detailsModalStyles.detailLabel}>Hora</Text>
                      <Text style={detailsModalStyles.detailValue}>{selectedAppointment.hora}</Text>
                    </View>
                  </View>

                  <View style={detailsModalStyles.detailRow}>
                    <View style={detailsModalStyles.detailIcon}>
                      <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={detailsModalStyles.detailContent}>
                      <Text style={detailsModalStyles.detailLabel}>Monto</Text>
                      <Text style={detailsModalStyles.detailValue}>${selectedAppointment.monto.toLocaleString('es-MX')} MXN</Text>
                    </View>
                  </View>

                  {selectedAppointment.tienePago && (
                    <View style={detailsModalStyles.detailRow}>
                      <View style={detailsModalStyles.detailIcon}>
                        <Ionicons name="card-outline" size={20} color={COLORS.success} />
                      </View>
                      <View style={detailsModalStyles.detailContent}>
                        <Text style={detailsModalStyles.detailLabel}>Pago</Text>
                        <Text style={[detailsModalStyles.detailValue, { color: COLORS.success }]}>
                          Completado
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={detailsModalStyles.statusSection}>
                  <View style={[
                    detailsModalStyles.statusBadge,
                    selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago ? detailsModalStyles.pendingPaymentStatus :
                    selectedAppointment.estado === 'pendiente_pagado' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? detailsModalStyles.paidStatus :
                    selectedAppointment.estado === 'confirmada' ? detailsModalStyles.confirmedStatus :
                    detailsModalStyles.completedStatus
                  ]}>
                    <Ionicons 
                      name={
                        selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago ? "time-outline" :
                        selectedAppointment.estado === 'pendiente_pagado' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? "card-outline" :
                        selectedAppointment.estado === 'confirmada' ? "checkmark-circle" : "checkmark-done-circle"
                      } 
                      size={16} 
                      color={
                        selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago ? COLORS.pendingPayment :
                        selectedAppointment.estado === 'pendiente_pagado' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? COLORS.paid :
                        selectedAppointment.estado === 'confirmada' ? COLORS.success : COLORS.primary
                      } 
                    />
                    <Text style={detailsModalStyles.statusText}>
                      {selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago ? 'Pendiente de pago' :
                       selectedAppointment.estado === 'pendiente_pagado' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? 'Pagada - Esperando confirmación' :
                       selectedAppointment.estado === 'confirmada' ? 'Confirmada' : 'Atendida'}
                    </Text>
                  </View>
                </View>

                {selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago && (
                  <TouchableOpacity 
                    style={detailsModalStyles.payButton}
                    onPress={() => {
                      setDetailsModalVisible(false);
                      handlePaymentFromPending(selectedAppointment);
                    }}
                  >
                    <Text style={detailsModalStyles.payButtonText}>PAGAR AHORA</Text>
                    <Ionicons name="card-outline" size={18} color={COLORS.white} />
                  </TouchableOpacity>
                )}

                {selectedAppointment.tienePago && (
                  <TouchableOpacity
                    style={detailsModalStyles.downloadButton}
                    onPress={() => downloadPaymentReceipt(selectedAppointment)}
                    disabled={downloadingReceiptFor === selectedAppointment.id}
                  >
                    {downloadingReceiptFor === selectedAppointment.id ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="download" size={16} color={COLORS.white} />
                        <Text style={detailsModalStyles.downloadButtonText}>DESCARGAR COMPROBANTE</Text>
                        <Ionicons name="download-outline" size={18} color={COLORS.white} />
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={detailsModalStyles.closeButton2}
                  onPress={() => setDetailsModalVisible(false)}
                >
                  <Text style={detailsModalStyles.closeButtonText}>CERRAR</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL DE PAGO */}
      <Modal
        visible={paymentStep !== 'selection'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.paymentKeyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
          >
            <View style={styles.paymentKeyboardContent}>
                <ScrollView
                  style={styles.paymentScrollView}
                  contentContainerStyle={styles.paymentScrollContent}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="on-drag"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.paymentCard}>
                    <TouchableOpacity onPress={closeModal} style={styles.paymentCloseButton} disabled={isProcessing}>
                      <Ionicons name="close" size={24} color={COLORS.textLight} />
                    </TouchableOpacity>
                    {paymentStep === 'checkout' && citaId ? (
                      <>
                        <Text style={styles.modalTitle}>Resumen de la Cita</Text>
                        
                        <View style={styles.receiptContainer}>
                          <View style={styles.receiptLine}>
                            <Text style={styles.receiptLabel}>Especialista:</Text>
                            <Text style={styles.receiptValue}>{selectedDoctor?.name || 'Nutriólogo'}</Text>
                          </View>
                          <View style={styles.receiptLine}>
                            <Text style={styles.receiptLabel}>Servicio:</Text>
                            <Text style={styles.receiptValue}>Consulta Nutricional</Text>
                          </View>
                          <View style={styles.receiptLine}>
                            <Text style={styles.receiptLabel}>Tarifa original:</Text>
                            <Text style={styles.receiptValue}>
                              ${paymentPreview.montoOriginal.toLocaleString('es-MX')} MXN
                            </Text>
                          </View>
                          {selectedCanjePaciente && paymentPreview.eligible && (
                            <View style={styles.receiptLine}>
                              <Text style={styles.receiptLabel}>Canje aplicado:</Text>
                              <Text style={styles.discountValue}>
                                -${paymentPreview.descuentoAplicado.toLocaleString('es-MX')} MXN
                              </Text>
                            </View>
                          )}
                          <View style={styles.divider} />
                          <View style={styles.receiptLine}>
                            <Text style={styles.totalLabel}>Total a pagar:</Text>
                            <Text style={styles.totalValue}>
                              ${paymentPreview.montoFinal.toLocaleString('es-MX')} MXN
                            </Text>
                          </View>
                        </View>

                        {/* Sección de recompensas: solo se muestra si hay canjes o si está cargando */}
                        {(loadingCanjes || availableCanjes.length > 0) && (
                        <View style={styles.canjesCheckoutSection}>
                          <Text style={styles.canjesCheckoutTitle}>Mis recompensas</Text>
                          <Text style={styles.canjesCheckoutSubtitle}>
                            Aplica una recompensa ganada a esta consulta.
                          </Text>

                          {loadingCanjes ? (
                            <View style={styles.canjesLoadingRow}>
                              <ActivityIndicator color={COLORS.primary} size="small" />
                              <Text style={styles.canjesLoadingText}>Cargando recompensas...</Text>
                            </View>
                          ) : availableCanjes.length > 0 ? (
                            <>
                              <TouchableOpacity
                                style={[
                                  styles.canjeOptionCard,
                                  !selectedCanjePaciente && styles.canjeOptionCardSelected,
                                ]}
                                onPress={() => setSelectedCanjePaciente(null)}
                              >
                                <View style={styles.canjeOptionContent}>
                                  <Text style={styles.canjeOptionTitle}>Sin canje</Text>
                                  <Text style={styles.canjeOptionDescription}>Pagar tarifa completa</Text>
                                </View>
                              </TouchableOpacity>

                              {availableCanjes.map((canjePaciente: any) => {
                                const preview = getCanjePreview(Number(selectedDoctor?.price || 0), canjePaciente);
                                const isSelected = selectedCanjePaciente?.id_canje_paciente === canjePaciente.id_canje_paciente;

                                return (
                                  <TouchableOpacity
                                    key={canjePaciente.id_canje_paciente}
                                    style={[
                                      styles.canjeOptionCard,
                                      isSelected && styles.canjeOptionCardSelected,
                                      !preview.eligible && styles.canjeOptionCardDisabled,
                                    ]}
                                    disabled={!preview.eligible}
                                    onPress={() => setSelectedCanjePaciente(canjePaciente)}
                                  >
                                    <View style={styles.canjeOptionContent}>
                                      <Text style={styles.canjeOptionTitle}>
                                        {canjePaciente.canjes?.tipo_canje === 'descuento'
                                          ? `${canjePaciente.canjes?.valor_descuento}% de descuento`
                                          : canjePaciente.canjes?.nombre_canje}
                                      </Text>
                                      {preview.eligible ? (
                                        <Text style={styles.canjeOptionSavings}>
                                          Ahorras ${preview.descuentoAplicado.toLocaleString('es-MX')} MXN
                                        </Text>
                                      ) : (
                                        <Text style={styles.canjeOptionWarning}>{preview.ineligibleReason}</Text>
                                      )}
                                    </View>
                                    {isSelected && preview.eligible && (
                                      <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </>
                          ) : (
                            <Text style={styles.canjesEmptyText}>No tienes recompensas disponibles aún.</Text>
                          )}
                        </View>
                        )}

                        <View style={paymentStyles.paymentContainer}>
                          <Text style={paymentStyles.paymentTitle}>Método de pago</Text>
                          <Text style={paymentStyles.secureLabel}>Tarjetas seguras y encriptadas</Text>

                          <View style={paymentStyles.brandsContainer}>
                            <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Visa_2021.svg/1200px-Visa_2021.svg.png' }} style={paymentStyles.brandIcon} resizeMode="contain" />
                            <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/MasterCard_Logo.svg/1200px-MasterCard_Logo.svg.png' }} style={paymentStyles.brandIcon} resizeMode="contain" />
                            <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/American_Express_logo.svg/1200px-American_Express_logo.svg.png' }} style={paymentStyles.brandIcon} resizeMode="contain" />
                          </View>

                          <CardField
                            postalCodeEnabled={false}
                            placeholders={{ number: '1234 1234 1234 1234' }}
                            cardStyle={{
                              backgroundColor: PAYMENT_COLORS.cardBg,
                              textColor: PAYMENT_COLORS.label,
                              placeholderColor: PAYMENT_COLORS.placeholder,
                            }}
                            style={paymentStyles.cardField}
                            onCardChange={(details) => setCardDetails(details)}
                          />

                          <Text style={paymentStyles.label}>Nombre del destinatario</Text>
                          <TextInput
                            style={paymentStyles.input}
                            placeholder="Nombre completo"
                            placeholderTextColor={PAYMENT_COLORS.placeholder}
                            value={cardName}
                            onChangeText={setCardName}
                            autoCapitalize="words"
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                          />

                          {paymentError && (
                            <Text style={paymentStyles.errorText}>{paymentError}</Text>
                          )}

                          <TouchableOpacity 
                            style={paymentStyles.payButton}
                            onPress={handlePayment}
                            disabled={isProcessing || !cardName.trim()}
                          >
                            {isProcessing ? (
                              <ActivityIndicator color={PAYMENT_COLORS.buttonText} size="small" />
                            ) : (
                              <Text style={paymentStyles.payButtonText}>
                                Pagar ${paymentPreview.montoFinal.toLocaleString('es-MX')} MXN
                              </Text>
                            )}
                          </TouchableOpacity>

                          <Text style={paymentStyles.termsText}>
                            Al pagar aceptas los Términos y Condiciones.
                          </Text>
                        </View>

                        <TouchableOpacity onPress={closeModal} style={styles.cancelButton} disabled={isProcessing}>
                          <Text style={styles.cancelButtonText}>CANCELAR</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.successContainer}>
                        <View style={styles.successIconCircle}>
                          <Ionicons name="checkmark-sharp" size={60} color={COLORS.white} />
                        </View>
                        <Text style={styles.successTitle}>¡Pago Completado!</Text>
                        <Text style={styles.successMsg}>Tu transacción ha sido procesada con éxito.</Text>
                        
                        <TouchableOpacity 
                          style={styles.finalButton} 
                          onPress={() => {
                            closeModal();
                            setViewMode('pendientes');
                          }}
                        >
                          <Text style={styles.finalButtonText}>VER CITAS PENDIENTES</Text>
                          <Ionicons name="time-outline" size={20} color={COLORS.white} style={{marginLeft: 10}} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL INFORMATIVO - YA TIENES NUTRIÓLOGO ASIGNADO */}
      <Modal
        visible={nutriologoAssignedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNutriologoAssignedModal(false)}
      >
        <View style={detailsModalStyles.overlay}>
          <View style={[detailsModalStyles.container, detailsModalStyles.assignedContainer]}>
            <View style={[detailsModalStyles.header, detailsModalStyles.assignedWarningHeader]}>
              <View style={detailsModalStyles.headerIcon}>
                <Ionicons name="alert-circle" size={24} color={COLORS.white} />
              </View>
              <Text style={detailsModalStyles.headerTitle}>Nutriólogo asignado</Text>
              <TouchableOpacity 
                onPress={() => setNutriologoAssignedModal(false)}
                style={detailsModalStyles.closeButton}
              >
                <Ionicons name="close" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <View style={detailsModalStyles.content}>
              <View style={detailsModalStyles.assignedContent}> 
                <View style={detailsModalStyles.assignedWarningBadgeCircle}>
                  <Ionicons name="medical" size={30} color={COLORS.warning} />
                </View>

                <Text style={detailsModalStyles.assignedLabel}>
                  Actualmente tu nutriólogo de cabecera es:
                </Text>

                <View style={detailsModalStyles.assignedDoctorPill}>
                  <Text style={detailsModalStyles.assignedDoctorName}>
                    Dr. {nutriologo?.nombre} {nutriologo?.apellido}
                  </Text>
                </View>
                
                <Text style={detailsModalStyles.assignedMessage}>
                  No puedes agendar con otro nutriólogo hasta desasignarte.
                </Text>
              </View>

              <TouchableOpacity 
                style={detailsModalStyles.closeButton2}
                onPress={() => setNutriologoAssignedModal(false)}
              >
                <Text style={detailsModalStyles.closeButtonText}>ENTENDIDO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL INFORMATIVO - NUTRIÓLOGO YA ASIGNADO */}
      <Modal
        visible={nutriologoInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNutriologoInfoModal(false)}
      >
        <View style={detailsModalStyles.overlay}>
          <View style={[detailsModalStyles.container, detailsModalStyles.assignedContainer]}>
            <View style={[detailsModalStyles.header, detailsModalStyles.assignedHeader]}>
              <View style={detailsModalStyles.headerIcon}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
              </View>
              <Text style={detailsModalStyles.headerTitle}>Ya es tu nutriólogo</Text>
              <TouchableOpacity 
                onPress={() => setNutriologoInfoModal(false)}
                style={detailsModalStyles.closeButton}
              >
                <Ionicons name="close" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <View style={detailsModalStyles.content}>
              <View style={detailsModalStyles.assignedContent}> 
                <View style={detailsModalStyles.assignedBadgeCircle}>
                  <Ionicons name="medical" size={30} color={COLORS.success} />
                </View>

                <Text style={detailsModalStyles.assignedLabel}>
                  Actualmente tu nutriólogo de cabecera es:
                </Text>

                <View style={detailsModalStyles.assignedDoctorPill}>
                  <Text style={detailsModalStyles.assignedDoctorName}>
                    {selectedDoctor?.name || 'Este nutriólogo'}
                  </Text>
                </View>
                
                <Text style={detailsModalStyles.assignedMessage}>
                  Ya es tu nutriólogo de cabecera. Puedes agendar otra consulta directamente.
                </Text>
              </View>

              <TouchableOpacity 
                style={detailsModalStyles.closeButton2}
                onPress={() => setNutriologoInfoModal(false)}
              >
                <Text style={detailsModalStyles.closeButtonText}>ENTENDIDO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.secondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerIcon: { padding: 5 },
  brandContainer: { alignItems: 'center' },
  brandName: { fontSize: 18, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  underlineSmall: { width: 20, height: 3, backgroundColor: COLORS.accent, borderRadius: 2, marginTop: 2 },
  placeholder: { width: 40 },

  navBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 3,
  },
  navItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: COLORS.primary,
  },
  navText: {
    fontWeight: '800',
    color: COLORS.textLight,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  navTextActive: {
    color: COLORS.white,
  },

  scrollContent: { padding: 20, paddingBottom: 40 },
  introSection: { marginBottom: 30, alignItems: 'center' },
  mainTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textDark, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 8, fontWeight: '600', lineHeight: 20 },

  doctorsSummaryCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    elevation: 2,
  },
  doctorsSummaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  doctorsSummaryTextWrap: { flex: 1 },
  doctorsSummaryTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  doctorsSummarySubtext: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  doctorCard: { backgroundColor: COLORS.white, padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  avatarContainer: { width: 58, height: 58, borderRadius: 18, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  doctorInfo: { flex: 1, marginLeft: 14 },
  doctorTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doctorName: { flex: 1, fontSize: 16, fontWeight: '900', color: COLORS.textDark, marginRight: 8 },
  availableBadge: { backgroundColor: COLORS.secondary, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  availableBadgeText: { color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  specialtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  specialtyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, marginRight: 6 },
  specialtyPill: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.secondary, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '100%' },
  doctorSpecialty: { fontSize: 12, color: COLORS.primary, fontWeight: '700', flexShrink: 1 },
  doctorBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  consultText: { fontSize: 11, color: COLORS.textLight, fontWeight: '700' },
  priceTag: { backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  priceLabel: { fontSize: 9, color: COLORS.textLight, fontWeight: '700', marginBottom: 1 },
  priceText: { fontWeight: '900', color: COLORS.primary, fontSize: 14 },
  doctorActionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.white },
  doctorActionText: { fontSize: 11, color: COLORS.primary, fontWeight: '900' },

  appointmentsSection: { marginTop: 30, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  clearConfirmedRow: { alignItems: 'flex-end', marginBottom: 12 },
  clearConfirmedButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textDark },
  appointmentsList: { gap: 12 },
  appointmentCard: { backgroundColor: COLORS.white, borderRadius: 20, padding: 16, borderWidth: 2, borderColor: COLORS.border, elevation: 2 },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  appointmentAvatar: { width: 45, height: 45, borderRadius: 12, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  appointmentInfo: { flex: 1 },
  appointmentDoctor: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  appointmentDateTime: { fontSize: 12, color: COLORS.textLight, marginTop: 2, fontWeight: '600' },
  appointmentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  appointmentActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  payNowButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, gap: 6 },
  payNowText: { fontSize: 12, color: COLORS.white, fontWeight: '900' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingPaymentBadge: { backgroundColor: COLORS.pendingPaymentLight, borderWidth: 1, borderColor: COLORS.pendingPayment },
  paidBadge: { backgroundColor: COLORS.paidLight, borderWidth: 1, borderColor: COLORS.paid },
  pendingBadge: { backgroundColor: COLORS.pendingLight, borderWidth: 1, borderColor: COLORS.pending },
  confirmedBadge: { backgroundColor: '#D4EDDA', borderWidth: 1, borderColor: COLORS.success },
  completedBadge: { backgroundColor: COLORS.infoLight, borderWidth: 1, borderColor: COLORS.info },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.textDark },
  emptyAppointments: { backgroundColor: COLORS.white, borderRadius: 20, padding: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed' },
  emptyAppointmentsText: { fontSize: 16, fontWeight: '800', color: COLORS.textLight, marginTop: 12, textAlign: 'center' },
  emptyAppointmentsSubtext: { fontSize: 13, color: COLORS.textLight, marginTop: 8, textAlign: 'center', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(26, 48, 38, 0.85)', justifyContent: 'flex-end' },
  paymentKeyboardContainer: { flex: 1, justifyContent: 'flex-end' },
  paymentKeyboardContent: { flex: 1, justifyContent: 'flex-end' },
  paymentScrollView: { flex: 1 },
  paymentScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  paymentCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, minHeight: 500, alignItems: 'center' },
  paymentCloseButton: { position: 'absolute', top: 14, right: 14, zIndex: 5, padding: 6 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textDark, marginBottom: 25 },
  receiptContainer: { width: '100%', backgroundColor: COLORS.secondary, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 25 },
  receiptLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptLabel: { color: COLORS.textLight, fontWeight: '700', fontSize: 14 },
  receiptValue: { color: COLORS.textDark, fontWeight: '800', fontSize: 14 },
  discountValue: { color: COLORS.success, fontWeight: '900', fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10, borderStyle: 'dashed', borderWidth: 0.5 },
  totalLabel: { fontSize: 18, fontWeight: '900', color: COLORS.textDark },
  totalValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  canjesCheckoutSection: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  canjesCheckoutTitle: { fontSize: 15, fontWeight: '900', color: COLORS.textDark, marginBottom: 4 },
  canjesCheckoutSubtitle: { fontSize: 12, color: COLORS.textLight, marginBottom: 12, lineHeight: 18 },
  canjesLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  canjesLoadingText: { marginLeft: 10, color: COLORS.textLight, fontWeight: '700' },
  canjesEmptyText: { color: COLORS.textLight, fontWeight: '700', fontSize: 12 },
  canjeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: COLORS.secondary,
  },
  canjeOptionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EAF8EF',
  },
  canjeOptionCardDisabled: {
    opacity: 0.55,
  },
  canjeOptionContent: { flex: 1, paddingRight: 12 },
  canjeOptionTitle: { fontSize: 13, fontWeight: '900', color: COLORS.textDark, marginBottom: 2 },
  canjeOptionDescription: { fontSize: 12, color: COLORS.textLight, fontWeight: '700' },
  canjeOptionSavings: { marginTop: 4, fontSize: 12, color: COLORS.success, fontWeight: '900' },
  canjeOptionWarning: { marginTop: 4, fontSize: 12, color: COLORS.warning, fontWeight: '800' },
  cancelButton: { padding: 20 },
  cancelButtonText: { color: COLORS.textLight, fontWeight: '800', fontSize: 14 },
  successContainer: { alignItems: 'center', width: '100%', paddingVertical: 20 },
  successIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 5 },
  successTitle: { fontSize: 26, fontWeight: '900', color: COLORS.primary, marginBottom: 10 },
  successMsg: { color: COLORS.textLight, fontWeight: '600', textAlign: 'center', fontSize: 15 },
  finalButton: { backgroundColor: COLORS.accent, width: '100%', padding: 20, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 35 },
  finalButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 16 },
  helpCard: { flexDirection: 'row', backgroundColor: COLORS.white, padding: 20, borderRadius: 20, marginTop: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.primary },
  helpText: { flex: 1, marginLeft: 12, fontSize: 12, color: COLORS.textDark, fontWeight: '700' },
  loadingContainer: { flex: 1, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
  loadingContent: { alignItems: 'center', justifyContent: 'center' },
  iconsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  iconContainer: { marginHorizontal: 5 },
  loadingText: { fontSize: 18, fontWeight: '600', color: COLORS.primary, marginBottom: 20, textAlign: 'center' },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
});

const detailsModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  doctorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  doctorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  detailsCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: COLORS.textDark,
    fontWeight: '800',
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  pendingPaymentStatus: {
    backgroundColor: COLORS.pendingPaymentLight,
    borderWidth: 1,
    borderColor: COLORS.pendingPayment,
  },
  paidStatus: {
    backgroundColor: COLORS.paidLight,
    borderWidth: 1,
    borderColor: COLORS.paid,
  },
  confirmedStatus: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  completedStatus: {
    backgroundColor: COLORS.infoLight,
    borderWidth: 1,
    borderColor: COLORS.info,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  payButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  downloadButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  downloadButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
  closeButton2: {
    backgroundColor: COLORS.textLight,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '900',
  },
  assignedContainer: {
    width: '86%',
    maxWidth: 380,
  },
  assignedHeader: {
    backgroundColor: COLORS.success,
  },
  assignedWarningHeader: {
    backgroundColor: COLORS.warning,
  },
  assignedContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  assignedLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  assignedDoctorPill: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  assignedBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  assignedWarningBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.pendingPaymentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  assignedDoctorName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
  },
  assignedMessage: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const paymentStyles = StyleSheet.create({
  paymentContainer: {
    width: '100%',
    backgroundColor: PAYMENT_COLORS.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: PAYMENT_COLORS.border,
    marginVertical: 20,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PAYMENT_COLORS.label,
    marginBottom: 8,
  },
  secureLabel: {
    fontSize: 13,
    color: PAYMENT_COLORS.placeholder,
    marginBottom: 16,
  },
  brandsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
  },
  brandIcon: {
    width: 50,
    height: 30,
  },
  cardField: {
    width: '100%',
    height: 60,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: PAYMENT_COLORS.label,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: PAYMENT_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    color: PAYMENT_COLORS.label,
    fontSize: 16,
    marginBottom: 16,
  },
  payButton: {
    backgroundColor: PAYMENT_COLORS.button,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  payButtonText: {
    color: PAYMENT_COLORS.buttonText,
    fontSize: 17,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: PAYMENT_COLORS.placeholder,
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    color: PAYMENT_COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
});