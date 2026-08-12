import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Recibimos el arreglo de mensajes (tokens, title, body, etc.)
    const messages = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ success: true, message: "No messages to send" });
    }

    // Dividir los mensajes en bloques de máximo 100 (límite estricto de Expo)
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      chunks.push(messages.slice(i, i + CHUNK_SIZE));
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
