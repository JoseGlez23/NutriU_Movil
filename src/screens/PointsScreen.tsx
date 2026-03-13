import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, Animated, 
  Modal, ScrollView, Dimensions, Vibration, SafeAreaView, StatusBar,
  Easing, RefreshControl, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUser } from '../hooks/useUser';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#D1E8D5',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32'
};

const TROPHIES = [
  { id: 1, name: "Manzana de Cobre", pointsRequired: 100, color: COLORS.bronze, level: "Principiante", image: require('../../assets/premiocobre.png') },
  { id: 2, name: "Manzana de Plata", pointsRequired: 1000, color: COLORS.silver, level: "Intermedio", image: require('../../assets/premioplata.png') },
  { id: 3, name: "Manzana de Oro", pointsRequired: 5000, color: COLORS.gold, level: "Avanzado", image: require('../../assets/premiooro.png') },
  { id: 4, name: "Manzana de Diamante", pointsRequired: 10000, color: '#3498DB', level: "Leyenda", image: require('../../assets/premioplata.png') }
];

// TTL ajustado a 10 segundos para reducir tiempo de carga inicial (caché más persistente pero fresco)
const POINTS_CACHE_TTL = 10000;

export default function PointsScreen({ navigation }: any) {
  const { user, refreshUserData, fetchUserPointsFast } = useUser();
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canjesDisponibles, setCanjesDisponibles] = useState<any[]>([]);
  const [loadingCanjes, setLoadingCanjes] = useState(false);
  const [claimingRewardId, setClaimingRewardId] = useState<number | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Loading animation values
  const breatheValue = useRef(new Animated.Value(1)).current;
  const textOpacityValue = useRef(new Animated.Value(0.3)).current;

  // Loading animation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheValue, {
            toValue: 1.1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breatheValue, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(textOpacityValue, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(textOpacityValue, {
            toValue: 0.3,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading]);

  // Carga de puntos con caché de 10 segundos para carga más rápida
  const loadPoints = useCallback(async (forceFresh = false) => {
    console.log("[PointsScreen] loadPoints iniciado (forceFresh:", forceFresh, ")");
    try {
      setErrorMsg(null);

      let newPoints = 0;
      let cacheHit = false;

      // 1. Intentar caché (si no forzamos fresco)
      if (!forceFresh) {
        const cached = await AsyncStorage.getItem('points_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp <= POINTS_CACHE_TTL) {
            console.log("[PointsScreen] Usando caché fresco (<10s)");
            newPoints = parsed.puntos_totales || 0;
            cacheHit = true;
          } else {
            console.log("[PointsScreen] Caché expirado (>10s) → fetch fresco");
          }
        }
      }

      // 2. Fetch fresco SOLO si no hubo cache hit
      if (!cacheHit) {
        const points = await fetchUserPointsFast();
        newPoints = points.puntos_totales || 0;

        // Guardar en caché
        await AsyncStorage.setItem('points_cache', JSON.stringify({
          puntos_totales: newPoints,
          timestamp: Date.now(),
        }));
      }

      // 3. Actualizar solo si cambió (evita re-renders innecesarios)
      setUserPoints(prev => {
        if (prev !== newPoints) {
          console.log("[PointsScreen] Actualizando puntos:", prev, "→", newPoints);
          return newPoints;
        }
        return prev;
      });
    } catch (error) {
      console.error("[PointsScreen] Error loading points:", error);
      setErrorMsg("Error al cargar puntos. Intenta de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log("[PointsScreen] loadPoints finalizado");
    }
  }, [fetchUserPointsFast]);

  // Cargar canjes disponibles del paciente
  const loadCanjes = useCallback(async () => {
    if (!user?.id_paciente) return;
    
    setLoadingCanjes(true);
    try {
      // Se usa esquema actual: recompensas + puntos del paciente (sin endpoint exchange).
      const points = await fetchUserPointsFast();
      const puntosTotales = Number(points?.puntos_totales || 0);

      const { data: recompensas, error } = await supabase
        .from('recompensas')
        .select('id_recompensa, nombre, descripcion, tipo_recompensa, puntos_requeridos, activa')
        .eq('activa', true)
        .order('puntos_requeridos', { ascending: true });

      const { data: canjesPaciente } = await supabase
        .from('canje_recompensas')
        .select('id_recompensa, estado')
        .eq('id_paciente', user.id_paciente);

      if (error) {
        console.warn('[PointsScreen] No se pudieron cargar recompensas:', error.message);
        setCanjesDisponibles([]);
        return;
      }

      const claimedSet = new Set(
        (canjesPaciente || [])
          .filter((item: any) => item?.estado !== 'cancelado')
          .map((item: any) => Number(item.id_recompensa))
      );

      const mappedCanjes = (recompensas || []).map((reward: any) => ({
        id_canje_paciente: `reward-${reward.id_recompensa}`,
        id_recompensa: reward.id_recompensa,
        desbloqueado: reward.puntos_requeridos <= puntosTotales,
        yaReclamado: claimedSet.has(Number(reward.id_recompensa)),
        canjes: {
          id_canje: reward.id_recompensa,
          nombre_canje: reward.nombre,
          tipo_canje: reward.tipo_recompensa === 'descuento' ? 'descuento' : 'consulta_gratis',
          valor_descuento: reward.tipo_recompensa === 'descuento' ? null : null,
          cantidad_consultas: 1,
          descripcion: reward.descripcion,
          puntos_requeridos: reward.puntos_requeridos,
        }
      }));

      // Disponibles primero, después bloqueadas ordenadas por puntos requeridos
      mappedCanjes.sort((a: any, b: any) => {
        if (a.desbloqueado !== b.desbloqueado) return a.desbloqueado ? -1 : 1;
        return a.canjes.puntos_requeridos - b.canjes.puntos_requeridos;
      });

      setCanjesDisponibles(mappedCanjes);
    } catch (error) {
      console.error('[PointsScreen] Error fetching canjes:', error);
      setCanjesDisponibles([]);
    } finally {
      setLoadingCanjes(false);
    }
  }, [fetchUserPointsFast, user?.id_paciente]);

  const claimReward = useCallback(async (reward: any) => {
    if (!user?.id_paciente || !reward?.id_recompensa) {
      Alert.alert('Error', 'No se pudo reclamar esta recompensa.');
      return;
    }

    const idRecompensa = Number(reward.id_recompensa);
    if (!Number.isFinite(idRecompensa)) {
      Alert.alert('Error', 'Recompensa inválida.');
      return;
    }

    setClaimingRewardId(idRecompensa);
    try {
      const { data: existingCanje } = await supabase
        .from('canje_recompensas')
        .select('id_canje')
        .eq('id_paciente', user.id_paciente)
        .eq('id_recompensa', idRecompensa)
        .in('estado', ['pendiente', 'entregado'])
        .maybeSingle();

      if (existingCanje?.id_canje) {
        Alert.alert('Aviso', 'Esta recompensa ya fue reclamada.');
        await loadCanjes();
        return;
      }

      const puntosGastados = Number(reward?.puntos_requeridos || 0);
      const codigoCanje = `CNJ-${idRecompensa}-${user.id_paciente}-${Date.now()}`;

      const { error: insertCanjeError } = await supabase
        .from('canje_recompensas')
        .insert({
          id_paciente: user.id_paciente,
          id_recompensa: idRecompensa,
          puntos_gastados: puntosGastados,
          estado: 'pendiente',
          codigo_canje: codigoCanje,
        });

      if (insertCanjeError) throw insertCanjeError;

      Alert.alert('Listo', 'Recompensa reclamada correctamente. Ya puedes usarla en el pago.');
      await loadCanjes();
    } catch (error: any) {
      console.error('[PointsScreen] Error reclamando recompensa:', error);
      Alert.alert('Error', error?.message || 'No se pudo reclamar la recompensa.');
    } finally {
      setClaimingRewardId(null);
    }
  }, [loadCanjes, user?.id_paciente]);

  // Ref para evitar doble carga al montar (useEffect + useFocusEffect ambos disparan en el primer render)
  const hasMountedRef = useRef(false);

  // Carga inicial - corre una sola vez al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log("[PointsScreen] Montaje inicial → carga puntos y canjes");
    loadPoints();
    loadCanjes();
  }, []); // deps vacías: loadPoints/loadCanjes son estables gracias a useCallback

  // Refresco suave al re-enfocar – omite el primer focus (cubierto por useEffect)
  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return; // primer focus: useEffect ya hizo la carga
      }
      console.log("[PointsScreen] Focus: refrescando puntos y canjes");
      loadPoints();
      loadCanjes();
    }, [loadCanjes, loadPoints]) // sin `loading` en deps
  );

  // Pull-to-refresh (fuerza refresh fresco)
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadPoints(true), // forceFresh = true
      loadCanjes()      // reload canjes
    ]);
    setRefreshing(false);
  };

  const state = useMemo(() => {
    const list = TROPHIES.map(t => ({ ...t, achieved: userPoints >= t.pointsRequired }));
    const current = list[currentIdx];
    
    const best = [...list].reverse().find(t => t.achieved) || list[0];
    
    const prevPoints = currentIdx === 0 ? 0 : list[currentIdx - 1].pointsRequired;
    const diff = current.pointsRequired - prevPoints;
    const progress = Math.max(0, Math.min(1, (userPoints - prevPoints) / diff));
    const percentage = Math.round(progress * 100);
    
    return { list, current, best, progress, percentage };
  }, [userPoints, currentIdx]);

  const triggerShake = () => {
    Vibration.vibrate(80);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleNavigate = (dir: 'next' | 'prev') => {
    const next = dir === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (next >= 0 && next < TROPHIES.length) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true })
      ]).start();
      setCurrentIdx(next);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <Animated.View
            style={[
              styles.trophyContainer,
              {
                transform: [
                  { scale: breatheValue }
                ],
              },
            ]}
          >
            <MaterialCommunityIcons name="trophy" size={80} color={COLORS.primary} />
          </Animated.View>
          
          <Animated.Text style={[styles.loadingText, { opacity: textOpacityValue }]}>
            Cargando tus logros...
          </Animated.Text>
          
          <View style={styles.dotsContainer}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    opacity: textOpacityValue.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.3, 1],
                    }),
                    transform: [{
                      scale: textOpacityValue.interpolate({
                        inputRange: [0.3, 1],
                        outputRange: [0.8, 1.2],
                      })
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

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity onPress={() => loadPoints(true)}>
          <Text>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.headerIcon}>
          <Ionicons name="arrow-back-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>MIS LOGROS</Text>
          <View style={styles.underlineSmall} />
        </View>
        <View style={styles.pointsBadgeHeader}>
          <Text style={styles.pointsBadgeText}>{userPoints} PTS TOTALES</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        
        {/* BARRA DE PROGRESO DE TROFEOS */}
        <View style={styles.trophyProgressSection}>
          <Text style={styles.trophyProgressTitle}>TU PROGRESIÓN</Text>
          <View style={styles.trophyProgressContainer}>
            {state.list.map((trophy, idx) => (
              <View key={trophy.id} style={styles.trophyProgressItem}>
                <TouchableOpacity
                  onPress={() => setCurrentIdx(idx)}
                  style={[
                    styles.trophyProgressIcon,
                    {
                      backgroundColor: trophy.achieved ? trophy.color : COLORS.border,
                      borderColor: currentIdx === idx ? trophy.color : COLORS.border,
                      borderWidth: currentIdx === idx ? 3 : 1
                    }
                  ]}
                >
                  {trophy.achieved && (
                    <Image source={trophy.image} style={styles.miniTrophyImg} />
                  )}
                  {!trophy.achieved && (
                    <Ionicons name="lock-closed" size={20} color={COLORS.textLight} />
                  )}
                </TouchableOpacity>
                <Text style={[styles.trophyProgressLabel, { opacity: trophy.achieved ? 1 : 0.5 }]}>
                  {trophy.pointsRequired}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.carouselContainer}>
          <TouchableOpacity onPress={() => handleNavigate('prev')} disabled={currentIdx === 0}>
            <Ionicons name="chevron-back" size={35} color={currentIdx === 0 ? '#E2E8F0' : COLORS.primary} />
          </TouchableOpacity>

          <Animated.View style={[styles.trophyCard, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={!state.current.achieved ? triggerShake : undefined}
              style={styles.imageBox}
            >
              <Image 
                source={state.current.image} 
                style={[styles.trophyImg, !state.current.achieved && { tintColor: '#000', opacity: 0.1 }]} 
              />
              {!state.current.achieved && (
                <Animated.View style={[styles.lockContainer, { transform: [{ translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) }] }]}>
                  <View style={styles.lockCircle}>
                    <Ionicons name="lock-closed" size={30} color={COLORS.white} />
                  </View>
                  <Text style={styles.lockText}>Faltan {state.current.pointsRequired - userPoints} pts</Text>
                </Animated.View>
              )}
            </TouchableOpacity>

            <Text style={styles.trophyName}>{state.current.name.toUpperCase()}</Text>
            <View style={[styles.levelBadge, { backgroundColor: state.current.color }]}>
              <Text style={styles.levelBadgeText}>{state.current.level}</Text>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${state.percentage}%`, backgroundColor: COLORS.primary }]} />
              </View>
              <Text style={styles.progressLabel}>{userPoints} / {state.current.pointsRequired} Puntos</Text>
            </View>
          </Animated.View>

          <TouchableOpacity onPress={() => handleNavigate('next')} disabled={currentIdx === TROPHIES.length - 1}>
            <Ionicons name="chevron-forward" size={35} color={currentIdx === TROPHIES.length - 1 ? '#E2E8F0' : COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* SECCIÓN DE RECOMPENSAS (disponibles + por desbloquear) */}
        {canjesDisponibles.length > 0 && (
          <View style={styles.canjesSection}>
            <Text style={styles.canjesSectionTitle}>🎁 RECOMPENSAS</Text>
            <Text style={styles.canjesSectionSubtitle}>Acumula puntos para desbloquear recompensas</Text>
            
            {canjesDisponibles.map((canjeData: any, idx: number) => {
              const canje = canjeData.canjes;
              const desbloqueado: boolean = canjeData.desbloqueado;
              const yaReclamado: boolean = canjeData.yaReclamado;
              const icon = desbloqueado
                ? (canje.tipo_canje === 'descuento' ? '📉' : '⭐')
                : '🔒';
              const faltanPuntos = canje.puntos_requeridos - userPoints;
              
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.canjeCard, !desbloqueado && styles.canjeCardLocked]}
                  activeOpacity={desbloqueado ? 0.7 : 1}
                >
                  <View style={styles.canjeCardContent}>
                    <Text style={styles.canjeIcon}>{icon}</Text>
                    <View style={styles.canjeInfo}>
                      <Text style={[styles.canjeName, !desbloqueado && styles.canjeNameLocked]}>
                        {canje.nombre_canje}
                      </Text>
                      <Text style={[styles.canjeType, !desbloqueado && styles.canjeTypeLocked]}>
                        {`Requiere ${canje.puntos_requeridos} pts`}
                      </Text>
                    </View>
                  </View>
                  {desbloqueado ? (
                    yaReclamado ? (
                      <View style={styles.canjeStateClaimed}>
                        <Text style={styles.canjeStateClaimedText}>RECLAMADO</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.claimButton}
                        onPress={() => claimReward({
                          id_recompensa: canjeData.id_recompensa,
                          puntos_requeridos: canje.puntos_requeridos,
                        })}
                        disabled={claimingRewardId === canjeData.id_recompensa}
                      >
                        {claimingRewardId === canjeData.id_recompensa ? (
                          <ActivityIndicator color={COLORS.white} size="small" />
                        ) : (
                          <Text style={styles.claimButtonText}>RECLAMAR</Text>
                        )}
                      </TouchableOpacity>
                    )
                  ) : (
                    <View style={styles.canjeStateLocked}>
                      <Text style={styles.canjeStateLockedText}>Faltan {faltanPuntos} pts</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* INFORMACIÓN DE PROGRESO */}
        <View style={styles.infoSection}>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>PUNTOS</Text>
              <Text style={styles.metricValue}>{userPoints}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>OBJETIVO</Text>
              <Text style={styles.metricValue}>{state.current.pointsRequired}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>AVANCE</Text>
              <Text style={[styles.metricValue, { color: state.current.color }]}>{state.percentage}%</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={28} color={COLORS.textDark} />
            </TouchableOpacity>
            
            <Text style={styles.modalMainTitle}>MIS LOGROS</Text>
            
            <View style={[styles.bestAchievementCard, { borderColor: state.best.color }]}>
              <View style={[styles.bestAchievementIcon, { backgroundColor: state.best.color }]}>
                <Image source={state.best.image} style={styles.bestTrophyImg} />
              </View>
              <Text style={[styles.bestAchievementName, { color: state.best.color }]}>{state.best.name}</Text>
              <Text style={styles.bestAchievementLevel}>{state.best.level}</Text>
              <View style={styles.bestAchievementBadge}>
                <Ionicons name="checkmark-circle" size={24} color={state.best.color} />
                <Text style={[styles.bestAchievementStatus, { color: state.best.color }]}>DESBLOQUEADO</Text>
              </View>
            </View>

            <View style={styles.allAchievementsSection}>
              <Text style={styles.allAchievementsTitle}>TODOS TUS LOGROS</Text>
              {state.list.map((trophy, idx) => (
                <View key={trophy.id} style={[styles.achievementRow, { opacity: trophy.achieved ? 1 : 0.5 }]}>
                  <View style={[styles.achievementRowIcon, { backgroundColor: trophy.color }]}>
                    <Image source={trophy.image} style={styles.achievementRowImg} />
                  </View>
                  <View style={styles.achievementRowInfo}>
                    <Text style={styles.achievementRowName}>{trophy.name}</Text>
                    <Text style={styles.achievementRowLevel}>{trophy.level} • {trophy.pointsRequired} pts</Text>
                  </View>
                  {trophy.achieved && (
                    <View style={styles.achievementRowCheck}>
                      <Ionicons name="checkmark" size={22} color={COLORS.primary} />
                    </View>
                  )}
                </View>
              ))}
            </View>

            <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: state.best.color }]} onPress={() => setShowModal(false)}>
              <Text style={styles.modalCloseButtonText}>CONTINUAR</Text>
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
    position: 'relative',
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: { padding: 5, zIndex: 2 },
  brandContainer: {
    position: 'absolute',
    left: 56,
    right: 92,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  brandName: { fontSize: 16, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.2, textAlign: 'center' },
  underlineSmall: { width: 20, height: 3, backgroundColor: COLORS.accent, borderRadius: 2, marginTop: 2 },
  pointsBadgeHeader: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 2,
    maxWidth: 118,
    alignItems: 'center',
  },
  pointsBadgeText: { fontSize: 10, fontWeight: '900', color: COLORS.primary },
  scrollContent: { padding: 20, paddingTop: 24, alignItems: 'center' },
  trophyProgressSection: {
    width: '100%',
    marginBottom: 24,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  trophyProgressTitle: { fontSize: 13, fontWeight: '900', color: COLORS.textLight, letterSpacing: 1.5, marginBottom: 15, textAlign: 'center' },
  trophyProgressContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  trophyProgressItem: { alignItems: 'center', flex: 1 },
  trophyProgressIcon: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 },
  miniTrophyImg: { width: 40, height: 40, resizeMode: 'contain' },
  trophyProgressLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  infoSection: { width: '100%', marginTop: 6, marginBottom: 18 },
    canjesSection: { width: '100%', marginVertical: 16 },
    canjesSectionTitle: { fontSize: 14, fontWeight: '900', color: COLORS.primary, marginBottom: 4, letterSpacing: 0.5, textAlign: 'center' },
    canjesSectionSubtitle: { fontSize: 11, color: COLORS.textLight, marginBottom: 12, textAlign: 'center', fontWeight: '600' },
    canjeCard: {
      backgroundColor: COLORS.white,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: COLORS.accent,
      marginBottom: 10,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      elevation: 2,
      shadowColor: COLORS.primary,
      shadowOpacity: 0.1,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 2 }
    },
    canjeCardContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    canjeIcon: { fontSize: 24, marginRight: 12 },
    canjeInfo: { flex: 1 },
    canjeName: { fontSize: 12, fontWeight: '900', color: COLORS.textDark, marginBottom: 2 },
    canjeType: { fontSize: 10, color: COLORS.accent, fontWeight: '600' },
    canjeState: { backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: COLORS.accent },
    canjeStateText: { fontSize: 9, fontWeight: '900', color: COLORS.accent, letterSpacing: 0.3 },
    canjeCardLocked: { borderColor: '#CBD5E0', opacity: 0.75 },
    canjeNameLocked: { color: '#718096' },
    canjeTypeLocked: { color: '#A0AEC0' },
    canjeStateLocked: { backgroundColor: '#EDF2F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E0' },
    canjeStateLockedText: { fontSize: 9, fontWeight: '700', color: '#718096', letterSpacing: 0.2 },
    claimButton: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      minWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
    },
    claimButtonText: { fontSize: 10, fontWeight: '900', color: COLORS.white, letterSpacing: 0.4 },
    canjeStateClaimed: {
      backgroundColor: '#E6FFFA',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#81E6D9',
    },
    canjeStateClaimedText: { fontSize: 9, fontWeight: '900', color: '#2C7A7B', letterSpacing: 0.3 },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  metricLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textLight, letterSpacing: 0.6, marginBottom: 5 },
  metricValue: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  carouselContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginVertical: 16 },
  trophyCard: {
    width: width * 0.72,
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  imageBox: {
    width: 146,
    height: 146,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 73,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trophyImg: { width: '100%', height: '100%', resizeMode: 'contain' },
  lockContainer: { position: 'absolute', alignItems: 'center' },
  lockCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  lockText: { marginTop: 10, fontWeight: '900', color: COLORS.textLight, fontSize: 12, backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  trophyName: { fontSize: 15, fontWeight: '900', color: COLORS.textDark, textAlign: 'center' },
  levelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginTop: 8 },
  levelBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '900' },
  progressBarContainer: { width: '100%', marginTop: 20 },
  progressBarBg: { height: 8, backgroundColor: COLORS.secondary, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 8, fontWeight: '800' },
  rewardsButton: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 30, paddingVertical: 18, borderRadius: 18, marginTop: 20, alignItems: 'center', width: '100%', justifyContent: 'center', marginBottom: 30, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  rewardsButtonText: { color: COLORS.white, fontWeight: '900', marginLeft: 12, fontSize: 14, letterSpacing: 0.5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26, 48, 38, 0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 40, maxHeight: '90%' },
  closeBtn: { position: 'absolute', right: 20, top: 20, zIndex: 10 },
  modalMainTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textDark, textAlign: 'center', marginTop: 6, marginBottom: 25, letterSpacing: 1, paddingHorizontal: 36 },
  
  bestAchievementCard: { backgroundColor: COLORS.secondary, borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 25, borderLeftWidth: 5 },
  bestAchievementIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 2 },
  bestTrophyImg: { width: 70, height: 70, resizeMode: 'contain' },
  bestAchievementName: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  bestAchievementLevel: { fontSize: 12, color: COLORS.textLight, fontWeight: '700', marginTop: 4 },
  bestAchievementBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.white, borderRadius: 12 },
  bestAchievementStatus: { fontWeight: '900', fontSize: 11, marginLeft: 6, letterSpacing: 0.5 },
  
  allAchievementsSection: { marginBottom: 20 },
  allAchievementsTitle: { fontSize: 12, fontWeight: '900', color: COLORS.textLight, letterSpacing: 1, marginBottom: 12 },
  achievementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  achievementRowIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12, elevation: 1 },
  achievementRowImg: { width: 35, height: 35, resizeMode: 'contain' },
  achievementRowInfo: { flex: 1 },
  achievementRowName: { fontSize: 12, fontWeight: '900', color: COLORS.textDark },
  achievementRowLevel: { fontSize: 10, color: COLORS.textLight, fontWeight: '700', marginTop: 3 },
  achievementRowCheck: { paddingRight: 5 },
  
  modalCloseButton: { width: '100%', padding: 16, borderRadius: 18, alignItems: 'center', elevation: 2, marginTop: 10 },
  modalCloseButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

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
  trophyContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
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

  errorText: { color: 'red', textAlign: 'center', margin: 20 },
});