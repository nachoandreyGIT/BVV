import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { supabase } from '@/lib/supabase';

// Token genérico de Sandbox (Prueba)
const client = new MercadoPagoConfig({ accessToken: 'TEST-1871239845-062512-4217117db34f37bc449ba3f9cb90214c-1871239845', options: { timeout: 5000 } });

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');

    if (topic === 'payment' && id) {
      // Buscar información del pago
      const payment = new Payment(client);
      const paymentInfo = await payment.get({ id });

      if (paymentInfo.status === 'approved') {
        const preferenceId = paymentInfo.order?.id || ''; // En un flujo real usaríamos un ID cruzado, aquí simplificamos buscando por external_reference o similar.
        
        // Dado que la integración MP en Sandbox a veces oculta metadatos si no se configura complejo, 
        // usaremos el email o metadata. Como es prototipo, asumimos que nos mandan el webhook
        // Para simplificar la demo, aprobaremos todos los pagos pendientes de la preferencia.
        // Pero MercadoPago no siempre manda el preference_id en el payload de pago directamente en sandbox simple.
        
        // Hack prototipo: Actualizar todo pago pendiente que coincida con el monto exacto (solo demostrativo).
        // En producción se usa `external_reference` o el ID del pago atado a la preferencia.
        
        // Obtenemos los metadatos reales si MP los mandó
        if (paymentInfo.metadata && paymentInfo.metadata.socio_id) {
          await supabase
            .from('pagos')
            .update({ estado: 'aprobado', mp_payment_id: String(paymentInfo.id) })
            .eq('socio_id', paymentInfo.metadata.socio_id)
            .eq('estado', 'pendiente');
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}
