import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Modal, StatusBar, Dimensions, Animated, Easing, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#2E8B57',
  secondary: '#F0FFF4',
  accent: '#3CB371',
  textDark: '#1A3026',
  textLight: '#4A4A4A',
  white: '#FFFFFF',
  border: '#E0E0E0',
  error: '#D32F2F',
  success: '#2E7D32'
};

const AnimatedProfessionalBackground = () => {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    driftLoop.start();
    pulseLoop.start();

    return () => {
      driftLoop.stop();
      pulseLoop.stop();
    };
  }, [drift, pulse]);

  const orb1TranslateY = drift.interpolate({ inputRange: [0, 1], outputRange: [-10, 18] });
  const orb2TranslateY = drift.interpolate({ inputRange: [0, 1], outputRange: [14, -20] });
  const orb1Scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const orb2Scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.98] });
  const orbOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.28] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[COLORS.secondary, COLORS.white]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.animatedOrb,
          styles.orbTop,
          {
            opacity: orbOpacity,
            transform: [{ translateY: orb1TranslateY }, { scale: orb1Scale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.animatedOrb,
          styles.orbBottom,
          {
            opacity: orbOpacity,
            transform: [{ translateY: orb2TranslateY }, { scale: orb2Scale }],
          },
        ]}
      />
    </View>
  );
};

