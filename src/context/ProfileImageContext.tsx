import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase';

interface ProfileImageContextType {
  profileImage: string;
  setProfileImage: (image: string) => void;
}

const ProfileImageContext = createContext<ProfileImageContextType | undefined>(undefined);

interface ProfileImageProviderProps {
  children: ReactNode;
}

export const ProfileImageProvider: React.FC<ProfileImageProviderProps> = ({ children }) => {
  const { user, loading } = useUser();
  const [profileImage, setProfileImage] = useState('usu.webp');

  useEffect(() => {
    // Salimos temprano si no hay nada útil
    if (loading || !user?.foto_perfil) {
      return;
    }

    const fotoPath = user.foto_perfil.trim();

    // Caso por defecto
    if (!fotoPath || fotoPath === 'default_avatar.png' || fotoPath === 'usu.webp') {
      setProfileImage(prev => prev === 'usu.webp' ? prev : 'usu.webp');
      return;
    }

    // Generamos URL solo si es necesario (evitamos updates repetidos)
    setProfileImage(prev => {
      // Si ya tenemos una URL con este mismo path → no actualizamos
      if (prev.includes(fotoPath) && prev.includes('supabase.co')) {
        return prev; // ← Esto rompe el loop
      }

      const { data } = supabase.storage.from('perfiles').getPublicUrl(fotoPath);

      if (data?.publicUrl) {
        const url = `${data.publicUrl}?t=${Date.now()}`;
        console.log('Foto cargada:', url);
        return url;
      }

      return prev; // No cambiamos si falla
    });
  }, [user?.foto_perfil, loading]); // ← Dependencia ESTABLE: solo el string de la foto + loading

  return (
    <ProfileImageContext.Provider value={{ profileImage, setProfileImage }}>
      {children}
    </ProfileImageContext.Provider>
  );
};

export const useProfileImage = () => {
  const context = useContext(ProfileImageContext);
  if (context === undefined) {
    throw new Error('useProfileImage must be used within a ProfileImageProvider');
  }
  return context;
};