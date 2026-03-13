import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Animated,
  RefreshControl,
  Dimensions,
  StatusBar,
  Easing,
  Image,
  Modal,
  FlatList,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HamburgerMenu from '../components/HamburgerMenu';
import { useUser } from '../hooks/useUser';
import { useProfileImage } from '../context/ProfileImageContext';
import { useNutriologo } from '../context/NutriologoContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { saveToCache, getFromCache } from '../utils/offlineCache';
import NetInfo from '@react-native-community/netinfo';
import { useNetwork } from '../utils/NetworkHandler';
import { patientPlanService } from '../services/patientPlanService';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#D1E8D5',
  notification: '#FF6B6B',
  unread: '#E8F5E9',
  accept: '#4CAF50',
  reject: '#F44336',
  pending: '#FFC107',
};

const TIMEZONE = 'America/Hermosillo'; // SaYA SE SUBIO WE PORFIN ALV

// Componentes de animación (sin cambios)
const FloatingIcons = () => {
  const icons = ['leaf-outline', 'nutrition-outline', 'fitness-outline', 'heart-outline'];
  return (
    <View style={StyleSheet.absoluteFill}>
      {[...Array(6)].map((_, i) => (
        <SingleFloatingIcon key={i} name={icons[i % icons.length]} delay={i * 2000} />
      ))}
    </View>
  );
};

const SingleFloatingIcon = ({ name, delay }: any) => {
  const moveAnim = useRef(new Animated.Value(0)).current;
  const randomLeft = useRef(Math.random() * width).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(moveAnim, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
        delay: delay
      })
    ).start();
  }, []);
  const translateY = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, -100]
  });
  return (
    <Animated.View style={{ position: 'absolute', left: randomLeft, transform: [{ translateY }], opacity: 0.05 }}>
      <Ionicons name={name} size={40} color={COLORS.primary} />
    </Animated.View>
  );
};

