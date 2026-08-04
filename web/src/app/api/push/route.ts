import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Recibimos el arreglo de mensajes (tokens, title, body, etc.)
    const messages = await req.json();

    // Hacemos el llamado a Expo desde el SERVIDOR (Node.js) para evitar el bloqueo CORS del navegador
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
