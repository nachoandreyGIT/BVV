import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export interface AlertSoundOption {
  id: string;
  nombre: string;
  subtitulo: string;
  icono: string;
  channelId: string;
  soundFile: string | null;
  requireAsset: boolean;
}

export const ALERT_SOUND_OPTIONS: AlertSoundOption[] = [
  {
    id: 'sirena_cuartel',
    nombre: 'Sirena de Cuartel Principal',
    subtitulo: 'Bitonal penetrante de autobomba (Urgencia máxima)',
    icono: '🚨',
    channelId: 'channel_sirena_cuartel',
    soundFile: 'sirena_cuartel.wav',
    requireAsset: true,
  },
  {
    id: 'alarma_tactica',
    nombre: 'Alarma Táctica de Evacuación',
    subtitulo: 'Tono pulsante rápido de alta frecuencia',
    icono: '⚠️',
    channelId: 'channel_alarma_tactica',
    soundFile: 'alarma_tactica.wav',
    requireAsset: true,
  },
  {
    id: 'corneta_emergencia',
    nombre: 'Corneta Pesada de Rescate',
    subtitulo: 'Doble bocinazo neumático pesado de intervención',
    icono: '📢',
    channelId: 'channel_corneta_emergencia',
    soundFile: 'corneta_emergencia.wav',
    requireAsset: true,
  },
  {
    id: 'sistema',
    nombre: 'Tono Predeterminado del Sistema',
    subtitulo: 'Sonido estándar del teléfono',
    icono: '📱',
    channelId: 'channel_default_sistema',
    soundFile: null,
    requireAsset: false,
  },
];

const PREFERRED_SOUND_KEY = 'preferred_alert_sound_id';

let currentPreviewNotificationId: string | null = null;

/**
 * Configura los canales de notificación en Android con sus respectivos sonidos nativos
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // 1. Canal Sirena Cuartel
    await Notifications.setNotificationChannelAsync('channel_sirena_cuartel', {
      name: '🚨 Sirena de Cuartel (Máxima Urgencia)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#FF0000',
      sound: 'sirena_cuartel.wav',
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true,
    });

    // 2. Canal Alarma Táctica
    await Notifications.setNotificationChannelAsync('channel_alarma_tactica', {
      name: '⚠️ Alarma Táctica de Evacuación',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300, 150, 300],
      lightColor: '#FF4400',
      sound: 'alarma_tactica.wav',
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true,
    });

    // 3. Canal Corneta Pesada
    await Notifications.setNotificationChannelAsync('channel_corneta_emergencia', {
      name: '📢 Corneta Pesada de Rescate',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 700, 200, 700],
      lightColor: '#FFAA00',
      sound: 'corneta_emergencia.wav',
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true,
    });

    // 4. Canal Estándar
    await Notifications.setNotificationChannelAsync('channel_default_sistema', {
      name: '📱 Notificaciones Estándar BVV',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
    });
  } catch (error) {
    console.warn('Error configurando canales de notificación en Android:', error);
  }
}

/**
 * Obtiene el ID del sonido seleccionado por el usuario (por defecto: 'sirena_cuartel')
 */
export async function getSelectedSoundId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(PREFERRED_SOUND_KEY);
    if (saved && ALERT_SOUND_OPTIONS.some(opt => opt.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.warn('Error leyendo sonido preferido:', e);
  }
  return 'sirena_cuartel';
}

/**
 * Guarda el sonido preferido del usuario
 */
export async function setSelectedSoundId(soundId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERRED_SOUND_KEY, soundId);
  } catch (e) {
    console.warn('Error guardando sonido preferido:', e);
  }
}

/**
 * Devuelve el canal de notificación que corresponde al sonido seleccionado
 */
export async function getSelectedChannelId(): Promise<string> {
  const soundId = await getSelectedSoundId();
  const found = ALERT_SOUND_OPTIONS.find(opt => opt.id === soundId);
  return found ? found.channelId : 'channel_sirena_cuartel';
}

/**
 * Reproduce una muestra del sonido seleccionado mediante el canal nativo de notificaciones
 */
export async function playSampleSound(soundId: string): Promise<void> {
  await stopSampleSound();

  const option = ALERT_SOUND_OPTIONS.find(opt => opt.id === soundId);
  if (!option || Platform.OS === 'web') return;

  try {
    await setupNotificationChannels();
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${option.icono} Prueba: ${option.nombre}`,
        body: option.subtitulo,
        sound: option.soundFile || true,
        data: { channelId: option.channelId, isPreview: true },
      },
      trigger: (Platform.OS === 'android' ? { channelId: option.channelId } : null) as any,
    });
    currentPreviewNotificationId = notifId;
  } catch (error) {
    console.warn('Error reproduciendo muestra de sonido:', error);
  }
}

/**
 * Detiene/descarta la notificación de prueba en curso
 */
export async function stopSampleSound(): Promise<void> {
  if (currentPreviewNotificationId && Platform.OS !== 'web') {
    try {
      await Notifications.dismissNotificationAsync(currentPreviewNotificationId);
    } catch {
      // Ignorar
    }
    currentPreviewNotificationId = null;
  }
}
