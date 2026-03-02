import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  Easing
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import { useUser } from '../hooks/useUser';
import { useAuth } from '../context/AuthContext';
import { useProfileImage } from '../context/ProfileImageContext';
import { supabase } from '../lib/supabase';
import { KeyboardAvoidingView, Platform } from 'react-native';

const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#D1E8D5',
  accent: '#3CB371',
  error: '#FF6B6B'
};

// ============ COMPONENTE INFOROW SEPARADO ============
const InfoRow = React.memo(({ 
  label, 
  icon, 
  value, 
  editable = false, 
  isEditing, 
  editedUser, 
  setEditedUser,
  fieldKey,
  isNumeric,
  multiline,
  keyboardType = 'default'
}: any) => {
  const handleChangeText = (text: string) => {
    if (!setEditedUser) return;
    
    if (isNumeric) {
      if (label === 'Teléfono') {
        // Solo permitir números y máximo 10 dígitos
        if (/^\d*$/.test(text) && text.length <= 10) {
          setEditedUser((prev: any) => ({ ...prev, [fieldKey]: text }));
        }
      } else {
        // Permitir números y un punto decimal
        if (/^\d*(\.\d*)?$/.test(text)) {
          setEditedUser((prev: any) => ({ ...prev, [fieldKey]: text }));
        }
      }
    } else {
      setEditedUser((prev: any) => ({ ...prev, [fieldKey]: text }));
    }
  };

  // Formatear el valor mostrado
  const displayValue = (() => {
    if (!value) return 'No registrado';
    if (label === 'Peso' && !value.includes('kg') && !isNaN(Number(value))) {
      return `${value} kg`;
    }
    if (label === 'Altura' && !value.includes('cm') && !isNaN(Number(value))) {
      return `${value} cm`;
    }
    return value;
  })();

  const currentValue = isEditing && editable 
    ? (editedUser?.[fieldKey] !== undefined ? editedUser[fieldKey] : value)
    : displayValue;

  return (
    <View style={[
      styles.row,
      isEditing && editable && styles.rowEditing
    ]}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {editable && isEditing ? (
        <TextInput
          style={[
            styles.input,
            label === 'Correo electrónico' && styles.inputEmail // Estilo especial para correo
          ]}
          value={currentValue}
          onChangeText={handleChangeText}
          keyboardType={keyboardType || (isNumeric ? 'numeric' : 'default')}
          autoCapitalize="none"
          returnKeyType="done"
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          textAlignVertical={multiline ? "top" : "center"}
          blurOnSubmit={true}
        />
      ) : (
        <Text 
          style={[
            styles.rowValue,
            label === 'Correo electrónico' && styles.rowValueEmail // Estilo especial para correo
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {currentValue}
        </Text>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // Control de re-renderizados solo cuando sea necesario
  return (
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editedUser?.[prevProps.fieldKey] === nextProps.editedUser?.[nextProps.fieldKey] &&
    prevProps.value === nextProps.value &&
    prevProps.editable === nextProps.editable
  );
});
// ============ FIN COMPONENTE INFOROW ============

export default function ProfileScreen({ navigation }: any) {
  const { user, loading, refreshUserData, error } = useUser();
  const { signOut } = useAuth();
  const { profileImage, setProfileImage } = useProfileImage();
  const [bmi, setBmi] = useState<string>('0');
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<any>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  // Loading animation values
  const pulseValue = useRef(new Animated.Value(1)).current;
  const breatheValue = useRef(new Animated.Value(1)).current;
  const textOpacityValue = useRef(new Animated.Value(0.3)).current;

  // Loading animation
  useEffect(() => {
    if (loading) {
      // Pulse animation for the user icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Breathing animation for the circle background
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheValue, {
            toValue: 1.2,
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

      // Pulsing text animation
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

  useEffect(() => {
    if (user) {
      setEditedUser({ ...user });
      if (user.peso && user.altura) {
        const h = parseFloat(user.altura) / 100;
        const w = parseFloat(user.peso);
        const calculatedBMI = h > 0 ? (w / (h * h)).toFixed(1) : "0";
        setBmi(calculatedBMI);
      }
      if (user.foto_perfil && user.foto_perfil !== 'default_avatar.png' && user.foto_perfil !== 'usu.webp') {
        const publicUrl = supabase.storage.from('perfiles').getPublicUrl(user.foto_perfil).data.publicUrl;
        setProfileImage(publicUrl);
      }
    }
  }, [user]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos permisos para acceder a tus fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setLocalImageUri(uri);
      setProfileImage(uri);
      await uploadProfilePhoto(uri);
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    try {
      console.log('Subiendo foto desde:', uri);

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `perfiles_mobile/${fileName}`;

      console.log('Path destino:', filePath);

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: `image/${fileExt}`,
      } as any);

      const { data, error } = await supabase.storage
        .from('perfiles')
        .upload(filePath, formData, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        console.error('Error Supabase:', error.message);
        throw error;
      }

      console.log('Subida OK:', data);

      const { data: urlData } = supabase.storage.from('perfiles').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      if (!publicUrl) throw new Error('No URL pública');

      console.log('URL pública:', publicUrl);

      const { error: updateError } = await supabase
        .from('pacientes')
        .update({ foto_perfil: filePath })
        .eq('id_paciente', user.id_paciente);

      if (updateError) throw updateError;

      setProfileImage(publicUrl + `?t=${Date.now()}`);
      setLocalImageUri(null);
      refreshUserData();
      Alert.alert('Éxito', 'Foto de perfil actualizada y guardada.');
    } catch (err) {
      console.error('Error al subir foto:', err);
      Alert.alert('Error', 'No se pudo subir la foto. Intenta de nuevo.');
    }
  };

  const handleSave = async () => {
    if (!editedUser) return;

    try {
      // SOLO actualizar el nombre de usuario
      const { error } = await supabase
        .from('pacientes')
        .update({
          nombre_usuario: editedUser.nombre_usuario
        })
        .eq('id_paciente', user.id_paciente);

      if (error) throw error;

      setIsEditing(false);
      refreshUserData();
      Alert.alert('Éxito', 'Nombre de usuario actualizado correctamente.');
    } catch (err) {
      console.error('Error al guardar:', err);
      Alert.alert('Error', 'No se pudo guardar el cambio.');
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const calculateAge = (fechaNacimiento: string) => {
    if (!fechaNacimiento) return '';
    const birthDate = new Date(fechaNacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} años`;
  };

  // Obtener categoría del IMC
  const getBMICategory = (bmi: string) => {
    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) return 'Bajo peso';
    if (bmiValue >= 18.5 && bmiValue < 25) return 'Normal';
    if (bmiValue >= 25 && bmiValue < 30) return 'Sobrepeso';
    if (bmiValue >= 30) return 'Obesidad';
    return '';
  };

  // Loading component with animated user icon
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.circleBackground,
                {
                  transform: [{ scale: breatheValue }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [{ scale: pulseValue }],
                },
              ]}
            >
              <Ionicons name="person-circle" size={90} color={COLORS.primary} />
            </Animated.View>
          </View>
          
          <Animated.Text style={[styles.loadingText, { opacity: textOpacityValue }]}>
            Cargando tu perfil...
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

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={50} color={COLORS.error} />
        <Text style={styles.errorText}>{error || 'No se pudo cargar el perfil'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.navigate('Dashboard')}>
          <Text style={styles.retryText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.brandContainer}>
            <Text style={styles.brandName}>MI PERFIL</Text>
            <View style={styles.underlineSmall} />
          </View>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editButton}>
            <Ionicons 
              name={isEditing ? "close-outline" : "create-outline"} 
              size={24} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          
          <View style={styles.heroSection}>
            <View style={styles.avatarWrapper}>
              <Image 
                source={localImageUri || profileImage === 'usu.webp' 
                  ? require('../../assets/usu.webp') 
                  : { uri: profileImage }}
                style={styles.avatar} 
                key={profileImage}
                onError={(e) => console.log('Error en Image:', e.nativeEvent.error)}
              />
              <TouchableOpacity style={styles.editPhotoBadge} onPress={pickImage}>
                <Ionicons name="camera" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.nameText}>
              {user.nombre} {user.apellido}
            </Text>
            <Text style={styles.emailText}>{user.correo}</Text>
          </View>

          {/* ESTADÍSTICAS */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="star-circle" size={32} color={COLORS.primary} />
              <Text style={styles.statVal}>{user.puntos_totales || 0}</Text>
              <Text style={styles.statLab}>PUNTOS TOTALES</Text>
            </View>
            
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="scale-bathroom" size={32} color={COLORS.primary} />
              <Text style={styles.statVal}>{bmi}</Text>
              <Text style={styles.statLab}>IMC</Text>
              <Text style={styles.statCategory}>{getBMICategory(bmi)}</Text>
            </View>
          </View>

          {/* INFORMACIÓN PERSONAL */}
          <View style={styles.infoBox}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>
            </View>

            {/* ÚNICO CAMPO EDITABLE: NOMBRE DE USUARIO */}
            <InfoRow 
              label="Nombre de usuario" 
              icon="at-outline" 
              value={user.nombre_usuario} 
              editable={true}
              isEditing={isEditing}
              editedUser={editedUser}
              setEditedUser={setEditedUser}
              fieldKey="nombre_usuario"
              isNumeric={false}
              multiline={false}
            />

            {/* CORREO ELECTRÓNICO - AHORA CON ESTILO ESPECIAL */}
            <InfoRow 
              label="Correo electrónico" 
              icon="mail-outline" 
              value={user.correo} 
              editable={false}
              isEditing={isEditing}
            />

            <InfoRow 
              label="Teléfono" 
              icon="call-outline" 
              value={user.numero_celular} 
              editable={false}
              isEditing={isEditing}
            />

            <InfoRow 
              label="Peso" 
              icon="speedometer-outline" 
              value={user.peso ? `${user.peso} kg` : 'Sin asignar'} 
              editable={false}
              isEditing={isEditing}
            />

            <InfoRow 
              label="Altura" 
              icon="resize-outline" 
              value={user.altura ? `${user.altura} cm` : 'Sin asignar'} 
              editable={false}
              isEditing={isEditing}
            />

            <InfoRow 
              label="Edad" 
              icon="calendar-outline" 
              value={calculateAge(user.fecha_nacimiento)} 
              editable={false}
              isEditing={isEditing}
            />

            <InfoRow 
              label="Género" 
              icon="person-outline" 
              value={user.genero === 'masculino' ? 'Masculino' : user.genero === 'femenino' ? 'Femenino' : 'Otro'} 
              editable={false}
              isEditing={isEditing}
            />

            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionTitle}>METAS Y SALUD</Text>
              
              <InfoRow 
                label="Objetivo" 
                icon="trophy-outline" 
                value={user.objetivo || 'Ninguna'} 
                editable={false}
                isEditing={isEditing}
              />

              <InfoRow 
                label="Alergias" 
                icon="medical-outline" 
                value={user.alergias || 'Ninguna'} 
                editable={false}
                isEditing={isEditing}
              />
            </View>

            {/* BOTÓN GUARDAR - SOLO VISIBLE EN MODO EDICIÓN */}
            {isEditing && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Guardar Nombre de Usuario</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* CERRAR SESIÓN */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ============ ESTILOS CORREGIDOS ============
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: COLORS.white 
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  circleBackground: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.secondary,
  },
  iconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { 
    marginTop: 10, 
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
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
  errorText: { marginTop: 10, color: COLORS.error, fontWeight: '600' },
  retryButton: { marginTop: 20, padding: 15, backgroundColor: COLORS.primary, borderRadius: 10 },
  retryText: { color: COLORS.white, fontWeight: 'bold' },
  
  header: {
    backgroundColor: COLORS.white,
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between', 
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 5,
  },
  editButton: {
    padding: 5,
  },
  brandContainer: { alignItems: 'center' },
  brandName: { fontSize: 18, fontWeight: '900', color: COLORS.primary, letterSpacing: 2 },
  underlineSmall: { width: 25, height: 3, backgroundColor: COLORS.accent, borderRadius: 2, marginTop: 2 },
  
  scroll: { flex: 1, backgroundColor: COLORS.secondary },
  
  heroSection: {
    backgroundColor: COLORS.white,
    paddingVertical: 35,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    marginTop: 5,
  },
  avatarWrapper: {
    position: 'relative',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  avatar: { 
    width: 110, 
    height: 110, 
    borderRadius: 55, 
    borderWidth: 4, 
    borderColor: COLORS.primary 
  },
  editPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.accent,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  nameText: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: COLORS.textDark, 
    marginTop: 15 
  },
  emailText: { 
    fontSize: 14, 
    color: COLORS.textLight, 
    opacity: 0.7, 
    fontWeight: '600', 
    marginTop: 2 
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 15,
    marginTop: 25,
  },
  statCard: {
    backgroundColor: COLORS.white,
    width: '43%',
    paddingVertical: 20,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  statVal: { fontSize: 22, fontWeight: '900', color: COLORS.textDark, marginVertical: 4 },
  statLab: { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  statCategory: { fontSize: 10, fontWeight: '600', color: COLORS.textLight, marginTop: 2 },

  infoBox: {
    margin: 20,
    padding: 25,
    backgroundColor: COLORS.white,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: COLORS.primary, letterSpacing: 1.5 },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20
  },
  saveButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
  
  // ESTILOS CORREGIDOS PARA LAS FILAS
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
    flexWrap: 'wrap', // Permite que los elementos se envuelvan si es necesario
  },
  rowEditing: {
    backgroundColor: COLORS.secondary + '80',
    borderRadius: 10,
    paddingVertical: 4
  },
  rowLeft: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flex: 1, // Ocupa el espacio necesario
    marginRight: 10, // Espacio entre el label y el valor
  },
  rowLabel: { 
    marginLeft: 12, 
    fontSize: 14, 
    fontWeight: '600', 
    color: COLORS.textLight,
    flexShrink: 1, // Permite que el texto se encoja si es necesario
  },
  
  // ESTILOS CORREGIDOS PARA EL VALOR (especialmente para correo)
  rowValue: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.textDark,
    textAlign: 'right',
    maxWidth: '55%', // Límite de ancho
    flexShrink: 1, // Permite que se encoja
  },
  
  // ESTILO ESPECIAL PARA CORREO ELECTRÓNICO
  rowValueEmail: {
    maxWidth: '60%', // Un poco más de ancho para correos largos
    fontSize: 13, // Fuente ligeramente más pequeña para correos largos
  },
  
  // ESTILO ESPECIAL PARA INPUT DE CORREO
  inputEmail: {
    width: '60%', // Más ancho para correos
  },
  
  input: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    width: '55%',
    fontSize: 14,
    color: COLORS.textDark,
    elevation: 1,
  },

  footer: { marginTop: 10, alignItems: 'center' },
  logoutText: { color: COLORS.error, fontWeight: '900', fontSize: 15, opacity: 0.8 },
});