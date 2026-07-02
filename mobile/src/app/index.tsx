import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Vibration, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const { width } = Dimensions.get('window');
// Ajuste de tamaño: reducido a un 50% según el requerimiento (35% de la pantalla, máx 150px)
const buttonSize = Math.min(width * 0.35, 150); 

export default function PanicScreen() {
  const [activeAlert, setActiveAlert] = useState<'fire' | 'accident' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Obteniendo ubicación GPS...');
  const [helpOnTheWay, setHelpOnTheWay] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Escuchar actualizaciones de estado de la alerta en tiempo real
  useEffect(() => {
    // 1. Pedir permisos de notificaciones locales al iniciar
    const requestNotifPermissions = async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    };
    requestNotifPermissions();

    // 2. Suscribirse a las alertas
    let channel: any;
    const setupRealtime = async () => {
      const socioId = await AsyncStorage.getItem('socioId');
      if (socioId) {
        // Verificar si el socio actual es bombero
        const { data: socioData } = await supabase.from('socios').select('is_bombero').eq('id', socioId).single();
        const isBombero = socioData?.is_bombero || false;

        const channelName = 'mis-alertas_' + Date.now();
        channel = supabase
          .channel(channelName)
          // Escuchar NUEVAS alertas solo para bomberos
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'alertas'
          }, async (payload) => {
            if (isBombero && payload.new.estado === 'Pendiente') {
              if (Platform.OS !== 'web') {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `🚨 NUEVA ALERTA: ${payload.new.tipo === 'fire' ? 'FUEGO' : 'SINIESTRO'}`,
                    body: "Un vecino acaba de activar una emergencia. ¡Atención al cuartel!",
                    sound: true,
                  },
                  trigger: null,
                });
              }
            }
          })
          // Escuchar ACTUALIZACIONES de la alerta propia (Ayuda en camino)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'alertas'
          }, async (payload) => {
            if (payload.new.socio_id == socioId && payload.new.estado === 'En proceso') {
              // Lanzar notificación push al celular (solo si no es web)
              if (Platform.OS !== 'web') {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: "¡AYUDA EN CAMINO! 🚒",
                    body: "El cuartel ha tomado tu alerta y se dirige hacia ti.",
                    sound: true,
                  },
                  trigger: null,
                });
              }
              // Mostrar Pantalla Gigante
              setHelpOnTheWay(true);
            }
          })
          .subscribe();
      }
    };
    setupRealtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Manejo de la cuenta regresiva
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      // Termina la cuenta regresiva, procedemos a obtener GPS y enviar alerta
      setCountdown(null);
      setIsSending(true);
      setStatusMsg('Obteniendo ubicación GPS...');
      dispatchAlert();
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const dispatchAlert = async () => {
    try {
      // 0. Verificar si el usuario está registrado
      const socioId = await AsyncStorage.getItem('socioId');
      if (!socioId) {
        setStatusMsg('Error: Debes registrarte primero en "Mi Perfil".');
        setTimeout(() => {
          setIsSending(false);
          setActiveAlert(null);
          router.push('/register');
        }, 2000);
        return;
      }

      // 0.5 Verificar si el socio está suspendido o de baja
      const { data: socioData } = await supabase.from('socios').select('estado').eq('id', socioId).single();
      if (socioData && socioData.estado !== 'activo') {
        setStatusMsg(`CUENTA ${socioData.estado.toUpperCase()}: Contacte a administración.`);
        setTimeout(() => {
          setIsSending(false);
          setActiveAlert(null);
        }, 4000);
        return;
      }

      // 1. Pedimos permiso al usuario (Solo lo pregunta la primera vez)
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      let lat = -35.3855; // Por defecto Verónica centro si falla
      let lng = -57.3400;

      if (status !== 'granted') {
        setStatusMsg('Permiso GPS denegado. Enviando alerta aproximada...');
      } else {
        // 2. Si hay permiso, obtenemos las coordenadas exactas
        let location = await Location.getCurrentPositionAsync({});
        lat = location.coords.latitude;
        lng = location.coords.longitude;
        setStatusMsg(`Ubicación obtenida: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }

      // 3. Enviar a Supabase
      const { error } = await supabase.from('alertas').insert([
        {
          socio_id: socioId,
          lat: lat,
          lng: lng,
          tipo: activeAlert,
          estado: 'Pendiente'
        }
      ]);

      if (error) {
        throw error;
      }
      
      setStatusMsg('¡Alerta recibida en la Central!');

    } catch (error) {
      console.error('Error procesando la alerta:', error);
      setStatusMsg('Error de conexión al enviar la alerta.');
    } finally {
      // Volvemos a la normalidad a los 4 segundos
      setTimeout(() => {
        setIsSending(false);
        setActiveAlert(null);
      }, 4000);
    }
  };

  const handleAlert = (type: 'fire' | 'accident') => {
    // Si estamos en web o en dispositivo sin vibración, no fallará
    if (Platform.OS !== 'web') {
      Vibration.vibrate(500); 
    }
    setActiveAlert(type);
    setCountdown(5); // Iniciar cuenta regresiva de 5 segundos
  };

  const cancelAlert = () => {
    setCountdown(null);
    setActiveAlert(null);
  };

  // Pantalla Gigante: ¡Ayuda en Camino!
  if (helpOnTheWay) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#166534', '#14532d']} style={StyleSheet.absoluteFill} />
        <View style={styles.sendingContainer}>
          <Text style={{ fontSize: 80, marginBottom: 20 }}>🚒</Text>
          <Text style={[styles.overlayText, { color: '#4ade80', fontSize: 32, textAlign: 'center' }]}>¡AYUDA EN CAMINO!</Text>
          <Text style={[styles.subtitle, { color: '#fff', fontSize: 18, marginTop: 20 }]}>El Cuartel está respondiendo a tu llamado.</Text>
          <Text style={[styles.subtitle, { color: '#fff', fontSize: 18, marginBottom: 40 }]}>Por favor, mantén la calma y despeja la vía.</Text>
          
          <TouchableOpacity 
            style={{ paddingVertical: 15, paddingHorizontal: 40, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, borderWidth: 2, borderColor: '#4ade80' }}
            onPress={() => setHelpOnTheWay(false)}
          >
            <Text style={{ color: '#4ade80', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 }}>ENTENDIDO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Pantalla de envío (Cuando la cuenta llega a 0)
  if (isSending) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
        <View style={styles.sendingContainer}>
          <Text style={styles.overlayText}>ENVIANDO ALERTA...</Text>
          <Text style={styles.subtitle}>{statusMsg}</Text>
        </View>
      </View>
    );
  }

  // Pantalla de cuenta regresiva (Cancelación)
  if (countdown !== null) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#7f1d1d', '#000000']} style={StyleSheet.absoluteFill} />
        <View style={styles.countdownContainer}>
          <Text style={styles.cancelPrompt}>ALERTA INICIADA</Text>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.cancelDescription}>
            Se enviará al cuartel en {countdown} segundos.
          </Text>
          
          <TouchableOpacity style={styles.cancelButton} onPress={cancelAlert}>
            <Text style={styles.cancelButtonText}>CANCELAR ALERTA</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Pantalla principal (Botones)
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
      
      {/* Cabecera y Menú */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.hamburgerButton} 
          onPress={() => setMenuVisible(!menuVisible)}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', marginRight: 40 }}>
          <Text style={styles.title}>BVV Emergencias</Text>
          <Text style={styles.subtitle}>Bomberos Verónica</Text>
        </View>
      </View>

      {/* Dropdown Menu Overlay */}
      {menuVisible && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); }}>
            <Text style={styles.menuItemText}>🏠 Pantalla de Inicio (SOS)</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/notifications'); }}>
            <Text style={styles.menuItemText}>🔔 Centro de Avisos</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/cuenta'); }}>
            <Text style={styles.menuItemText}>💳 Pasarela de Pagos (Mi Cuenta)</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push('/profile'); }}>
            <Text style={styles.menuItemText}>👤 Mi Perfil</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.buttonsContainer}>
        {/* Fire Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onLongPress={() => handleAlert('fire')}
          delayLongPress={500}
          style={styles.buttonWrapper}
        >
          <LinearGradient colors={['#ef4444', '#991b1b']} style={styles.circleButton}>
            <View style={styles.innerGlass}>
              <Text style={styles.buttonText}>FUEGO</Text>
              <Text style={styles.helpText}>Mantener presionado</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Accident Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onLongPress={() => handleAlert('accident')}
          delayLongPress={500}
          style={styles.buttonWrapper}
        >
          <LinearGradient colors={['#f97316', '#c2410c']} style={styles.circleButton}>
            <View style={styles.innerGlass}>
              <Text style={styles.buttonText}>SINIESTRO</Text>
              <Text style={styles.helpText}>Mantener presionado</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 90,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 60 : 120,
  },
  buttonWrapper: {
    width: buttonSize,
    height: buttonSize,
    borderRadius: buttonSize / 2,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  circleButton: {
    width: '100%',
    height: '100%',
    borderRadius: buttonSize / 2,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerGlass: {
    width: '100%',
    height: '100%',
    borderRadius: buttonSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  
  // Estilos de la Cuenta Regresiva
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 20,
  },
  cancelPrompt: {
    color: '#f87171',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  countdownText: {
    color: '#fff',
    fontSize: 120,
    fontWeight: '900',
    marginVertical: 20,
  },
  cancelDescription: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 60,
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Estilos de Envío
  sendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  hamburgerButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hamburgerIcon: {
    color: '#fff',
    fontSize: 24,
  },
  dropdownMenu: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 80 : 120, // Just below header
    left: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 100, // Make sure it's above buttons
    paddingVertical: 10,
    width: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  menuItemText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  overlayText: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 10,
  },
});