// Componente de notificaciones
const NotificationBell = ({ onPress, unreadCount }: any) => (
  <TouchableOpacity onPress={onPress} style={styles.notificationBell}>
    <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
    {unreadCount > 0 && (
      <View style={styles.notificationBadge}>
        <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const NotificationModal = ({ visible, onClose, notifications, onMarkAsRead, onClearAll, onAcceptAppointment, onRejectAppointment, onGoToPayment, onDenyAppointment, onViewNotification }: any) => {
  const getNotificationStatus = (item: any) => {
    return String(item?.datos_adicionales?.estado || item?.estado || '').toLowerCase();
  };

  const isPointsNotification = (item: any) => {
    const subtipo = item?.datos_adicionales?.subtipo;
    if (subtipo === 'puntos_asignados') return true;

    const title = String(item?.titulo || '').toLowerCase();
    const message = String(item?.mensaje || '').toLowerCase();
    return title.includes('puntos') || message.includes('puntos');
  };

  const isDietNotification = (item: any) => {
    const subtipo = item?.datos_adicionales?.subtipo;
    if (subtipo === 'dieta_asignada') return true;

    const title = String(item?.titulo || '').toLowerCase();
    const message = String(item?.mensaje || '').toLowerCase();
    return title.includes('dieta') || message.includes('plan nutricional') || message.includes('dieta');
  };

  const isPendingPaymentNotification = (item: any) => {
    if (isPointsNotification(item) || isDietNotification(item)) return false;

    const estado = getNotificationStatus(item);
    const requierePago = item?.datos_adicionales?.requiere_pago === true;

    if (estado === 'pendiente_pagado' || estado === 'pagada' || estado === 'confirmada' || estado === 'cancelada' || estado === 'rechazada') {
      return false;
    }

    return (
      item.tipo === 'cita_pendiente_pago' ||
      (item.tipo === 'pago' && (requierePago || estado === 'pendiente_pago')) ||
      requierePago ||
      estado === 'pendiente_pago' ||
      (item.tipo === 'cita' && estado === 'pendiente' && !!item.datos_adicionales?.id_cita)
    );
  };

  const isPaidAppointmentNotification = (item: any) => {
    if (isPointsNotification(item) || isDietNotification(item)) return false;

    const estado = getNotificationStatus(item);
    return estado === 'pendiente_pagado' || estado === 'pagada';
  };

  const isViewOnlyNotification = (item: any) => {
    return isDietNotification(item) || isPointsNotification(item);
  };

  const renderNotification = ({ item }: any) => (
    <View style={[styles.notificationItem, !item.leida && styles.unreadNotification]}>
      <TouchableOpacity 
        style={styles.notificationContent}
        onPress={() => onMarkAsRead(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationIcon}>
          <Ionicons 
            name={getNotificationIcon(item)} 
            size={24} 
            color={item.leida ? COLORS.textLight : COLORS.primary} 
          />
        </View>
        <View style={styles.notificationTextContainer}>
          <Text style={[styles.notificationTitle, !item.leida && styles.unreadText]}>{item.titulo}</Text>
          <Text style={styles.notificationMessage}>{item.mensaje}</Text>
          <Text style={styles.notificationTime}>{formatTime(item.fecha_envio)}</Text>
        </View>
        {!item.leida && <View style={styles.unreadDot} />}
      </TouchableOpacity>
      
      {/* Decisión para citas pendientes de pago */}
      {isPendingPaymentNotification(item) && !isViewOnlyNotification(item) && (
        <View style={styles.notificationActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => onGoToPayment(item)}
          >
            <Ionicons name="card-outline" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Aceptar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => onDenyAppointment(item)}
          >
            <Ionicons name="close" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Denegar</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPaidAppointmentNotification(item) && (
        <View style={styles.notificationActions}>
          <View style={styles.statusBadgePaid}>
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.accept} />
            <Text style={styles.statusBadgePaidText}>Cita pagada</Text>
          </View>
        </View>
      )}

      {/* Compatibilidad con flujo anterior */}
      {!isPendingPaymentNotification(item) && !isPaidAppointmentNotification(item) && !isViewOnlyNotification(item) && item.tipo === 'cita' && getNotificationStatus(item) === 'pendiente' && (
        <View style={styles.notificationActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => onAcceptAppointment(item)}
          >
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Aceptar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => onRejectAppointment(item)}
          >
            <Ionicons name="close" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}

      {isViewOnlyNotification(item) && (
        <View style={styles.notificationActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => onViewNotification(item)}
          >
            <Ionicons name="eye-outline" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>Ver</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const getNotificationIcon = (notification: any) => {
    const tipo = notification?.tipo;
    const subtipo = notification?.datos_adicionales?.subtipo;

    switch(tipo) {
      case 'cita': return 'calendar-outline';
      case 'cita_pendiente_pago': return 'card-outline';
      case 'pago': return 'card-outline';
      case 'bienvenida_nutriologo': return 'person-outline';
      case 'sistema': return subtipo === 'bienvenida_nutriologo' ? 'person-outline' : 'notifications-outline';
      case 'meta': return 'trophy-outline';
      case 'recordatorio': return 'alarm-outline';
      default: return 'notifications-outline';
    }
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Hace unos momentos';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `Hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    return 'Hace unos momentos';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notificaciones</Text>
            <View style={styles.modalHeaderButtons}>
              <TouchableOpacity onPress={onClearAll} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Limpiar todo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
          </View>
          
          {notifications.length > 0 ? (
            <FlatList
              data={notifications}
              renderItem={renderNotification}
              keyExtractor={(item) => item.id_notificacion.toString()}
              contentContainerStyle={styles.notificationsList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyNotifications}>
              <Ionicons name="notifications-off-outline" size={50} color={COLORS.textLight} />
              <Text style={styles.emptyNotificationsText}>No hay notificaciones</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default function DashboardScreen({ navigation }: any) {
  const { user, refreshUserData, error: userError } = useUser();
  const { refreshNutriologo, nutriologo, estadoNutriologo, loading: loadingNutriologo } = useNutriologo();
  const { profileImage } = useProfileImage();
  const { notifyOffline } = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  // Puntos con fallback desde caché local si aún no carga
  const [localUserPoints, setLocalUserPoints] = useState(0);
  const [localTodayPoints, setLocalTodayPoints] = useState(0);

  // Estado para notificaciones desde Supabase
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [appointmentDecisionModal, setAppointmentDecisionModal] = useState<{
    visible: boolean;
    mode: 'rechazar' | 'denegar';
    title: string;
    message: string;
    confirmText: string;
    notification: any | null;
  }>({
    visible: false,
    mode: 'rechazar',
    title: '',
    message: '',
    confirmText: 'Confirmar',
    notification: null,
  });
  const [appointmentFeedbackModal, setAppointmentFeedbackModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon: 'checkmark-circle-outline' | 'close-circle-outline';
    color: string;
  }>({
    visible: false,
    title: '',
    message: '',
    icon: 'checkmark-circle-outline',
    color: COLORS.accept,
  });
  const [isProcessingAppointmentAction, setIsProcessingAppointmentAction] = useState(false);
  const navigationLockRef = useRef(false);

  const closeAppointmentDecisionModal = () => {
    if (isProcessingAppointmentAction) return;
    setAppointmentDecisionModal((prev) => ({ ...prev, visible: false, notification: null }));
  };

  const closeAppointmentFeedbackModal = () => {
    setAppointmentFeedbackModal((prev) => ({ ...prev, visible: false }));
  };

  const showAppointmentFeedback = (
    title: string,
    message: string,
    isError = false
  ) => {
    setAppointmentFeedbackModal({
      visible: true,
      title,
      message,
      icon: isError ? 'close-circle-outline' : 'checkmark-circle-outline',
      color: isError ? COLORS.reject : COLORS.accept,
    });
  };

  const safeNavigate = useCallback((routeName: string, params?: any) => {
    if (navigationLockRef.current) return;

    navigationLockRef.current = true;
    navigation.navigate(routeName, params);

    setTimeout(() => {
      navigationLockRef.current = false;
    }, 700);
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      navigationLockRef.current = false;
    });

    return unsubscribe;
  }, [navigation]);

  const sortNotificationsByDate = (items: any[]) => {
    return [...items].sort((a, b) => {
      const dateA = new Date(a?.fecha_envio || 0).getTime();
      const dateB = new Date(b?.fecha_envio || 0).getTime();
      return dateB - dateA;
    });
  };

  // Carga inicial desde caché (instantáneo)
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const cached = await AsyncStorage.getItem('dashboard_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          setLocalUserPoints(parsed.puntos_totales || 0);
          setLocalTodayPoints(parsed.puntos_hoy || 0);
        }
      } catch (e) {
        console.warn("Error leyendo caché dashboard:", e);
      }
    };
    loadCachedData();
  }, []);

  // Actualiza local cuando user llega fresco (y guarda en caché)
  useEffect(() => {
    if (user) {
      const newPoints = user?.puntos_totales || 0;
      const newToday = user?.puntos_hoy || 0;

      setLocalUserPoints(newPoints);
      setLocalTodayPoints(newToday);

      // Guardar en caché
      AsyncStorage.setItem('dashboard_cache', JSON.stringify({
        puntos_totales: newPoints,
        puntos_hoy: newToday,
        timestamp: Date.now(),
      })).catch(e => console.warn("Error guardando caché:", e));
    }
  }, [user]);

  const appendPendingPaymentNotifications = useCallback(async (baseNotifications: any[]) => {
    return sortNotificationsByDate(baseNotifications);
  }, []);

  const ensureNutriologoAssignmentNotifications = useCallback(async () => {
    if (!user?.id_paciente) return;

    try {
      const patientId = user.id_paciente;

      const { data: latestActiveDiet } = await supabase
        .from('dietas')
        .select('id_dieta, nombre_dieta, created_at')
        .eq('id_paciente', patientId)
        .eq('activa', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestActiveDiet?.id_dieta) {
        const { data: existingDietNotification } = await supabase
          .from('notificaciones')
          .select('id_notificacion')
          .eq('id_usuario', patientId)
          .eq('tipo_usuario', 'paciente')
          .eq('datos_adicionales->>subtipo', 'dieta_asignada')
          .eq('datos_adicionales->>id_dieta', String(latestActiveDiet.id_dieta))
          .limit(1);

        if (!existingDietNotification || existingDietNotification.length === 0) {
          const { error: insertDietNotificationError } = await supabase
            .from('notificaciones')
            .insert({
              id_usuario: patientId,
              tipo_usuario: 'paciente',
              titulo: 'Nueva dieta asignada',
              mensaje: 'Tu nutriólogo te asignó una dieta. Toca para verla en Nutrición.',
              tipo: 'recordatorio',
              leida: false,
              fecha_envio: new Date().toISOString(),
              datos_adicionales: {
                subtipo: 'dieta_asignada',
                id_dieta: latestActiveDiet.id_dieta,
                destino: 'FoodTracking',
              },
            });

          if (insertDietNotificationError) {
            console.warn('No se pudo crear notificación de dieta asignada:', insertDietNotificationError.message);
          }
        }
      }

      const { data: potentialAssignedPointsLogs, error: pointsLogsError } = await supabase
        .from('log_puntos')
        .select('id_log, puntos, descripcion, fecha, tipo_accion')
        .eq('id_paciente', patientId)
        .gt('puntos', 0)
        .eq('tipo_accion', 'otro')
        .order('fecha', { ascending: false })
        .limit(20);

      if (pointsLogsError) throw pointsLogsError;

      if (potentialAssignedPointsLogs && potentialAssignedPointsLogs.length > 0) {
        const { data: existingPointsNotifications, error: existingPointsNotificationsError } = await supabase
          .from('notificaciones')
          .select('datos_adicionales')
          .eq('id_usuario', patientId)
          .eq('tipo_usuario', 'paciente')
          .eq('datos_adicionales->>subtipo', 'puntos_asignados');

        if (existingPointsNotificationsError) throw existingPointsNotificationsError;

        const existingLogIds = new Set(
          (existingPointsNotifications || [])
            .map((item: any) => String(item?.datos_adicionales?.id_log || ''))
            .filter(Boolean)
        );

        const newPointNotifications = potentialAssignedPointsLogs
          .filter((log: any) => !existingLogIds.has(String(log.id_log)))
          .map((log: any) => ({
            id_usuario: patientId,
            tipo_usuario: 'paciente',
            titulo: 'Puntos asignados',
            mensaje: `Tu nutriólogo te asignó ${log.puntos} puntos. Toca para ver tus puntos acumulados.`,
            tipo: 'meta',
            leida: false,
            fecha_envio: log.fecha || new Date().toISOString(),
            datos_adicionales: {
              subtipo: 'puntos_asignados',
              id_log: log.id_log,
              puntos: log.puntos,
              descripcion: log.descripcion,
              destino: 'Points',
            },
          }));

        if (newPointNotifications.length > 0) {
          const { error: insertPointsNotificationsError } = await supabase
            .from('notificaciones')
            .insert(newPointNotifications);

          if (insertPointsNotificationsError) {
            console.warn('No se pudo crear notificación de puntos asignados:', insertPointsNotificationsError.message);
          }
        }
      }
    } catch (error) {
      console.warn('Error sincronizando notificaciones de dieta/puntos:', error);
    }
  }, [user]);

  // Cargar notificaciones desde Supabase
  const loadNotifications = useCallback(async () => {
    if (!user?.id_paciente) return;

    setLoadingNotifications(true);
    try {
      // Comentado: esta función recreaba notificaciones borradas por el usuario
      // await ensureNutriologoAssignmentNotifications();

      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('id_usuario', user.id_paciente)
        .eq('tipo_usuario', 'paciente')
        .order('fecha_envio', { ascending: false });

      if (error) throw error;
      const withPendingPayments = await appendPendingPaymentNotifications(data || []);
      setNotifications(withPendingPayments);
    } catch (error) {
      const netInfo = await NetInfo.fetch();
      const isOnline = Boolean(netInfo.isConnected && netInfo.isInternetReachable !== false);
      if (!isOnline) {
        notifyOffline();
      }
    } finally {
      setLoadingNotifications(false);
    }
  }, [user, appendPendingPaymentNotifications, notifyOffline]);

  // Cargar notificaciones cuando el usuario esté disponible
  useEffect(() => {
    if (user?.id_paciente) {
      loadNotifications();

      // Suscribirse a nuevas notificaciones en tiempo real
      const subscription = supabase
        .channel('notificaciones_channel')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notificaciones',
            filter: `id_usuario=eq.${user.id_paciente}`
          }, 
          (payload) => {
            // Agregar nueva notificación al inicio
            setNotifications(prev => sortNotificationsByDate([payload.new, ...prev]));
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUserData(); // refresca datos reales
    await loadNotifications(); // refrescar notificaciones
    setRefreshing(false);
  };

  // Funciones para manejar notificaciones
  const unreadCount = notifications.filter(n => !n.leida).length;

  const markAsRead = async (id: any) => {
    const targetNotification = notifications.find(notif => notif.id_notificacion === id);
    const shouldRemoveOnRead =
      targetNotification?.tipo === 'bienvenida_nutriologo' ||
      targetNotification?.datos_adicionales?.subtipo === 'bienvenida_nutriologo';

    if (typeof id !== 'number') {
      if (shouldRemoveOnRead) {
        setNotifications(prev => prev.filter(notif => notif.id_notificacion !== id));
      } else {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id_notificacion === id ? { ...notif, leida: true } : notif
          )
        );
      }
      return;
    }

    try {
      if (shouldRemoveOnRead) {
        const { error } = await supabase
          .from('notificaciones')
          .delete()
          .eq('id_notificacion', id);

        if (error) throw error;

        setNotifications(prev => prev.filter(notif => notif.id_notificacion !== id));
        return;
      }

      const { error } = await supabase
        .from('notificaciones')
        .update({ 
          leida: true, 
          fecha_leida: new Date().toISOString() 
        })
        .eq('id_notificacion', id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(notif =>
          notif.id_notificacion === id ? { ...notif, leida: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  };

  const handleNotificationPress = async (notification: any) => {
    const subtipo = notification?.datos_adicionales?.subtipo;
    const title = String(notification?.titulo || '').toLowerCase();
    const message = String(notification?.mensaje || '').toLowerCase();
    const isPointsByText = title.includes('puntos') || message.includes('puntos');
    const isDietByText = title.includes('dieta') || message.includes('plan nutricional') || message.includes('dieta');

    if (subtipo === 'dieta_asignada' || isDietByText) {
      await markAsRead(notification.id_notificacion);
      setNotificationsVisible(false);
      safeNavigate('FoodTracking');
      return;
    }

    if (subtipo === 'puntos_asignados' || isPointsByText) {
      await markAsRead(notification.id_notificacion);
      setNotificationsVisible(false);
      safeNavigate('Points');
      return;
    }

    await markAsRead(notification.id_notificacion);
  };

  const handleGoToPayment = async (notification: any) => {
    const datos = notification?.datos_adicionales || {};
    const citaId = Number(datos.id_cita);
    const doctorId = Number(datos.id_nutriologo);
    let doctorName = datos.doctor_nombre || 'Nutriólogo';
    let precio = Number(datos.precio || 0);

    if (doctorId && (!precio || precio <= 0 || !datos.doctor_nombre)) {
      const { data: nutriologoData, error: nutriologoError } = await supabase
        .from('nutriologos')
        .select('nombre, apellido, tarifa_consulta')
        .eq('id_nutriologo', doctorId)
        .maybeSingle();

      if (!nutriologoError && nutriologoData) {
        const resolvedName = `${nutriologoData.nombre || ''} ${nutriologoData.apellido || ''}`.trim();
        doctorName = resolvedName || doctorName;
        precio = Number(nutriologoData.tarifa_consulta || precio || 0);
      }
    }

    await markAsRead(notification.id_notificacion);
    setNotificationsVisible(false);

    if (citaId && doctorId) {
      safeNavigate('Schedule', {
        initialTab: 'pendientes',
        citaId,
        doctorId,
        doctorName,
        precio,
      });
      return;
    }

    safeNavigate('Schedule', { initialTab: 'pendientes' });
  };

  const executeDenyAppointment = async (notification: any) => {
    const datos = notification?.datos_adicionales || {};
    const citaId = Number(datos.id_cita);
    const nutriologoId = Number(datos.id_nutriologo);

    try {
      let resolvedNutriologoId = nutriologoId;

      if (!resolvedNutriologoId && citaId) {
        const { data: citaData, error: citaNutriError } = await supabase
          .from('citas')
          .select('id_nutriologo')
          .eq('id_cita', citaId)
          .maybeSingle();

        if (citaNutriError) throw citaNutriError;
        resolvedNutriologoId = Number(citaData?.id_nutriologo || 0);
      }

      if (citaId) {
        let citaQuery = supabase
          .from('citas')
          .update({ estado: 'cancelada' })
          .eq('id_paciente', user?.id_paciente)
          .in('estado', ['pendiente', 'pagada']);

        if (resolvedNutriologoId) {
          citaQuery = citaQuery.eq('id_nutriologo', resolvedNutriologoId);
        } else {
          citaQuery = citaQuery.eq('id_cita', citaId);
        }

        const { error: citaError } = await citaQuery;

        if (citaError) throw citaError;
      }

      if (user?.id_paciente) {
        let relationQuery = supabase
          .from('paciente_nutriologo')
          .update({ activo: false })
          .eq('id_paciente', user.id_paciente)
          .eq('activo', true);

        if (resolvedNutriologoId) {
          relationQuery = relationQuery.eq('id_nutriologo', resolvedNutriologoId);
        }

        const { error: relationError } = await relationQuery;

        if (relationError) throw relationError;

        const { success: plansCleared, error: clearPlansError } = await patientPlanService.clearActivePlans(user.id_paciente);
        if (!plansCleared) {
          throw new Error(clearPlansError || 'No se pudieron limpiar dieta y rutina activas');
        }
      }

      if (user?.id_paciente) {
        const { error: clearError } = await supabase
          .from('notificaciones')
          .delete()
          .eq('id_usuario', user.id_paciente)
          .eq('tipo_usuario', 'paciente');

        if (clearError) throw clearError;
      }

      setNotifications([]);
      await refreshNutriologo();

      showAppointmentFeedback(
        'Cita denegada',
        'El nutriólogo ya no verá tu información. Puedes agendar nuevamente cuando quieras.'
      );
    } catch (error) {
      console.error('Error denegando cita:', error);
      showAppointmentFeedback('Error', 'No se pudo denegar la cita. Intenta nuevamente.', true);
    }
  };

  const handleDenyAppointment = (notification: any) => {
    setAppointmentDecisionModal({
      visible: true,
      mode: 'denegar',
      title: 'Denegar cita',
      message: 'Si deniegas esta cita, el nutriólogo ya no podrá ver tu información y podrás agendar de nuevo con el mismo u otro nutriólogo. ¿Deseas continuar?',
      confirmText: 'Denegar',
      notification,
    });
  };

  const openNotifications = async () => {
    if (navigationLockRef.current) return;
    navigationLockRef.current = true;

    setNotificationsVisible(true);
    try {
      await loadNotifications();
    } finally {
      setTimeout(() => {
        navigationLockRef.current = false;
      }, 700);
    }
  };

  const closeNotifications = () => {
    setNotificationsVisible(false);
    navigationLockRef.current = false;
  };

  const clearAllNotifications = async () => {
    if (!user?.id_paciente) return;

    Alert.alert(
      'Limpiar notificaciones',
      '¿Estás seguro de que quieres eliminar todas las notificaciones?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('notificaciones')
                .delete()
                .eq('id_usuario', user.id_paciente)
                .eq('tipo_usuario', 'paciente');

              if (error) throw error;
              setNotifications([]);
            } catch (error) {
              console.error('Error eliminando notificaciones:', error);
              Alert.alert('Error', 'No se pudieron eliminar las notificaciones');
            }
          }
        }
      ]
    );
  };

  // Manejar aceptación de cita
  const handleAcceptAppointment = async (notification: any) => {
    try {
      const datos = notification.datos_adicionales || {};
      
      // Actualizar estado de la cita
      const { error: citaError } = await supabase
        .from('citas')
        .update({ estado: 'confirmada' })
        .eq('id_cita', datos.id_cita);

      if (citaError) throw citaError;

      // Crear notificación de confirmación
      const { error: notifError } = await supabase
        .from('notificaciones')
        .insert({
          id_usuario: user?.id_paciente,
          tipo_usuario: 'paciente',
          titulo: 'Cita confirmada',
          mensaje: `Tu cita ha sido confirmada exitosamente`,
          tipo: 'cita',
          datos_adicionales: { id_cita: datos.id_cita, estado: 'confirmada' }
        });

      if (notifError) throw notifError;

      // Marcar notificación original como leída
      await markAsRead(notification.id_notificacion);

      Alert.alert('Éxito', 'Cita confirmada correctamente');
      await loadNotifications(); // Recargar notificaciones
    } catch (error) {
      console.error('Error aceptando cita:', error);
      Alert.alert('Error', 'No se pudo confirmar la cita');
    }
  };

  // Manejar rechazo de cita
  const executeRejectAppointment = async (notification: any) => {
    try {
      const datos = notification.datos_adicionales || {};
      
      // Actualizar estado de la cita
      const { error: citaError } = await supabase
        .from('citas')
        .update({ estado: 'cancelada' })
        .eq('id_cita', datos.id_cita);

      if (citaError) throw citaError;

      // Crear notificación de rechazo
      const { error: notifError } = await supabase
        .from('notificaciones')
        .insert({
          id_usuario: user?.id_paciente,
          tipo_usuario: 'paciente',
          titulo: 'Cita rechazada',
          mensaje: `Has rechazado la cita. Puedes agendar con otro nutriólogo`,
          tipo: 'cita',
          datos_adicionales: { id_cita: datos.id_cita, estado: 'rechazada' }
        });

      if (notifError) throw notifError;

      // Marcar notificación original como leída
      await markAsRead(notification.id_notificacion);

      showAppointmentFeedback('Cita rechazada', 'Puedes agendar una nueva cita con otro nutriólogo');
      await loadNotifications(); // Recargar notificaciones
    } catch (error) {
      console.error('Error rechazando cita:', error);
      showAppointmentFeedback('Error', 'No se pudo rechazar la cita', true);
    }
  };

  const handleRejectAppointment = (notification: any) => {
    setAppointmentDecisionModal({
      visible: true,
      mode: 'rechazar',
      title: 'Rechazar cita',
      message: '¿Estás seguro de que quieres rechazar esta cita?',
      confirmText: 'Rechazar',
      notification,
    });
  };

  const confirmAppointmentDecision = async () => {
    const current = appointmentDecisionModal.notification;
    if (!current || isProcessingAppointmentAction) return;

    setIsProcessingAppointmentAction(true);

    if (appointmentDecisionModal.mode === 'denegar') {
      await executeDenyAppointment(current);
    } else {
      await executeRejectAppointment(current);
    }

    setIsProcessingAppointmentAction(false);
    setAppointmentDecisionModal((prev) => ({ ...prev, visible: false, notification: null }));
  };

  // Lógica corregida de rango y manzana
  const getRankData = () => {
    const points = localUserPoints;

    if (points >= 10000) {
      return { 
        name: "DIAMANTE", 
        next: "MÁXIMO", 
        target: points, 
        color: '#3498DB',
      };
    }
    if (points >= 5000) {
      return { 
        name: "DIAMANTE", 
        next: "LEYENDA", 
        target: 10000, 
        color: '#3498DB',
      };
    }
    if (points >= 1000) {
      return { 
        name: "ORO", 
        next: "DIAMANTE", 
        target: 5000, 
        color: '#D4AF37',
      };
    }
    if (points >= 100) {
      return { 
        name: "PLATA", 
        next: "ORO", 
        target: 1000, 
        color: '#C0C0C0',
      };
    }
    return { 
      name: "COBRE", 
      next: "PLATA", 
      target: 100, 
      color: '#CD7F32',
    };
  };

  const rank = getRankData();
  const progress = rank.target > localUserPoints ? (localUserPoints / rank.target) * 100 : 100;

  // Lógica de imagen
  const getImageSource = () => {
    if (profileImage === 'usu.webp') {
      return require('../../assets/usu.webp');
    }
    return { uri: profileImage };
  };

  const hasNutriologoAsignado = Boolean(nutriologo && estadoNutriologo !== 'sin_asignar');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FloatingIcons />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIcon}>
          <Ionicons name="menu-outline" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        
        <View style={styles.brandContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
        </View>

        <View style={styles.headerRight}>
          <NotificationBell 
            onPress={openNotifications}
            unreadCount={unreadCount}
          />
          <TouchableOpacity onPress={() => safeNavigate('Profile')} style={styles.profileBtn}>
            <Image 
              source={getImageSource()} 
              style={styles.headerAvatar} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[COLORS.primary]} 
          />
        }
      >
        {!!userError && (
          <View style={styles.userErrorBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={COLORS.primary} />
            <Text style={styles.userErrorText}>{userError}</Text>
          </View>
        )}

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Panel General</Text>
          <Text style={styles.subtitleText}>Estado actual de tu perfil</Text>
        </View>

        <View style={styles.nutriologoCard}>
          <View style={styles.nutriologoHeader}>
            <Ionicons name="medical-outline" size={20} color={COLORS.primary} />
            <Text style={styles.nutriologoTitle}>Tu nutriólogo</Text>
          </View>

          {loadingNutriologo ? (
            <View style={styles.nutriologoLoadingRow}>
              <Ionicons name="time-outline" size={16} color={COLORS.textLight} />
              <Text style={styles.nutriologoHint}>Verificando asignación...</Text>
            </View>
          ) : hasNutriologoAsignado ? (
            <>
              <Text style={styles.nutriologoName}>
                Dr. {nutriologo?.nombre} {nutriologo?.apellido}
              </Text>
              {!!nutriologo?.especialidad && (
                <Text style={styles.nutriologoHint}>{nutriologo.especialidad}</Text>
              )}
            </>
          ) : (
            <Text style={styles.nutriologoHint}>No tienes nutriólogo asignado actualmente.</Text>
          )}
        </View>

        <TouchableOpacity 
          style={styles.pointsCard} 
          onPress={() => safeNavigate('Points')}
          activeOpacity={0.8}
        >
          <View style={styles.pointsRow}>
            <View>
              <Text style={styles.pointsLabel}>PUNTOS ACUMULADOS</Text>
              <Text style={styles.pointsValue}>{localUserPoints}</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]} />
            </View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>Ver detalles de rango</Text>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Servicios Disponibles</Text>
        
        <View style={styles.grid}>
          <ActionCard 
            title="NUTRICIÓN" 
            desc="Registro diario" 
            icon="nutrition-outline" 
            onPress={() => safeNavigate('FoodTracking')} 
          />
          <ActionCard 
            title="GIMNASIO" 
            desc="Mis rutinas" 
            icon="barbell-outline" 
            onPress={() => safeNavigate('MyRoutines')} 
          />
          <ActionCard 
            title="CITAS" 
            desc="Agendar con nutriólogo" 
            icon="calendar-outline" 
            onPress={() => safeNavigate('Schedule')} 
          />
        </View>
      </ScrollView>

      <HamburgerMenu isVisible={menuVisible} onClose={() => setMenuVisible(false)} navigation={navigation} />

      <NotificationModal
        visible={notificationsVisible}
        onClose={closeNotifications}
        notifications={notifications}
        onMarkAsRead={handleNotificationPress}
        onViewNotification={handleNotificationPress}
        onClearAll={clearAllNotifications}
        onAcceptAppointment={handleAcceptAppointment}
        onRejectAppointment={handleRejectAppointment}
        onGoToPayment={handleGoToPayment}
        onDenyAppointment={handleDenyAppointment}
      />

      <Modal
        visible={appointmentDecisionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeAppointmentDecisionModal}
      >
        <View style={styles.decisionModalOverlay}>
          <View style={styles.decisionModalCard}>
            <View style={styles.decisionIconWrap}>
              <Ionicons name="warning-outline" size={28} color={COLORS.reject} />
            </View>

            <Text style={styles.decisionModalTitle}>{appointmentDecisionModal.title}</Text>
            <Text style={styles.decisionModalMessage}>{appointmentDecisionModal.message}</Text>

            <View style={styles.decisionButtonsRow}>
              <TouchableOpacity
                style={styles.decisionCancelButton}
                onPress={closeAppointmentDecisionModal}
                disabled={isProcessingAppointmentAction}
              >
                <Text style={styles.decisionCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.decisionConfirmButton}
                onPress={confirmAppointmentDecision}
                disabled={isProcessingAppointmentAction}
              >
                {isProcessingAppointmentAction ? (
                  <Text style={styles.decisionConfirmText}>Procesando...</Text>
                ) : (
                  <Text style={styles.decisionConfirmText}>{appointmentDecisionModal.confirmText}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={appointmentFeedbackModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeAppointmentFeedbackModal}
      >
        <View style={styles.decisionModalOverlay}>
          <View style={styles.decisionModalCard}>
            <View style={styles.decisionIconWrap}>
              <Ionicons name={appointmentFeedbackModal.icon} size={30} color={appointmentFeedbackModal.color} />
            </View>

            <Text style={styles.decisionModalTitle}>{appointmentFeedbackModal.title}</Text>
            <Text style={styles.decisionModalMessage}>{appointmentFeedbackModal.message}</Text>

            <TouchableOpacity
              style={styles.decisionOkButton}
              onPress={closeAppointmentFeedbackModal}
            >
              <Text style={styles.decisionOkText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ActionCard = ({ title, desc, icon, onPress }: any) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.cardIconCircle}>
      <Ionicons name={icon} size={28} color={COLORS.primary} />
    </View>
    <View style={styles.cardTextContainer}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.secondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: { padding: 5 },
  brandContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  brandLogo: { width: 130, height: 38 },
  brandName: { fontSize: 20, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  underlineSmall: { width: 25, height: 3, backgroundColor: COLORS.accent, borderRadius: 2, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  notificationBell: { marginRight: 15, position: 'relative', padding: 5 },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.notification,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  notificationBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  profileBtn: { padding: 2 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#EEE'
  },
  scrollContent: { padding: 25 },
  welcomeContainer: { marginBottom: 25 },
  welcomeText: { fontSize: 24, fontWeight: '800', color: COLORS.textDark },
  subtitleText: { fontSize: 14, color: COLORS.textLight, fontWeight: '300' },
  nutriologoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  nutriologoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  nutriologoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  nutriologoName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  nutriologoHint: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  nutriologoLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pointsLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
  pointsValue: { fontSize: 36, fontWeight: '900', color: COLORS.textDark, marginTop: 5 },
  progressSection: { marginTop: 20 },
  progressBarBg: { height: 8, backgroundColor: COLORS.secondary, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 20, marginTop: 10 },
  grid: { flexDirection: 'column', gap: 12 },
  card: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2, 
    borderColor: COLORS.border,
    elevation: 3,
  },
  cardIconCircle: { 
    width: 50, height: 50, borderRadius: 12, 
    backgroundColor: COLORS.secondary, 
    justifyContent: 'center', alignItems: 'center', marginRight: 14, flexShrink: 0
  },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '900', color: COLORS.textDark },
  cardDesc: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  
  // Estilos para notificaciones
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    minHeight: height * 0.7,
    maxHeight: height * 0.9,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalButton: {
    marginRight: 15,
  },
  modalButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 5,
  },
  notificationsList: {
    padding: 15,
  },
  notificationItem: {
    flexDirection: 'column',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadNotification: {
    backgroundColor: COLORS.unread,
    borderColor: COLORS.primary,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  unreadText: {
    fontWeight: '900',
    color: COLORS.primary,
  },
  notificationMessage: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 10,
    color: COLORS.textLight,
    opacity: 0.7,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 0.45,
  },
  acceptButton: {
    backgroundColor: COLORS.accept,
  },
  rejectButton: {
    backgroundColor: COLORS.reject,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  statusBadgePaid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#B7DEC0',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
    minWidth: 150,
  },
  statusBadgePaidText: {
    color: COLORS.accept,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyNotifications: {
    padding: 50,
    alignItems: 'center',
  },
  emptyNotificationsText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 10,
    textAlign: 'center',
  },
  userErrorBanner: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  userErrorText: {
    flex: 1,
    color: COLORS.textDark,
    fontSize: 12,
    fontWeight: '600',
  },
  decisionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  decisionModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    elevation: 6,
  },
  decisionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  decisionModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  decisionModalMessage: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  decisionButtonsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  decisionCancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionCancelText: {
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  decisionConfirmButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: COLORS.reject,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  decisionConfirmText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
  decisionOkButton: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionOkText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
});