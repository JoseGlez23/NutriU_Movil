import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  I18nManager,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../hooks/useUser';
import { useProfileImage } from '../context/ProfileImageContext'; // Importamos el contexto de imagen

const { width } = Dimensions.get('window');

// Paleta coherente con Nutri U
const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#E0E0E0',
  danger: '#D32F2F'
};

interface HamburgerMenuProps {
  isVisible: boolean;
  onClose: () => void;
  navigation: any;
}

export default function HamburgerMenu({ isVisible, onClose, navigation }: HamburgerMenuProps) {
  const { signOut, user: authUser } = useAuth();
  const { user: userData, loading: userLoading } = useUser();
  const { profileImage } = useProfileImage(); // Obtenemos la imagen de perfil del contexto
  
  const slideAnim = React.useRef(new Animated.Value(-width)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  
  const itemAnims = React.useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      itemAnims.forEach((anim, index) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: 150 + (index * 50),
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -width,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      itemAnims.forEach(anim => anim.setValue(0));
    }
  }, [isVisible]);

  const handleMenuNavigation = (screenName: string) => {
    animateClose();
    setTimeout(() => navigation.navigate(screenName), 300);
  };

  const handleLogout = async () => {
    animateClose();
    await signOut();
    // La navegación se manejará automáticamente por el AppNavigator
  };

  const animateClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const menuItems = [
    { icon: 'person-outline', name: 'Perfil', screen: 'Profile' },
    { icon: 'trophy-outline', name: 'Mis Puntos', screen: 'Points' },
    { icon: 'calendar-outline', name: 'Agendar Cita', screen: 'Schedule' },
    { icon: 'barbell-outline', name: 'Mis Rutinas', screen: 'MyRoutines' },
    { icon: 'nutrition-outline', name: 'Registrar Alimentos', screen: 'FoodTracking' },
  ];

  // Obtener nombre del usuario para mostrar
  const getUserName = () => {
    if (userData) {
      return `${userData.nombre || ''} ${userData.apellido || ''}`.trim() || 'Usuario Nutri U';
    }
    return authUser?.email?.split('@')[0] || 'Usuario Nutri U';
  };

  // Obtener estado premium basado en puntos o rol
  const getUserStatus = () => {
    if (userData) {
      if (userData.rol === 'nutriologo' || userData.rol === 'admin') {
        return 'Nutriólogo';
      }
      // Podrías verificar puntos para determinar si es premium
      return 'Usuario Activo';
    }
    return 'Usaurio Activo';
  };

  // Determinar qué imagen mostrar en el avatar
  const getAvatarSource = () => {
    if (profileImage && profileImage !== 'usu.webp') {
      return { uri: profileImage };
    }
    // Si no hay foto de perfil, mostramos el icono por defecto
    return null;
  };

  if (!isVisible) return null;

  return (
    <>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={animateClose} />
      </Animated.View>
      
      <Animated.View style={[styles.menuContainer, { transform: [{ translateX: slideAnim }] }]}>
        
        {/* Header del menú estilo Nutri U */}
        <View style={styles.menuHeader}>
          <View style={styles.brandContainer}>
            <Text style={styles.brandName}>NUTRI U</Text>
            <View style={styles.underline} />
            <Text style={styles.menuSubtitle}>Gestión Profesional</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={animateClose}>
            <Ionicons name="close-outline" size={32} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Sección de usuario con datos reales y foto de perfil */}
        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            {getAvatarSource() ? (
              <Image 
                source={getAvatarSource()} 
                style={styles.avatarImage}
                onError={(e) => console.log('Error cargando avatar en menú:', e.nativeEvent.error)}
              />
            ) : (
              <Ionicons name="person" size={24} color={COLORS.primary} />
            )}
          </View>
          <View>
            <Text style={styles.userName} numberOfLines={1}>
              {getUserName()}
            </Text>
            <Text style={styles.userStatus}>{getUserStatus()}</Text>
            {authUser?.email && (
              <Text style={styles.userEmail} numberOfLines={1}>
                {authUser.email}
              </Text>
            )}
          </View>
        </View>

        {/* Opciones del menú */}
        <View style={styles.menuItemsList}>
          {menuItems.map((item, index) => (
            <Animated.View
              key={index}
              style={{
                opacity: itemAnims[index],
                transform: [{
                  translateX: itemAnims[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0]
                  })
                }]
              }}
            >
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => handleMenuNavigation(item.screen)}
              >
                <View style={styles.iconBackground}>
                  <Ionicons name={item.icon} size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.menuItemText}>{item.name}</Text>
                <Ionicons 
                  name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} 
                  size={16} 
                  color={COLORS.textLight} 
                  style={{ opacity: 0.5 }}
                />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Footer del menú */}
        <View style={styles.menuFooter}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
          
          <Text style={styles.footerVersion}>Nutri U v1.0.0 | 2026</Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 48, 38, 0.4)', // Usando el tono textDark con transparencia
    zIndex: 999,
  },
  overlayTouchable: { width: '100%', height: '100%' },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.8,
    height: '100%',
    backgroundColor: COLORS.secondary,
    zIndex: 1000,
    paddingTop: 50,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  brandContainer: { flex: 1 },
  brandName: { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  underline: { width: 30, height: 4, backgroundColor: COLORS.accent, borderRadius: 2, marginTop: 4 },
  menuSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 6, fontWeight: '300' },
  closeButton: { padding: 5 },
  
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(46, 139, 87, 0.1)',
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(46, 139, 87, 0.2)',
    overflow: 'hidden', // Importante para que la imagen se ajuste al borde redondeado
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  userName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.textDark,
    maxWidth: 180,
  },
  userStatus: { 
    fontSize: 11, 
    color: COLORS.primary, 
    fontWeight: '600',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
    maxWidth: 180,
  },

  menuItemsList: { flex: 1, paddingHorizontal: 15 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  iconBackground: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDark,
  },

  menuFooter: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
    marginLeft: 10,
  },
  footerVersion: {
    fontSize: 10,
    color: '#BBB',
    textAlign: 'center',
    marginTop: 15,
    letterSpacing: 0.5
  },
});