export default function LoginScreen({ navigation }: any) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState({ show: false, title: '', message: '' });
  const [selectedGender, setSelectedGender] = useState<string>('');

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    username: '',
    email: '',
    celular: '',
    password: '',
    confirmPassword: '',
    fecha_nacimiento: '',
    genero: ''
  });

  const [birthDate, setBirthDate] = useState(new Date());
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempBirthDate, setTempBirthDate] = useState(new Date());

  const showAlert = (title: string, message: string) => {
    setModalVisible({ show: true, title, message });
  };

  const updateForm = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return match[1] + (match[2] ? ` ${match[2]}` : '') + (match[3] ? `-${match[3]}` : '');
    }
    return value;
  };

  const handlePhoneChange = (text: string) => {
    updateForm('celular', formatPhoneNumber(text));
  };

  const applyBirthDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    updateForm('fecha_nacimiento', `${year}-${month}-${day}`);
    setBirthDate(new Date(year, date.getMonth(), date.getDate()));
  };

  const handleDateSelect = () => {
    if (Platform.OS === 'ios') {
      setTempBirthDate(birthDate);
    }
    setShowDateModal(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'ios') {
      if (selectedDate) {
        setTempBirthDate(selectedDate);
      }
      return;
    }

    setShowDateModal(false);
    if (event?.type === 'dismissed') return;
    if (selectedDate) {
      const rawTimestamp = event?.nativeEvent?.timestamp;
      const normalizedTimestamp =
        typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp)
          ? Math.abs(rawTimestamp) < 1e12
            ? rawTimestamp * 1000
            : rawTimestamp
          : undefined;

      const pickerDate =
        normalizedTimestamp !== undefined ? new Date(normalizedTimestamp) : selectedDate;

      const safeDate = Number.isNaN(pickerDate.getTime()) ? selectedDate : pickerDate;
      applyBirthDate(safeDate);
    }
  };

  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return '';
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return `${age} años`;
  };

  const handleLogin = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      showAlert('Atención', 'Por favor, ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    const result = await signIn(form.email.trim(), form.password.trim());
    setLoading(false);
    if (!result.success) {
      showAlert('Error de autenticación', result.error || 'Error al iniciar sesión');
    }
  };

  const handleRegister = async () => {
    const { nombre, apellido, username, email, celular, password, confirmPassword, fecha_nacimiento, genero } = form;
    if (!nombre.trim() || !apellido.trim() || !username.trim() || !email.trim() || !celular.trim() || !password.trim() || !confirmPassword.trim() || !fecha_nacimiento.trim() || !genero.trim()) {
      showAlert('Atención', 'Todos los campos son obligatorios.');
      return;
    }
    if (password !== confirmPassword) { showAlert('Atención', 'Las contraseñas no coinciden.'); return; }
    if (password.length < 6) { showAlert('Atención', 'La contraseña debe tener al menos 6 caracteres.'); return; }
    const cleanPhone = celular.replace(/\D/g, '');
    if (cleanPhone.length !== 10) { showAlert('Atención', 'El número de teléfono debe tener 10 dígitos.'); return; }

    setLoading(true);
    const result = await signUp({ ...form, celular: cleanPhone });
    setLoading(false);

    if (result.success) {
      showAlert('Registro exitoso', result.message || '¡Cuenta creada! Verifica tu correo.');
      setForm({ nombre: '', apellido: '', username: '', email: '', celular: '', password: '', confirmPassword: '', fecha_nacimiento: '', genero: '' });
      setSelectedGender('');
      setBirthDate(new Date());
      setIsLogin(true);
    } else {
      showAlert('Error en registro', result.error || 'Error al registrarse');
    }
  };

  const handleRecovery = async () => {
    const email = form.email.trim();
    if (!email) {
      showAlert('Atención', 'Por favor ingresa tu correo electrónico.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Atención', 'Ingresa un correo electrónico válido.');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      const result = await resetPassword(email);

      if (result.success) {
        setRecoveryMessage('¡Enlace enviado! Revisa tu correo (incluye spam).');
        Alert.alert(
          'Enlace enviado',
          'Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu correo (incluyendo spam).',
          [{ text: 'OK' }]
        );
      } else {
        setRecoveryMessage(result.error || 'No pudimos enviar el enlace.');
        showAlert('Error', result.error || 'No pudimos enviar el enlace. Intenta de nuevo.');
      }
    } catch (err: any) {
      console.error('Error en recuperación:', err);
      setRecoveryMessage('Error inesperado. Intenta más tarde.');
      showAlert('Error', 'Ocurrió un error inesperado al enviar el enlace.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const renderDateText = () => {
    if (form.fecha_nacimiento) {
      const date = new Date(form.fecha_nacimiento + 'T00:00:00'); // Añadimos hora 00:00 local para evitar offset
      return `${date.toLocaleDateString('es-MX')} (${calculateAge(form.fecha_nacimiento)})`;
    }
    return 'Seleccionar fecha';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <AnimatedProfessionalBackground />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.brandName}>NUTRI U</Text>
            <View style={styles.underline} />
            <Text style={styles.subtitle}>{isLogin ? 'App de Nutrición y Salud' : 'Registro de Paciente'}</Text>
          </View>

          <View style={styles.card}>
            {!isLogin && (
              <>
                <View style={styles.row}>
                  <CustomInput icon="person-outline" placeholder="Nombre*" value={form.nombre} onChangeText={(t: string) => updateForm('nombre', t)} style={{ flex: 1, marginRight: 10 }} />
                  <CustomInput icon="person-outline" placeholder="Apellido*" value={form.apellido} onChangeText={(t: string) => updateForm('apellido', t)} style={{ flex: 1 }} />
                </View>
                <CustomInput icon="at-outline" placeholder="Nombre de usuario*" value={form.username} onChangeText={(t: string) => updateForm('username', t)} />
                <View style={styles.row}>
                  <CustomInput icon="mail-outline" placeholder="Correo electrónico*" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(t: string) => updateForm('email', t)} style={{ flex: 1, marginRight: 10 }} />
                  <CustomInput icon="call-outline" placeholder="Celular*" keyboardType="phone-pad" value={form.celular} onChangeText={handlePhoneChange} maxLength={12} style={{ flex: 1 }} />
                </View>
                <TouchableOpacity style={styles.datePickerButton} onPress={handleDateSelect}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                  <Text style={[styles.dateText, !form.fecha_nacimiento && { color: '#999' }]}>{renderDateText()}</Text>
                </TouchableOpacity>
                <View style={styles.genderContainer}>
                  <Text style={styles.genderLabel}>Género*</Text>
                  <View style={styles.genderButtons}>
                    <TouchableOpacity style={[styles.genderButton, selectedGender === 'masculino' && styles.genderButtonActive]} onPress={() => { setSelectedGender('masculino'); updateForm('genero', 'masculino'); }}>
                      <Text style={[styles.genderButtonText, selectedGender === 'masculino' && styles.genderButtonTextActive]}>Hombre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.genderButton, selectedGender === 'femenino' && styles.genderButtonActive]} onPress={() => { setSelectedGender('femenino'); updateForm('genero', 'femenino'); }}>
                      <Text style={[styles.genderButtonText, selectedGender === 'femenino' && styles.genderButtonTextActive]}>Mujer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {isLogin && (
              <CustomInput 
                icon="mail-outline" 
                placeholder="Correo electrónico*" 
                keyboardType="email-address" 
                autoCapitalize="none" 
                value={form.email} 
                onChangeText={(t: string) => updateForm('email', t)} 
              />
            )}

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Contraseña*" 
                placeholderTextColor="#999" 
                secureTextEntry={!showPassword} 
                value={form.password} 
                onChangeText={(t: string) => updateForm('password', t)} 
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            {!isLogin && (
              <View style={styles.inputWrapper}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Confirmar contraseña*" 
                  placeholderTextColor="#999" 
                  secureTextEntry={!showPassword} 
                  value={form.confirmPassword} 
                  onChangeText={(t: string) => updateForm('confirmPassword', t)} 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>
            )}

            {isLogin && (
              <View style={styles.recoverySection}>
                <TouchableOpacity 
                  onPress={handleRecovery} 
                  style={styles.forgotBtn}
                  disabled={recoveryLoading}
                >
                  {recoveryLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                  )}
                </TouchableOpacity>

                {recoveryMessage ? (
                  <Text style={[
                    styles.recoveryMessage,
                    recoveryMessage.includes('Error') || recoveryMessage.includes('No pudimos') 
                      ? { color: COLORS.error } 
                      : { color: COLORS.success }
                  ]}>
                    {recoveryMessage}
                  </Text>
                ) : null}
              </View>
            )}

            <TouchableOpacity 
              style={[styles.mainBtn, (loading || recoveryLoading) && { opacity: 0.7 }]} 
              onPress={isLogin ? handleLogin : handleRegister} 
              disabled={loading || recoveryLoading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.mainBtnText}>
                  {isLogin ? 'INICIAR SESIÓN' : 'REGISTRARME'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                <Text style={styles.switchTextBold}>
                  {isLogin ? 'Regístrate' : 'Inicia sesión'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>App Nutri U © 2026</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalVisible.show} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[
              styles.modalTitle, 
              modalVisible.title.includes('Error') ? { color: COLORS.error } : { color: COLORS.textDark }
            ]}>
              {modalVisible.title}
            </Text>
            <Text style={styles.modalMessage}>{modalVisible.message}</Text>
            <TouchableOpacity 
              style={[
                styles.modalBtn, 
                modalVisible.title.includes('Error') ? { backgroundColor: COLORS.error } : { backgroundColor: COLORS.primary }
              ]} 
              onPress={() => setModalVisible({...modalVisible, show: false})}
            >
              <Text style={styles.modalBtnText}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'ios' ? (
        <Modal visible={showDateModal} transparent animationType="slide" onRequestClose={() => setShowDateModal(false)}>
          <View style={styles.dateModalOverlay}>
            <View style={styles.dateModalContent}>
              <Text style={styles.dateModalTitle}>Selecciona tu fecha de nacimiento</Text>

              <DateTimePicker
                value={tempBirthDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date(1899, 0, 1)}
                maximumDate={new Date()}
                locale="es-MX"
              />

              <View style={styles.dateModalActions}>
                <TouchableOpacity
                  style={[styles.dateActionBtn, styles.dateCancelBtn]}
                  onPress={() => setShowDateModal(false)}
                >
                  <Text style={styles.dateCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateActionBtn, styles.dateConfirmBtn]}
                  onPress={() => {
                    applyBirthDate(tempBirthDate);
                    setShowDateModal(false);
                  }}
                >
                  <Text style={styles.dateConfirmText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : (
        showDateModal && (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date(1899, 0, 1)}
            maximumDate={new Date()}
            locale="es-MX"
          />
        )
      )}
    </View>
  );
}

