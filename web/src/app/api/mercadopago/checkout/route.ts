import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { supabase } from '@/lib/supabase';

// Token genérico de Sandbox (Prueba)
const client = new MercadoPagoConfig({ accessToken: 'TEST-1871239845-062512-4217117db34f37bc449ba3f9cb90214c-1871239845', options: { timeout: 5000 } });

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { socio_id, monto, tipo, meses } = body; 

    // Simulación de preferencia de pago (Bypass de validación de Token en Prototipo)
    const mockPrefId = 'TEST-' + Date.now();
    const mockSandboxUrl = `https://www.mercadopago.com.ar`;
    const result = { id: mockPrefId, sandbox_init_point: mockSandboxUrl };

    if (tipo === 'cuota' && meses && meses.length > 0) {
      const cuotaPorMes = Number(monto) / meses.length;
      const pagosToInsert = meses.map((mes: string) => ({
        socio_id,
        monto: cuotaPorMes,
        tipo: 'cuota',
        mes_cobertura: mes,
        estado: 'pendiente',
        mp_preference_id: result.id
      }));
      await supabase.from('pagos').insert(pagosToInsert);
    } else {
      await supabase.from('pagos').insert({
        socio_id,
        monto: Number(monto),
        tipo: 'donacion',
        estado: 'pendiente',
        mp_preference_id: result.id
      });
    }

    return NextResponse.json({ url: result.sandbox_init_point }, {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error creando preferencia MP:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
