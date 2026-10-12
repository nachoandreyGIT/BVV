import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Vibration, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router, Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    } as any),
  });
} catch (e) {
  console.log("Error setting notification handler:", e);
}

const { width } = Dimensions.get('window');
// Botón central de emergencia de tamaño óptimo (58% del ancho, máx 220px)
const buttonSize = Math.min(width * 0.58, 220); 

export default function PanicScreen() {
  const [activeAlert, setActiveAlert] = useState<'ayuda' | 'fire' | 'accident' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Obteniendo ubicación GPS...');
  const [helpOnTheWay, setHelpOnTheWay] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Verificación de Autenticación Segura (redirección)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const id = await AsyncStorage.getItem('socioId');
        if (!id) {
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Error al revisar auth:', e);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Escuchar actualizaciones de estado de la alerta en tiempo real
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Pedir permisos de notificaciones locales y push al iniciar
    const setupPushNotifications = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          return;
        }

        if (Platform.OS !== 'web') {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? '87c719ea-64c0-488e-9236-15723183e7e7';
          try {
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            const pushToken = tokenData.data;
            const socioId = await AsyncStorage.getItem('socioId');
            if (socioId) {
              await supabase.from('socios').update({ push_token: pushToken }).eq('id', socioId);
            }
          } catch (tokenError) {
            console.log('Error obteniendo Push Token (Falta google-services.json si es Android):', tokenError);
          }
        }
      } catch (e) {
        console.log('Error pidiendo permisos de notif:', e);
      }
    };
    setupPushNotifications();

    // 2. Suscribirse a las alertas
    let channel: any;
    const setupRealtime = async () => {
      const socioId = await AsyncStorage.getItem('socioId');
      if (socioId) {
        // Verificar si el socio actual es bombero
        const { data: socioData } = await supabase.from('socios').select('is_bombero').eq('id', socioId).maybeSingle();
        const isBombero = socioData?.is_bombero === true || socioData?.is_bombero === 'true' || socioData?.is_bombero === 1;

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
                    title: `🚨 NUEVA ALERTA: ${payload.new.tipo === 'fire' ? 'FUEGO' : payload.new.tipo === 'accident' ? 'SINIESTRO' : 'AYUDA'}`,
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
  }, [isAuthenticated]);

  // Manejo de la cuenta regresiva
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
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
        const { data: socioData } = await supabase.from('socios').select('estado').eq('id', socioId).maybeSingle();
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
      
      // 🚀 ENVIAR NOTIFICACIÓN PUSH A BOMBEROS
      try {
        const { data: bomberos } = await supabase
          .from('socios')
          .select('push_token')
          .eq('is_bombero', true)
          .not('push_token', 'is', null)
          .neq('push_token', '');

        if (bomberos && bomberos.length > 0) {
          const tokens = bomberos.map(b => b.push_token);
          const title = activeAlert === 'fire' 
            ? '🚨 NUEVO INCENDIO' 
            : activeAlert === 'accident' 
              ? '🚨 NUEVO SINIESTRO VIAL' 
              : '🚨 SOLICITUD DE AYUDA';
          const messages = tokens.map(token => ({
            to: token,
            sound: 'default',
            title: title,
            body: `Un vecino ha activado una emergencia en las coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}. ¡Abra la consola para más detalles!`,
            priority: 'high',
          }));

          await fetch('https://bomberos-veronica.vercel.app/api/push', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
          });
        }
      } catch (pushError) {
        console.error('Error enviando push a bomberos:', pushError);
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

  const handleAlert = (type: 'ayuda' | 'fire' | 'accident' = 'ayuda') => {
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

  if (isAuthenticated === false) {
    return <Redirect href="/register" />;
  }

  if (isAuthenticated === null) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0f172a', '#000000']} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

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
          <Text style={styles.cancelPrompt}>PEDIDO DE AYUDA INICIADO</Text>
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

      <View style={styles.mainContent}>
        {/* Tarjeta Informativa de Emergencia */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionBadge}>CENTRAL DE EMERGENCIAS</Text>
          <Text style={styles.instructionText}>
            En caso de urgencia, mantén presionado el botón. Tu llamado y ubicación GPS llegarán en tiempo real al cuartel.
          </Text>
        </View>

        {/* Halo Pulsante y Botón Único de Ayuda */}
        <View style={styles.buttonOuterPulse}>
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handleAlert('ayuda')}
            delayLongPress={500}
            style={styles.buttonWrapper}
          >
            <LinearGradient colors={['#ef4444', '#dc2626', '#991b1b']} style={styles.circleButton}>
              <View style={styles.innerGlass}>
                <Text style={styles.buttonIcon}>🚨</Text>
                <Text style={styles.buttonText}>AYUDA</Text>
                <Text style={styles.helpText}>Mantener presionado</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          🛡️ Servicio público de auxilio gratuito 24 hs • Verónica
        </Text>
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
  mainContent: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 60 : 100,
  },
  instructionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    marginBottom: 40,
    maxWidth: 380,
    width: '100%',
  },
  instructionBadge: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  instructionText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  buttonOuterPulse: {
    width: buttonSize + 36,
    height: buttonSize + 36,
    borderRadius: (buttonSize + 36) / 2,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonWrapper: {
    width: buttonSize,
    height: buttonSize,
    borderRadius: buttonSize / 2,
    elevation: 25,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
  },
  circleButton: {
    width: '100%',
    height: '100%',
    borderRadius: buttonSize / 2,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerGlass: {
    width: '100%',
    height: '100%',
    borderRadius: buttonSize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 50,
    marginBottom: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerNote: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 40,
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