const CustomInput = ({ icon, style, placeholder, ...props }: any) => (
  <View style={[styles.inputWrapper, style]}>
    <Ionicons name={icon} size={20} color={COLORS.primary} style={styles.inputIcon} />
    <TextInput style={[styles.input]} placeholder={placeholder} placeholderTextColor="#999" {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.secondary },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center', paddingTop: 40, paddingBottom: 20 },
  animatedOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  orbTop: {
    width: width * 0.7,
    height: width * 0.7,
    top: -width * 0.22,
    left: -width * 0.2,
  },
  orbBottom: {
    width: width * 0.8,
    height: width * 0.8,
    right: -width * 0.28,
    bottom: -height * 0.06,
    backgroundColor: COLORS.accent,
  },
  header: { alignItems: 'center', marginBottom: 30 },
  brandName: { fontSize: 32, fontWeight: '900', color: COLORS.primary, letterSpacing: 2 },
  underline: { width: 40, height: 4, backgroundColor: COLORS.accent, marginTop: 5, borderRadius: 2 },
  subtitle: { color: COLORS.textLight, marginTop: 10, fontSize: 14, fontWeight: '300', textAlign: 'center' },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 15 },
  row: { flexDirection: 'row', marginBottom: 15 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 15, paddingVertical: 8 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: COLORS.textDark, fontSize: 15, paddingVertical: 2 },
  datePickerButton: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 15, paddingVertical: 12 },
  dateText: { flex: 1, color: COLORS.textDark, fontSize: 15 },
  genderContainer: { marginBottom: 15 },
  genderLabel: { fontSize: 14, color: COLORS.textDark, fontWeight: '600', marginBottom: 8 },
  genderButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  genderButton: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.secondary, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginHorizontal: 5 },
  genderButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  genderButtonTextActive: { color: COLORS.white, fontWeight: '700' },
  recoverySection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  forgotBtn: {
    alignSelf: 'center',
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  recoveryMessage: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  mainBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', elevation: 4 },
  mainBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchText: { color: COLORS.textLight, fontSize: 13 },
  switchTextBold: { color: COLORS.primary, fontWeight: '700' },
  footer: { marginTop: 30, marginBottom: 10, alignItems: 'center' },
  footerText: { color: '#BBB', fontSize: 10, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 15, padding: 25, width: '90%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalMessage: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, minWidth: 140 },
  modalBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  dateModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10,
  },
  dateActionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateCancelBtn: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateConfirmBtn: {
    backgroundColor: COLORS.primary,
  },
  dateCancelText: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  dateConfirmText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});