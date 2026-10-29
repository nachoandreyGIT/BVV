import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

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

  const alarmAudioAttributes = {
    usage: Notifications.AndroidAudioUsage.NOTIFICATION,
    contentType: Notifications.AndroidAudioContentType.SONIFICATION,
  };

  try {
    // 1. Canal Sirena Cuartel
    await Notifications.setNotificationChannelAsync('channel_sirena_cuartel', {
      name: '🚨 Sirena de Cuartel (Máxima Urgencia)',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#FF0000',
      sound: 'sirena_cuartel.wav',
      audioAttributes: alarmAudioAttributes,
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
      audioAttributes: alarmAudioAttributes,
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
      audioAttributes: alarmAudioAttributes,
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

    // Si no está en local, intentar recuperarlo de Supabase para este socio
    const socioId = await AsyncStorage.getItem('socioId');
    if (socioId) {
      const { data } = await supabase
        .from('configuraciones')
        .select('valor')
        .eq('clave', `sound_socio_${socioId}`)
        .maybeSingle();
      if (data?.valor && ALERT_SOUND_OPTIONS.some(opt => opt.id === data.valor)) {
        await AsyncStorage.setItem(PREFERRED_SOUND_KEY, data.valor);
        return data.valor;
      }
    }
  } catch (e) {
    console.warn('Error leyendo sonido preferido:', e);
  }
  return 'sirena_cuartel';
}

/**
 * Guarda el sonido preferido del usuario tanto localmente como en Supabase
 * para que las notificaciones Push remotas también usen el canal correcto.
 */
export async function setSelectedSoundId(soundId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERRED_SOUND_KEY, soundId);
    const socioId = await AsyncStorage.getItem('socioId');
    if (socioId) {
      await supabase
        .from('configuraciones')
        .upsert({ clave: `sound_socio_${socioId}`, valor: soundId });
    }
  } catch (e) {
    console.warn('Error guardando sonido preferido:', e);
  }
}

/**
 * Devuelve la opción de sonido completa seleccionada por el usuario
 */
export async function getSelectedSoundOption(): Promise<AlertSoundOption> {
  const soundId = await getSelectedSoundId();
  return ALERT_SOUND_OPTIONS.find(opt => opt.id === soundId) || ALERT_SOUND_OPTIONS[0];
}

/**
 * Devuelve el canal de notificación que corresponde al sonido seleccionado
 */
export async function getSelectedChannelId(): Promise<string> {
  const option = await getSelectedSoundOption();
  return option.channelId;
}

/**
 * Dispara una notificación local de emergencia usando el canal y archivo de sonido elegidos por el usuario
 */
export async function triggerLocalAlertNotification(
  title: string,
  body: string,
  extraData: Record<string, any> = {}
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await setupNotificationChannels();
    const option = await getSelectedSoundOption();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: option.soundFile || 'default',
        data: { channelId: option.channelId, ...extraData },
      },
      trigger: (Platform.OS === 'android' ? { channelId: option.channelId } : null) as any,
    });
  } catch (error) {
    console.warn('Error lanzando notificación local con sonido:', error);
  }
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
        sound: option.soundFile || 'default',
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
