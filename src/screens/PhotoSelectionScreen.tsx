import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { colors } from '../styles/colors';
import { useProfileImage } from '../context/ProfileImageContext';

export default function PhotoSelectionScreen({ route, navigation }: any) {
  // Manejar el caso donde route.params podría ser undefined
  const params = route.params || {};
  const currentPhoto = params.currentPhoto || 'usu.webp';
  const onPhotoSelected = params.onPhotoSelected || (() => {});
  
  const [selectedPhoto, setSelectedPhoto] = useState(currentPhoto);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { setProfileImage } = useProfileImage();

  // Fotos normales
  const normalPhotos = [
    'manzy.png',
    'manzyasustao.png',
    'manzyfeli.png',
    'manzyfete.png',
    'manzyfoto.png',
    'manzysabio.png',
    'manzysaluda.png',
    'manzysorprendido.png',
    'manzytite.png'
  ];

  // Fotos especiales de Halloween
  const halloweenPhotos = [
    'manzyhalo1.png',
    'manzyhalo2.png',
    'manzyhalo3.png',
    'manzyhalo4.png',
    'manzyhalo5.png',
    'manzyhalo6.png'
  ];

  const getImageSource = (imageName: string) => {
    const imageMap: {[key: string]: any} = {
      'usu.webp': require('../../assets/usu.webp'),
      'manzy.png': require('../../assets/manzy.png'),
      'manzyasustao.png': require('../../assets/manzyasustao.png'),
      'manzyfeli.png': require('../../assets/manzyfeli.png'),
      'manzyfete.png': require('../../assets/manzyfete.png'),
      'manzyfoto.png': require('../../assets/manzyfoto.png'),
      'manzysabio.png': require('../../assets/manzysabio.png'),
      'manzysaluda.png': require('../../assets/manzysaluda.png'),
      'manzysorprendido.png': require('../../assets/manzysorprendido.png'),
      'manzytite.png': require('../../assets/manzytite.png'),
      'manzyhalo1.png': require('../../assets/manzyhalo1.png'),
      'manzyhalo2.png': require('../../assets/manzyhalo2.png'),
      'manzyhalo3.png': require('../../assets/manzyhalo3.png'),
      'manzyhalo4.png': require('../../assets/manzyhalo4.png'),
      'manzyhalo5.png': require('../../assets/manzyhalo5.png'),
      'manzyhalo6.png': require('../../assets/manzyhalo6.png'),
    };
    return imageMap[imageName] || require('../../assets/usu.webp');
  };

  const handlePhotoSelect = (photoName: string) => {
    setSelectedPhoto(photoName);
  };

  const handleConfirm = () => {
    onPhotoSelected(selectedPhoto);
    setProfileImage(selectedPhoto);
    setShowSuccessModal(true);
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  const PhotoItem = ({ photoName }: { photoName: string }) => (
    <TouchableOpacity 
      style={[
        styles.photoItem,
        selectedPhoto === photoName && styles.selectedPhotoItem
      ]}
      onPress={() => handlePhotoSelect(photoName)}
    >
      <Image 
        source={getImageSource(photoName)} 
        style={styles.photoImage}
      />
    </TouchableOpacity>
  );

  // Popup de Éxito
  const SuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleSuccessClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.successModalContent}>
          <Image 
            source={require('../../assets/manzyfeli.png')}
            style={styles.modalImage}
          />
          <Text style={styles.successModalTitle}>¡Foto Actualizada!</Text>
          <Text style={styles.successModalText}>
            Tu foto de perfil ha sido cambiada exitosamente.
          </Text>
          <TouchableOpacity 
            style={styles.successModalButton}
            onPress={handleSuccessClose}
          >
            <Text style={styles.successModalButtonText}>¡Genial!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Foto actual - ACTUALIZADA para mostrar la selección en tiempo real */}
        <View style={styles.currentPhotoSection}>
          <Text style={styles.sectionTitle}>Vista Previa</Text>
          <Text style={styles.currentPhotoSubtitle}>
            {selectedPhoto === currentPhoto ? 'Foto actual' : 'Así se verá tu nueva foto'}
          </Text>
          <View style={styles.currentPhotoContainer}>
            <Image 
              source={getImageSource(selectedPhoto)} 
              style={styles.currentPhoto}
            />
            {selectedPhoto !== currentPhoto && (
              <View style={styles.newPhotoBadge}>
                <Text style={styles.newPhotoBadgeText}>NUEVA</Text>
              </View>
            )}
          </View>
        </View>

        {/* Botones de acción - MOVIDOS MÁS ARRIBA */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.confirmButton,
              selectedPhoto === currentPhoto && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirm}
            disabled={selectedPhoto === currentPhoto}
          >
            <Text style={styles.confirmButtonText}>
              {selectedPhoto === currentPhoto ? 'Misma Foto' : 'Confirmar Foto'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fotos normales */}
        <View style={styles.photosSection}>
          <Text style={styles.sectionTitle}>Selecciona una foto</Text>
          <View style={styles.photosGrid}>
            {normalPhotos.map((photo) => (
              <PhotoItem key={photo} photoName={photo} />
            ))}
          </View>
        </View>

        {/* Fotos especiales de Halloween */}
        <View style={styles.specialSection}>
          <View style={styles.specialHeader}>
            <Text style={styles.specialTitle}>Edición Especial de Halloween</Text>
            <View style={styles.specialBadge}>
              <Text style={styles.specialBadgeText}>ESPECIAL</Text>
            </View>
          </View>
          <View style={styles.photosGrid}>
            {halloweenPhotos.map((photo) => (
              <PhotoItem key={photo} photoName={photo} />
            ))}
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Popup de Éxito */}
      <SuccessModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  currentPhotoSection: {
    backgroundColor: colors.white,
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  currentPhotoSubtitle: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: 15,
    textAlign: 'center',
  },
  currentPhotoContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  currentPhoto: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  newPhotoBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newPhotoBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.white,
  },
  photosSection: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  specialSection: {
    backgroundColor: '#fff7ed',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  specialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  specialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
    flex: 1,
  },
  specialBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  specialBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.white,
    letterSpacing: 0.5,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoItem: {
    width: '30%',
    aspectRatio: 1,
    marginBottom: 15,
    borderRadius: 15,
    padding: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPhotoItem: {
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: '#e3f2fd',
    transform: [{ scale: 1.05 }],
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 12,
  },
  backButton: {
    backgroundColor: '#6c757d',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.6,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 20,
  },
  // Estilos para el Popup de Éxito
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: colors.white,
    borderRadius: 25,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    borderTopWidth: 6,
    borderTopColor: colors.success,
  },
  modalImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 15,
    textAlign: 'center',
  },
  successModalText: {
    fontSize: 16,
    color: colors.grayDark,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  successModalButton: {
    backgroundColor: colors.success,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
    minWidth: 120,
  },
  successModalButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});