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

const TIMEZONE = 'America/Hermosillo'; // San Luis Río Colorado, Sonora

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

const NotificationModal = ({ visible, onClose, notifications, onMarkAsRead, onClearAll, onAcceptAppointment, onRejectAppointment, onGoToPayment, onDenyAppointment }: any) => {
  const isPendingPaymentNotification = (item: any) => {
    const estado = item.estado || item.datos_adicionales?.estado;
    return (
      item.tipo === 'cita_pendiente_pago' ||
      item.tipo === 'pago' ||
      item.datos_adicionales?.requiere_pago === true ||
      estado === 'pendiente_pago' ||
      (item.tipo === 'cita' && estado === 'pendiente' && !!item.datos_adicionales?.id_cita)
    );
  };

  const renderNotification = ({ item }: any) => (
    <View style={[styles.notificationItem, !item.leida && styles.unreadNotification]}>
      <TouchableOpacity 
        style={styles.notificationContent}
        onPress={() => onMarkAsRead(item.id_notificacion)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationIcon}>
          <Ionicons 
            name={getNotificationIcon(item.tipo)} 
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
      {isPendingPaymentNotification(item) && (
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

      {/* Compatibilidad con flujo anterior */}
      {!isPendingPaymentNotification(item) && item.tipo === 'cita' && item.estado === 'pendiente' && (
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
    </View>
  );

  const getNotificationIcon = (tipo: string) => {
    switch(tipo) {
      case 'cita': return 'calendar-outline';
      case 'cita_pendiente_pago': return 'card-outline';
      case 'pago': return 'card-outline';
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
  const { refreshNutriologo } = useNutriologo();
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
  const navigationLockRef = useRef(false);

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
    if (!user?.id_paciente) return baseNotifications;

    const { data, error } = await supabase
      .from('citas')
      .select(`
        id_cita,
        fecha_hora,
        estado,
        nutriologos!inner (
          id_nutriologo,
          nombre,
          apellido,
          tarifa_consulta
        ),
        pagos!left (
          id_pago,
          estado
        )
      `)
      .eq('id_paciente', user.id_paciente)
      .eq('estado', 'pendiente')
      .order('fecha_hora', { ascending: false });

    if (error) throw error;

    const pendingWithoutPayment = (data || []).filter((cita: any) => {
      const paymentCompleted = cita.pagos && cita.pagos.length > 0 && cita.pagos[0]?.estado === 'completado';
      return !paymentCompleted;
    });

    const extras = pendingWithoutPayment
      .filter((cita: any) => {
        const citaId = Number(cita.id_cita);
        return !baseNotifications.some((notification: any) =>
          Number(notification?.datos_adicionales?.id_cita) === citaId &&
          (
            notification.tipo === 'cita_pendiente_pago' ||
            notification.tipo === 'pago' ||
            notification?.datos_adicionales?.requiere_pago === true ||
            notification.estado === 'pendiente_pago'
          )
        );
      })
      .map((cita: any) => {
        const nutri = cita.nutriologos;
        const doctorName = `Dr. ${nutri.nombre} ${nutri.apellido}`;
        const amount = nutri.tarifa_consulta || 800;
        const citaDate = parseDbTimestampAsUtc(cita.fecha_hora);

        const formattedDate = citaDate.toLocaleString('es-MX', {
          timeZone: TIMEZONE,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        });

        return {
          id_notificacion: `pending-payment-${cita.id_cita}`,
          id_usuario: user.id_paciente,
          tipo_usuario: 'paciente',
          titulo: 'Cita pendiente de pago',
          mensaje: `Tu cita con ${doctorName} del ${formattedDate} está pendiente de pago.`,
          tipo: 'cita_pendiente_pago',
          estado: 'pendiente_pago',
          leida: false,
          fecha_envio: citaDate.toISOString(),
          datos_adicionales: {
            id_cita: cita.id_cita,
            id_nutriologo: nutri.id_nutriologo,
            doctor_nombre: doctorName,
            precio: amount,
            requiere_pago: true,
            estado: 'pendiente_pago',
          },
        };
      });

    return sortNotificationsByDate([...extras, ...baseNotifications]);
  }, [user]);

  // Cargar notificaciones desde Supabase
  const loadNotifications = useCallback(async () => {
    if (!user?.id_paciente) return;

    setLoadingNotifications(true);
    try {
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

  const markAsRead = async (id: number) => {
    if (typeof id !== 'number') {
      setNotifications(prev =>
        prev.map(notif =>
          notif.id_notificacion === id ? { ...notif, leida: true } : notif
        )
      );
      return;
    }

    try {
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

  const handleGoToPayment = async (notification: any) => {
    const datos = notification?.datos_adicionales || {};
    const citaId = Number(datos.id_cita);
    const doctorId = Number(datos.id_nutriologo);
    const doctorName = datos.doctor_nombre || 'Nutriólogo';
    const precio = Number(datos.precio || 800);

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

  const handleDenyAppointment = (notification: any) => {
    const datos = notification?.datos_adicionales || {};
    const citaId = Number(datos.id_cita);
    const nutriologoId = Number(datos.id_nutriologo);

    Alert.alert(
      'Denegar cita',
      'Si deniegas esta cita, el nutriólogo ya no podrá ver tu información y podrás agendar de nuevo con el mismo u otro nutriólogo. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Denegar',
          style: 'destructive',
          onPress: async () => {
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

              Alert.alert(
                'Cita denegada',
                'El nutriólogo ya no verá tu información. Puedes agendar nuevamente cuando quieras.'
              );
            } catch (error) {
              console.error('Error denegando cita:', error);
              Alert.alert('Error', 'No se pudo denegar la cita. Intenta nuevamente.');
            }
          }
        }
      ]
    );
  };

  const openNotifications = async () => {
    setNotificationsVisible(true);
    await loadNotifications();
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
  const handleRejectAppointment = async (notification: any) => {
    Alert.alert(
      'Rechazar cita',
      '¿Estás seguro de que quieres rechazar esta cita?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
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

              Alert.alert('Cita rechazada', 'Puedes agendar una nueva cita con otro nutriólogo');
              await loadNotifications(); // Recargar notificaciones
            } catch (error) {
              console.error('Error rechazando cita:', error);
              Alert.alert('Error', 'No se pudo rechazar la cita');
            }
          }
        }
      ]
    );
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FloatingIcons />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIcon}>
          <Ionicons name="menu-outline" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        
        <View style={styles.brandContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
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
        onClose={() => setNotificationsVisible(false)}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onClearAll={clearAllNotifications}
        onAcceptAppointment={handleAcceptAppointment}
        onRejectAppointment={handleRejectAppointment}
        onGoToPayment={handleGoToPayment}
        onDenyAppointment={handleDenyAppointment}
      />
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
  headerIcon: { padding: 5, zIndex: 1 },
  brandContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: { width: 130, height: 42 },
  headerRight: { flexDirection: 'row', alignItems: 'center', zIndex: 1 },
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
});