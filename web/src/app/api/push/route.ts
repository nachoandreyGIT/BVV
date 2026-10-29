import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const SOUND_CHANNEL_MAP: Record<string, { channelId: string; sound: string }> = {
  sirena_cuartel: {
    channelId: 'channel_sirena_cuartel',
    sound: 'sirena_cuartel.wav',
  },
  alarma_tactica: {
    channelId: 'channel_alarma_tactica',
    sound: 'alarma_tactica.wav',
  },
  corneta_emergencia: {
    channelId: 'channel_corneta_emergencia',
    sound: 'corneta_emergencia.wav',
  },
  sistema: {
    channelId: 'channel_default_sistema',
    sound: 'default',
  },
};

export async function POST(req: Request) {
  try {
    // Recibimos el arreglo de mensajes (tokens, title, body, etc.)
    const messages = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ success: true, message: "No messages to send" });
    }

    // Obtener preferencias de sonido por token desde Supabase (si existen)
    const tokenSoundMap: Record<string, { channelId: string; sound: string }> = {};
    try {
      const [{ data: socios }, { data: configs }] = await Promise.all([
        supabase.from('socios').select('id, push_token').not('push_token', 'is', null),
        supabase.from('configuraciones').select('clave, valor').like('clave', 'sound_socio_%'),
      ]);

      const socioSoundById: Record<string, string> = {};
      if (configs) {
        for (const c of configs) {
          const socioId = c.clave.replace('sound_socio_', '');
          socioSoundById[socioId] = c.valor;
        }
      }

      if (socios) {
        for (const s of socios) {
          if (s.push_token) {
            const prefId = socioSoundById[String(s.id)] || 'sirena_cuartel';
            tokenSoundMap[s.push_token] = SOUND_CHANNEL_MAP[prefId] || SOUND_CHANNEL_MAP.sirena_cuartel;
          }
        }
      }
    } catch (prefErr) {
      console.warn('No se pudieron cargar preferencias de sonido, usando sirena_cuartel por defecto:', prefErr);
    }

    // Asignar channelId y sound de Android a cada mensaje
    const enrichedMessages = messages.map((msg: any) => {
      const resolved = tokenSoundMap[msg.to] || SOUND_CHANNEL_MAP[msg.soundId] || SOUND_CHANNEL_MAP.sirena_cuartel;
      return {
        ...msg,
        channelId: msg.channelId || resolved.channelId,
        sound: resolved.sound,
        priority: 'high',
      };
    });

    // Dividir los mensajes en bloques de máximo 100 (límite estricto de Expo)
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < enrichedMessages.length; i += CHUNK_SIZE) {
      chunks.push(enrichedMessages.slice(i, i + CHUNK_SIZE));
    }

    const allResults = [];

    // Enviar cada bloque a Expo de manera secuencial
    for (const chunk of chunks) {
      // Hacemos el llamado a Expo desde el SERVIDOR (Node.js) para evitar el bloqueo CORS del navegador
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      allResults.push(result);
    }

    return NextResponse.json({ success: true, results: allResults });
  } catch (error: any) {
    console.error("Error en API push:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
