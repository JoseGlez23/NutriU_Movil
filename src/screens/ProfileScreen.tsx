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
  TextInput,
  Animated,
  Easing,
  Modal,
  Alert
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
        if (/^\d*$/.test(text) && text.length <= 10) {
          setEditedUser((prev: any) => ({ ...prev, [fieldKey]: text }));
        }
      } else {
        if (/^\d*(\.\d*)?$/.test(text)) {
          setEditedUser((prev: any) => ({ ...prev, [fieldKey]: text }));
        }
      }
    } else {
      setEditedUser((prev: any) => ({ ...prev, [fieldKey]: text }));
    }
  };

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
        >
          {currentValue}
        </Text>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editedUser?.[prevProps.fieldKey] === nextProps.editedUser?.[nextProps.fieldKey] &&
    prevProps.value === nextProps.value &&
    prevProps.editable === nextProps.editable
  );
});

export default function ProfileScreen({ navigation }: any) {
  const { user, loading, refreshUserData, error } = useUser();
  const { signOut } = useAuth();
  const { profileImage, setProfileImage } = useProfileImage();
  const [bmi, setBmi] = useState<string>('0');
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<any>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState(0);
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [emailChangeCurrentToken, setEmailChangeCurrentToken] = useState('');
  const [emailChangeNewEmail, setEmailChangeNewEmail] = useState('');
  const [emailChangeCurrentFinalToken, setEmailChangeCurrentFinalToken] = useState('');
  const [emailChangeNewEmailToken, setEmailChangeNewEmailToken] = useState('');
  const [isEmailChanging, setIsEmailChanging] = useState(false);
  const [photoModal, setPhotoModal] = useState({
    visible: false,
    title: '',
    message: '',
    icon: 'information-circle-outline',
    color: COLORS.primary,
  });

  const showPhotoModal = (
    title: string,
    message: string,
    icon: string = 'information-circle-outline',
    color: string = COLORS.primary
  ) => {
    setPhotoModal({
      visible: true,
      title,
      message,
      icon,
      color,
    });
  };

  const closePhotoModal = () => {
    setPhotoModal((prev) => ({ ...prev, visible: false }));
  };

  const pulseValue = useRef(new Animated.Value(1)).current;
  const breatheValue = useRef(new Animated.Value(1)).current;
  const textOpacityValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (loading) {
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
      showPhotoModal(
        'Permiso denegado',
        'Necesitamos permisos para acceder a tus fotos.',
        'warning-outline',
        '#FFA500'
      );
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

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `perfiles_mobile/${fileName}`;


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
        throw error;
      }


      const { data: urlData } = supabase.storage.from('perfiles').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      if (!publicUrl) throw new Error('No URL pública');

      // Log eliminado para producción

      const { error: updateError } = await supabase
        .from('pacientes')
        .update({ foto_perfil: filePath })
        .eq('id_paciente', user.id_paciente);

      if (updateError) throw updateError;

      setProfileImage(publicUrl + `?t=${Date.now()}`);
      setLocalImageUri(null);
      refreshUserData();
      showPhotoModal(
        '¡Foto actualizada!',
        'Tu foto de perfil se guardó correctamente.',
        'checkmark-circle-outline',
        COLORS.primary
      );
    } catch (err) {
      showPhotoModal(
        'Error al subir foto',
        'No se pudo subir la foto. Intenta de nuevo.',
        'close-circle-outline',
        COLORS.error
      );
    }
  };

  const handleSave = async () => {
    if (!editedUser) return;

    try {
      const { error } = await supabase
        .from('pacientes')
        .update({
          nombre_usuario: editedUser.nombre_usuario
        })
        .eq('id_paciente', user.id_paciente);

      if (error) throw error;

      setIsEditing(false);
      refreshUserData();
      showPhotoModal(
        '¡Nombre actualizado!',
        'Tu nombre de usuario se guardó correctamente.',
        'checkmark-circle-outline',
        COLORS.primary
      );
    } catch (err) {
      showPhotoModal(
        'Error al guardar',
        'No se pudo guardar el cambio.',
        'close-circle-outline',
        COLORS.error
      );
    }
  };

  const openLogoutModal = () => {
    setIsLogoutModalVisible(true);
  };

  const closeLogoutModal = () => {
    if (isLoggingOut) return;
    setIsLogoutModalVisible(false);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      setIsLogoutModalVisible(false);
    } finally {
      setIsLoggingOut(false);
    }
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

  const getBMICategory = (bmi: string) => {
    const bmiValue = parseFloat(bmi);
    if (bmiValue < 18.5) return 'Bajo peso';
    if (bmiValue >= 18.5 && bmiValue < 25) return 'Normal';
    if (bmiValue >= 25 && bmiValue < 30) return 'Sobrepeso';
    if (bmiValue >= 30) return 'Obesidad';
    return '';
  };

  const getEmailChangeFriendlyError = (err: any): string => {
    const message = String(err?.message || err?.toString() || 'Error desconocido');
    if (message.includes('Invalid login credentials')) return 'Contraseña incorrecta';
    if (message.includes('invalid_credentials')) return 'Contraseña incorrecta';
    if (message.includes('Email not confirmed')) return 'Tu correo no está confirmado';
    if (message.includes('Token expired')) return 'El código expiró. Intenta de nuevo';
    if (message.includes('invalid')) return 'Código o contraseña inválidos';
    if (message.includes('not found')) return 'Usuario no encontrado';
    if (message.includes('already')) return 'Este correo ya está registrado';
    return message;
  };

  const resetEmailChangeModal = () => {
    setEmailChangeStep(0);
    setEmailChangePassword('');
    setEmailChangeCurrentToken('');
    setEmailChangeNewEmail('');
    setEmailChangeCurrentFinalToken('');
    setEmailChangeNewEmailToken('');
  };

  const syncPatientEmailFromAuth = async (): Promise<string | null> => {
    try {
      const { data: { user: updatedUser }, error } = await supabase.auth.getUser();
      if (error || !updatedUser?.email) return null;
      
      const { error: updateError } = await supabase
        .from('pacientes')
        .update({ correo: updatedUser.email })
        .eq('id_paciente', user.id_paciente);
      
      if (updateError) throw updateError;
      return updatedUser.email;
    } catch (err) {
      return null;
    }
  };

  const sendEmailChangeRequest = async () => {
    const normalizedPassword = String(emailChangePassword || '').trim();
    const normalizedNewEmail = String(emailChangeNewEmail || '').trim().toLowerCase();
    
    if (!normalizedPassword) {
      showPhotoModal('Contraseña requerida', 'Ingresa tu contraseña para cambiar el correo.', 'warning-outline', '#FFA500');
      return;
    }
    if (!normalizedNewEmail || !normalizedNewEmail.includes('@')) {
      showPhotoModal('Email inválido', 'Ingresa un correo válido.', 'warning-outline', '#FFA500');
      return;
    }

    try {
      setIsEmailChanging(true);
      const authUser = await supabase.auth.getUser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(authUser.data.user?.email || user?.correo || '').trim().toLowerCase(),
        password: normalizedPassword,
      });

      if (signInError) {
        showPhotoModal('Contraseña incorrecta', getEmailChangeFriendlyError(signInError), 'warning-outline', '#FFA500');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ email: normalizedNewEmail });
      if (updateError) throw updateError;

      setEmailChangeStep(5);
      showPhotoModal(
        'Verifica tu email',
        `Se han enviado códigos de verificación a ambos correos.`,
        'mail-outline',
        COLORS.primary
      );
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    } finally {
      setIsEmailChanging(false);
    }
  };

  const resendCurrentEmailCode = async () => {
    try {
      const authUser = await supabase.auth.getUser();
      const currentEmail = String(authUser.data.user?.email || user?.correo || '').trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: 'email_change' as any,
        email: currentEmail,
      });
      if (error) {
        showPhotoModal('Error', `No pudimos reenviar el código: ${error.message}`, 'warning-outline', '#FFA500');
        return;
      }
      showPhotoModal('Código reenviado', `Se ha reenviado el código a ${currentEmail}.`, 'checkmark-circle-outline', COLORS.primary);
      setEmailChangeCurrentFinalToken('');
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    }
  };

  const resendNewEmailCode = async () => {
    try {
      const normalizedNewEmail = String(emailChangeNewEmail || '').trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: 'email_change' as any,
        email: normalizedNewEmail,
      });
      if (error) {
        showPhotoModal('Error', `No pudimos reenviar el código: ${error.message}`, 'warning-outline', '#FFA500');
        return;
      }
      showPhotoModal('Código reenviado', `Se ha reenviado el código a ${normalizedNewEmail}.`, 'checkmark-circle-outline', COLORS.primary);
      setEmailChangeNewEmailToken('');
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    }
  };

  const verifyCurrentEmailChangeConfirmation = async () => {
    const authUser = await supabase.auth.getUser();
    const currentEmail = String(authUser.data.user?.email || user?.correo || '').trim().toLowerCase();
    const token = String(emailChangeCurrentFinalToken || '').trim().replace(/\s/g, '');

    if (!token) {
      showPhotoModal('Código requerido', 'Ingresa el código que recibió tu correo actual.', 'warning-outline', '#FFA500');
      return;
    }

    try {
      setIsEmailChanging(true);
      const { error } = await supabase.auth.verifyOtp({
        email: currentEmail,
        token,
        type: 'email_change' as any,
      });

      if (error) {
        showPhotoModal('Código inválido', getEmailChangeFriendlyError(error), 'warning-outline', '#FFA500');
        return;
      }

      setEmailChangeStep(6);
      showPhotoModal('Primer paso confirmado', `Ahora ingresa el código de ${emailChangeNewEmail.trim().toLowerCase()}.`, 'checkmark-circle-outline', COLORS.primary);
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    } finally {
      setIsEmailChanging(false);
    }
  };

  const verifyNewEmailTokenAndFinalize = async () => {
    const normalizedNewEmail = String(emailChangeNewEmail || '').trim().toLowerCase();
    const token = String(emailChangeNewEmailToken || '').trim().replace(/\s/g, '');

    if (!token) {
      showPhotoModal('Código requerido', 'Ingresa el código que llegó a tu nuevo correo.', 'warning-outline', '#FFA500');
      return;
    }

    try {
      setIsEmailChanging(true);
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedNewEmail,
        token,
        type: 'email_change' as any,
      });

      if (error) {
        showPhotoModal('Código inválido', getEmailChangeFriendlyError(error), 'warning-outline', '#FFA500');
        return;
      }

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
      }
      
      const confirmedEmail = await syncPatientEmailFromAuth();
      resetEmailChangeModal();

      Alert.alert('¡Correo actualizado!', `Tu correo fue cambiado a ${confirmedEmail || normalizedNewEmail}.`);
      await refreshUserData(true);
      await signOut();
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    } finally {
      setIsEmailChanging(false);
    }
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
              />
              <TouchableOpacity style={styles.editPhotoBadge} onPress={pickImage}>
                <Ionicons name="camera" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.nameText}>
              {user.nombre} {user.apellido}
            </Text>
            <View style={styles.emailRow}>
              <Text style={styles.emailText}>{user.correo}</Text>
              <TouchableOpacity 
                style={styles.changeEmailButton}
                onPress={() => setEmailChangeStep(1)}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

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

          <View style={styles.infoBox}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>
            </View>

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

            <InfoRow 
              label="Correo electrónico" 
              icon="mail-outline" 
              value={user.correo} 
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

            {isEditing && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Guardar Nombre de Usuario</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={openLogoutModal}>
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>

        <Modal
          visible={isLogoutModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeLogoutModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Ionicons name="log-out-outline" size={34} color={COLORS.error} />
              <Text style={styles.modalTitle}>¿Seguro que deseas salir?</Text>
              <Text style={styles.modalMessage}>
                Se cerrará tu sesión actual y tendrás que iniciar sesión nuevamente.
              </Text>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={closeLogoutModal}
                  disabled={isLoggingOut}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalLogoutButton}
                  onPress={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.modalLogoutText}>Salir</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={photoModal.visible}
          transparent
          animationType="fade"
          onRequestClose={closePhotoModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Ionicons name={photoModal.icon as any} size={36} color={photoModal.color} />
              <Text style={styles.modalTitle}>{photoModal.title}</Text>
              <Text style={styles.modalMessage}>{photoModal.message}</Text>

              <View style={styles.photoModalButtonWrap}>
                <TouchableOpacity
                  style={styles.photoModalOkButton}
                  onPress={closePhotoModal}
                >
                  <Text style={styles.photoModalOkText}>Entendido</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* EMAIL CHANGE MODAL - 6 STEP FLOW */}
        <Modal visible={emailChangeStep > 0} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {emailChangeStep === 1 && (
                <>
                  <Ionicons name="lock-closed-outline" size={36} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Confirma tu identidad</Text>
                  <Text style={styles.modalMessage}>Ingresa tu contraseña actual para cambiar el correo.</Text>
                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangePassword}
                    onChangeText={setEmailChangePassword}
                    placeholder="Contraseña"
                    placeholderTextColor={COLORS.textLight}
                    secureTextEntry
                    editable={!isEmailChanging}
                  />
                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={() => resetEmailChangeModal()} disabled={isEmailChanging}>
                      <Text style={styles.modalCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={() => setEmailChangeStep(2)} disabled={isEmailChanging}>
                      <Text style={styles.modalConfirmText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {emailChangeStep === 2 && (
                <>
                  <Ionicons name="mail-outline" size={36} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Nuevo correo electrónico</Text>
                  <Text style={styles.modalMessage}>Ingresa el nuevo correo que deseas usar.</Text>
                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangeNewEmail}
                    onChangeText={setEmailChangeNewEmail}
                    placeholder="nuevo@correo.com"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isEmailChanging}
                  />
                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={() => setEmailChangeStep(1)} disabled={isEmailChanging}>
                      <Text style={styles.modalCancelText}>Atrás</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={sendEmailChangeRequest} disabled={isEmailChanging}>
                      {isEmailChanging ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.modalConfirmText}>Enviar</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {emailChangeStep === 5 && (
                <>
                  <Ionicons name="mail-open-outline" size={36} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Verifica tu correo actual</Text>
                  <Text style={styles.modalMessage}>Ingresa el código enviado a tu correo actual.</Text>
                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangeCurrentFinalToken}
                    onChangeText={setEmailChangeCurrentFinalToken}
                    placeholder="Código"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    editable={!isEmailChanging}
                  />
                  <TouchableOpacity style={styles.resendCodeButton} onPress={resendCurrentEmailCode} disabled={isEmailChanging}>
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={() => resetEmailChangeModal()} disabled={isEmailChanging}>
                      <Text style={styles.modalCancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={verifyCurrentEmailChangeConfirmation} disabled={isEmailChanging}>
                      {isEmailChanging ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.modalConfirmText}>Verificar</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {emailChangeStep === 6 && (
                <>
                  <Ionicons name="key-outline" size={36} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>Verifica tu nuevo correo</Text>
                  <Text style={styles.modalMessage}>Ingresa el código enviado a {emailChangeNewEmail.trim().toLowerCase()}.</Text>
                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangeNewEmailToken}
                    onChangeText={setEmailChangeNewEmailToken}
                    placeholder="Código"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    editable={!isEmailChanging}
                  />
                  <TouchableOpacity style={styles.resendCodeButton} onPress={resendNewEmailCode} disabled={isEmailChanging}>
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalCancelButton} onPress={() => setEmailChangeStep(5)} disabled={isEmailChanging}>
                      <Text style={styles.modalCancelText}>Atrás</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton} onPress={verifyNewEmailTokenAndFinalize} disabled={isEmailChanging}>
                      {isEmailChanging ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.modalConfirmText}>Finalizar</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

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
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  changeEmailButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
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
  
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
  },
  rowEditing: {
    backgroundColor: COLORS.secondary + '80',
    borderRadius: 10,
    paddingVertical: 4
  },
  rowLeft: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flexShrink: 1,
    paddingRight: 12,
  },
  rowLabel: { 
    marginLeft: 12, 
    fontSize: 14, 
    fontWeight: '600', 
    color: COLORS.textLight,
    flexShrink: 1,
  },
  
  rowValue: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: COLORS.textDark,
    textAlign: 'right',
    flexShrink: 1,
    maxWidth: '55%',
  },
  
  rowValueEmail: {
    maxWidth: '58%',
    lineHeight: 18,
  },
  
  inputEmail: {
    width: '62%',
    fontSize: 13,
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

  footer: { marginTop: 2, alignItems: 'center' },
  logoutText: { color: COLORS.error, fontWeight: '900', fontSize: 15, opacity: 0.8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.textDark + '66',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    marginTop: 10,
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.textDark,
    textAlign: 'center',
  },
  modalMessage: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtonsRow: {
    marginTop: 22,
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  modalLogoutButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    minHeight: 44,
  },
  modalLogoutText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
  },
  photoModalButtonWrap: {
    marginTop: 22,
    width: '100%',
  },
  photoModalOkButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  photoModalOkText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
  },
  resendCodeButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  resendCodeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    minHeight: 44,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
  },
  passwordVerificationInput: {
    width: '100%',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    fontSize: 14,
    color: COLORS.textDark,
    backgroundColor: COLORS.secondary,
  },
});