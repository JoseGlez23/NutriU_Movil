import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshControl
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNutriologo } from '../context/NutriologoContext';
import { supabase } from '../lib/supabase';
import { useUser } from '../hooks/useUser';
import { CardField, useStripe } from '@stripe/stripe-react-native';

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

const CLINIC_OPEN_HOUR = 7;
const CLINIC_CLOSE_HOUR = 16;

export default function ScheduleScreen({ navigation, route }: any) {
  const { user: authUser } = useAuth();
  const { user: patientData, refreshUser } = useUser();
  const { refreshNutriologo, nutriologo } = useNutriologo();

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

  // Separar citas pendientes en dos categorías
  const [pendingPaymentAppointments, setPendingPaymentAppointments] = useState<any[]>([]);
  const [paidPendingAppointments, setPaidPendingAppointments] = useState<any[]>([]);
  const [confirmedAppointments, setConfirmedAppointments] = useState<any[]>([]);
  const [activeRelationSince, setActiveRelationSince] = useState<string | null>(null);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);

  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const [nutriologoInfoModal, setNutriologoInfoModal] = useState(false);
  const [nutriologoInfoMsg, setNutriologoInfoMsg] = useState('');

  const { confirmPayment } = useStripe();

  // Detectar si viene desde Calendar con citaId
  useEffect(() => {
    if (route.params?.citaId) {
      setCitaId(route.params.citaId);
      const doctorId = Number(route.params.doctorId);
      setSelectedDoctor({ 
        name: route.params.doctorName || 'Nutriólogo',
        realId: isNaN(doctorId) ? 0 : doctorId,
        price: route.params.precio || 800
      });
      setPaymentStep('checkout');
    }
  }, [route.params]);

  useEffect(() => {
    const initialTab = route.params?.initialTab;
    if (initialTab && ['agendar', 'pendientes', 'confirmadas'].includes(initialTab)) {
      setViewMode(initialTab);
    }
  }, [route.params?.initialTab]);

  // Animaciones de loading
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

  // Función para refrescar datos (pull-to-refresh)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    if (viewMode === 'agendar') {
      await fetchDoctors();
    } else {
      await fetchAppointments();
    }
    
    setRefreshing(false);
  }, [viewMode]);

  // Función para cargar doctores
  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nutriologos')
        .select('id_nutriologo, nombre, apellido, especialidad, tarifa_consulta, foto_perfil')
        .eq('activo', true)
        .order('nombre');

      if (error) {
        console.error('Error al cargar nutriólogos:', error.message);
        Alert.alert('Error', 'No se pudieron cargar los nutriólogos. Intenta más tarde.');
        return;
      }

      const formatted = data?.map(d => {
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
      }) || [];

      setDoctors(formatted);
    } catch (err) {
      console.error('Excepción al cargar nutriólogos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar citas
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
        throw relationError;
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
        .in('estado', ['pendiente', 'pagada', 'confirmada', 'completada'])
        .order('fecha_hora', { ascending: false });

      if (error) {
        console.error('Error al cargar citas:', error.message);
        Alert.alert('Error', 'No se pudieron cargar tus citas. Intenta más tarde.');
        return;
      }

      const relationStartMs = new Date(relationStartDate).getTime();

      const formatted = ((data || []).map(cita => {
        const nutri: any = Array.isArray(cita.nutriologos) ? cita.nutriologos[0] : cita.nutriologos;
        if (!nutri) return null;

        const fechaHora = new Date(cita.fecha_hora);

        const fecha = fechaHora.toLocaleDateString('es-MX', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });

        const hora = fechaHora.toLocaleTimeString('es-MX', { 
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
        
        // Estado real basado en pago y estado de cita
        let estadoReal = cita.estado;
        if (cita.estado === 'pendiente' && tienePago) {
          estadoReal = 'pagada';
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
          isCurrentCycle: Number.isFinite(new Date(cita.fecha_hora).getTime())
            ? new Date(cita.fecha_hora).getTime() >= relationStartMs
            : false,
          tienePago,
          pagoInfo: pagos.length > 0 ? pagos[0] : null,
        };
      }) || []).filter((item): item is any => item !== null);

      // Separar citas pendientes
      const pendingPayment = formatted.filter((a: any) => 
        a && a.estado === 'pendiente' && !a.tienePago
      );
      
      const paidPending = formatted.filter((a: any) => 
        a && (a.estado === 'pagada' || (a.estado === 'pendiente' && a.tienePago))
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
      console.error('Excepción al cargar citas:', err);
      setActiveRelationSince(null);
      setPendingPaymentAppointments([]);
      setPaidPendingAppointments([]);
      setConfirmedAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // Cargar nutriólogos
  useEffect(() => {
    fetchDoctors();
  }, []);

  // Cargar citas del paciente
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
      Alert.alert(
        'Nutriólogo asignado',
        `Actualmente tu nutriólogo de cabecera es Dr. ${nutriologo.nombre} ${nutriologo.apellido}. No puedes agendar con otro hasta desasignarte.`
      );
      return;
    }

    // Verificar si ya es su nutriólogo de cabecera
    if (nutriologo && nutriologo.id_nutriologo === doctor.realId) {
      // Mostrar modal informativo
      setSelectedDoctor(doctor);
      setNutriologoInfoModal(true);
      return; // ✅ NO NAVEGA A CALENDAR, NO COBRA
    }
    
    // Si no es su nutriólogo, proceder normalmente
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
              console.error('Error limpiando confirmadas:', err);
              Alert.alert('Error', 'No se pudieron limpiar las citas confirmadas.');
            }
          },
        },
      ]
    );
  };

  const handlePaymentFromPending = (appointment: any) => {
    setSelectedDoctor({
      name: appointment.doctorName,
      realId: appointment.id_nutriologo,
      price: appointment.monto
    });
    setCitaId(appointment.id);
    setPaymentStep('checkout');
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
      const response = await fetch('https://carolin-nonprovisional-correctly.ngrok-free.dev/payments/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: citaId,
          userId: patientData.id_paciente,
          appointmentTitle: `Consulta con ${selectedDoctor.name}`,
          monto: selectedDoctor.price
        }),
      });

      const text = await response.text();
      console.log('Respuesta del backend (create-payment-intent):', text);

      if (!response.ok) {
        throw new Error(`Error del backend: ${response.status} - ${text}`);
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

      // Guardar pago
      const { error: insertError } = await supabase
        .from('pagos')
        .insert({
          id_cita: citaId,
          id_paciente: patientData.id_paciente,
          id_nutriologo: selectedDoctor.realId,
          monto: selectedDoctor.price,
          metodo_pago: 'stripe',
          estado: 'completado',
          stripe_payment_id: paymentIntent.id,
          fecha_pago: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      // Actualizar cita
      await supabase
        .from('citas')
        .update({ estado: 'pagada' })
        .eq('id_cita', citaId);

      // 🔥 VERIFICAR RELACIÓN CON NUTRIÓLOGO
      try {
        console.log('📝 Verificando relación con nutriólogo...');
        
        // Verificar si ya tiene una relación activa con este nutriólogo
        const { data: relacionExistente } = await supabase
          .from('paciente_nutriologo')
          .select('id_relacion, activo')
          .eq('id_paciente', patientData.id_paciente)
          .eq('id_nutriologo', selectedDoctor.realId)
          .maybeSingle();

        if (relacionExistente) {
          // Ya tiene relación con este nutriólogo
          console.log('⚠️ Ya tiene relación con este nutriólogo - solo actualizando a activo');
          
          // Actualizar a activo si estaba inactivo
          if (!relacionExistente.activo) {
            await supabase
              .from('paciente_nutriologo')
              .update({ activo: true, fecha_asignacion: new Date().toISOString() })
              .eq('id_relacion', relacionExistente.id_relacion);
          }
        } else {
          // No tiene relación, crear nueva
          console.log('✅ Creando nueva relación con nutriólogo');
          
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
          }
        }
        
        // Refrescar datos
        await refreshUser();
        await new Promise(resolve => setTimeout(resolve, 1500));
        await refreshNutriologo();
        
      } catch (error) {
        console.error('Error en asignación de nutriólogo:', error);
      }

      // Recargar citas y cambiar vista
      await fetchAppointments();
      setViewMode('pendientes');
      setPaymentStep('success');

    } catch (err: any) {
      console.error('Error completo en handlePayment:', err);
      setPaymentError(err.message || 'Error desconocido al procesar el pago.');
      Alert.alert('Error en el pago', err.message || 'No se pudo completar el pago.');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setPaymentStep('selection');
    setSelectedDoctor(null);
    setPaymentError(null);
    setCardName('');
    setCitaId(null);
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
                    selectedAppointment.estado === 'pagada' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? detailsModalStyles.paidStatus :
                    selectedAppointment.estado === 'confirmada' ? detailsModalStyles.confirmedStatus :
                    detailsModalStyles.completedStatus
                  ]}>
                    <Ionicons 
                      name={
                        selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago ? "time-outline" :
                        selectedAppointment.estado === 'pagada' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? "card-outline" :
                        selectedAppointment.estado === 'confirmada' ? "checkmark-circle" : "checkmark-done-circle"
                      } 
                      size={16} 
                      color={
                        selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago ? COLORS.pendingPayment :
                        selectedAppointment.estado === 'pagada' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? COLORS.paid :
                        selectedAppointment.estado === 'confirmada' ? COLORS.success : COLORS.primary
                      } 
                    />
                    <Text style={detailsModalStyles.statusText}>
                      {selectedAppointment.estado === 'pendiente' && !selectedAppointment.tienePago ? 'Pendiente de pago' :
                       selectedAppointment.estado === 'pagada' || (selectedAppointment.estado === 'pendiente' && selectedAppointment.tienePago) ? 'Pagada - Esperando confirmación' :
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
      <Modal visible={paymentStep !== 'selection'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.paymentCard}>
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
                  <View style={styles.divider} />
                  <View style={styles.receiptLine}>
                    <Text style={styles.totalLabel}>Total a pagar:</Text>
                    <Text style={styles.totalValue}>
                      ${selectedDoctor?.price ? selectedDoctor.price.toLocaleString('es-MX') : '0.00'} MXN
                    </Text>
                  </View>
                </View>

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
                        Pagar ${selectedDoctor?.price ? selectedDoctor.price.toLocaleString('es-MX') : '0.00'} MXN
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
                
                <Text style={detailsModalStyles.assignedDoctorName}>
                  {selectedDoctor?.name || 'Este nutriólogo'}
                </Text>
                
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
  viewDetailsButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary },
  viewDetailsText: { fontSize: 12, color: COLORS.primary, fontWeight: '800', marginRight: 4 },
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
  paymentCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, minHeight: 500, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textDark, marginBottom: 25 },
  receiptContainer: { width: '100%', backgroundColor: COLORS.secondary, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 25 },
  receiptLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptLabel: { color: COLORS.textLight, fontWeight: '700', fontSize: 14 },
  receiptValue: { color: COLORS.textDark, fontWeight: '800', fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10, borderStyle: 'dashed', borderWidth: 0.5 },
  totalLabel: { fontSize: 18, fontWeight: '900', color: COLORS.textDark },
  totalValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
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
  assignedContent: {
    alignItems: 'center',
    marginBottom: 16,
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
  assignedDoctorName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 6,
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