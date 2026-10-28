import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  ALERT_SOUND_OPTIONS, 
  getSelectedSoundId, 
  setSelectedSoundId, 
  playSampleSound, 
  stopSampleSound, 
  AlertSoundOption 
} from '../lib/notificationSounds';

export default function ProfileScreen() {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSound, setSelectedSound] = useState<string>('sirena_cuartel');
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const socioId = await AsyncStorage.getItem('socioId');
        if (!socioId) {
          router.replace('/register');
          return;
        }

        const { data, error } = await supabase
          .from('socios')
          .select('*')
          .eq('id', socioId)
          .single();

        if (error) throw error;
        setProfileData(data);

        // Cargar sonido preferido
        const savedSound = await getSelectedSoundId();
        setSelectedSound(savedSound);
      } catch (error) {
        console.error('Error fetching profile:', error);
        alert('Hubo un error cargando tu perfil.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      stopSampleSound();
    };
  }, []);

  const handleSelectSound = async (soundId: string) => {
    setSelectedSound(soundId);
    await setSelectedSoundId(soundId);
  };

  const handlePlayPreview = async (soundId: string) => {
    if (playingSoundId === soundId) {
      await stopSampleSound();
      setPlayingSoundId(null);
    } else {
      setPlayingSoundId(soundId);
      await playSampleSound(soundId);
      // Tras unos segundos, restauramos el icono de reproducir
      setTimeout(() => {
        setPlayingSoundId((curr) => (curr === soundId ? null : curr));
      }, 4500);
    }
  };

  const handleLogout = async () => {
    await stopSampleSound();
    await AsyncStorage.removeItem('socioId');
    router.replace('/register');
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
      
      {/* Cabecera Superior Fija con Botón Volver */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={async () => {
            await stopSampleSound();
            router.push('/');
          }}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Mi Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 30 }}>👤</Text>
          </View>
          <Text style={styles.title}>Mi Perfil</Text>
          <Text style={styles.subtitle}>Bomberos Voluntarios de Verónica</Text>
        </View>

        {profileData && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Datos Personales</Text>
            
            <View style={styles.infoRow}>
              <Text style={{ fontSize: 20, width: 25, textAlign: 'center' }}>👤</Text>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Nombre Completo</Text>
                <Text style={styles.infoValue}>{profileData.nombre}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={{ fontSize: 20, width: 25, textAlign: 'center' }}>📱</Text>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{profileData.telefono}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={{ fontSize: 20, width: 25, textAlign: 'center' }}>📧</Text>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profileData.email}</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Logística</Text>
            
            <View style={styles.infoRow}>
              <Text style={{ fontSize: 20, width: 25, textAlign: 'center' }}>📍</Text>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Dirección de Vivienda</Text>
                <Text style={styles.infoValue}>{profileData.direccion || 'No especificada'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={{ fontSize: 20, width: 25, textAlign: 'center' }}>🚗</Text>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Vehículo</Text>
                <Text style={styles.infoValue}>{profileData.vehiculo || 'No especificado'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tarjeta de Configuración de Sonido de Emergencia */}
        <View style={[styles.card, { marginTop: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 24, marginRight: 10 }}>🔊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.soundCardTitle}>Sonido de Alerta de Emergencia</Text>
              <Text style={styles.soundDescription}>
                Tono que sonará ante siniestros e intervenciones de Bomberos.
              </Text>
            </View>
          </View>

          <View style={styles.soundOptionsContainer}>
            {ALERT_SOUND_OPTIONS.map((option) => {
              const isSelected = selectedSound === option.id;
              const isPlaying = playingSoundId === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.soundOptionCard,
                    isSelected && styles.soundOptionCardSelected,
                  ]}
                  onPress={() => handleSelectSound(option.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.soundOptionLeft}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.soundOptionName, isSelected && styles.soundOptionNameSelected]}>
                        {option.icono} {option.nombre}
                      </Text>
                      <Text style={styles.soundOptionSub}>{option.subtitulo}</Text>
                    </View>
                  </View>

                  {option.requireAsset && (
                    <TouchableOpacity
                      style={[styles.previewButton, isPlaying && styles.previewButtonPlaying]}
                      onPress={() => handlePlayPreview(option.id)}
                    >
                      <Text style={styles.previewButtonText}>
                        {isPlaying ? '⏹️ Parar' : '▶️ Probar'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          
          <View style={styles.soundTipContainer}>
            <Text style={styles.soundTipText}>
              🚨 <Text style={{ fontWeight: 'bold', color: '#f87171' }}>Atención:</Text> Los sonidos de Sirena y Alarma están diseñados con volumen y frecuencia de advertencia para garantizar su respuesta en situaciones críticas.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={{ fontSize: 20, marginRight: 10 }}>🚪</Text>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 18, padding: 10 }}
          onPress={() => Linking.openURL('https://bomberos-veronica.vercel.app/privacidad')}
        >
          <Text style={{ color: '#94a3b8', fontSize: 13, textDecorationLine: 'underline', textAlign: 'center' }}>
            🔒 Política de Privacidad y Tratamiento de Datos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={async () => {
            await stopSampleSound();
            router.push('/');
          }}
        >
          <Text style={styles.cancelButtonText}>← Volver al Inicio</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topHeader: {
    paddingTop: Platform.OS === 'web' ? 40 : 60,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 20,
  },
  topHeaderTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'web' ? 36 : 56,
    padding: 8,
  },
  backButtonText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  infoValue: {
    color: '#fff',
    fontSize: 16,
    marginTop: 2,
  },
  logoutButton: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 500,
  },
  logoutText: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  cancelButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 15,
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  soundCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  soundDescription: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  soundOptionsContainer: {
    marginTop: 10,
    gap: 10,
  },
  soundOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  soundOptionCardSelected: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  soundOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#ef4444',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  soundOptionName: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  soundOptionNameSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  soundOptionSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  previewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  previewButtonPlaying: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: '#ef4444',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  soundTipContainer: {
    marginTop: 15,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  soundTipText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },
});
