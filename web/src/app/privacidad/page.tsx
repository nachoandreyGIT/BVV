import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Bomberos Voluntarios de Verónica (BVV)',
  description: 'Política de Privacidad y Tratamiento de Datos de la aplicación móvil BVV Emergencias - Bomberos Voluntarios de Verónica.',
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-xl">
        <div className="border-b border-slate-800 pb-6 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-2">
            Sociedad de Bomberos Voluntarios de Verónica
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Política de Privacidad — BVV Emergencias
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Última actualización: 19 de octubre de 2026
          </p>
        </div>

        <div className="space-y-6 text-sm sm:text-base leading-relaxed text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              1. Identidad del Responsable
            </h2>
            <p>
              La aplicación móvil <strong>Bomberos BVV (BVV Emergencias)</strong> es operada para el servicio comunitario de asistencia y respuesta ante emergencias de los <strong>Bomberos Voluntarios de Verónica</strong> (Partido de Punta Indio, Provincia de Buenos Aires, República Argentina).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              2. Datos que Recopilamos
            </h2>
            <p className="mb-2">
              Para brindar asistencia rápida y eficaz ante siniestros, incendios y emergencias, la aplicación recopila únicamente la siguiente información proporcionada por el usuario:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Datos de identificación y contacto:</strong> Nombre completo, dirección de correo electrónico y número de teléfono celular.
              </li>
              <li>
                <strong>Datos logísticos de auxilio:</strong> Dirección del domicilio, descripción de referencia de la vivienda y datos opcionales del vehículo para facilitar la identificación por parte de la dotación de bomberos.
              </li>
              <li>
                <strong>Ubicación geográfica (GPS):</strong> Coordenadas de ubicación precisa (<code>ACCESS_FINE_LOCATION</code>) y aproximada (<code>ACCESS_COARSE_LOCATION</code>) <strong>únicamente en primer plano y en el momento exacto en que el usuario presiona el botón de AYUDA / SOS</strong> para reportar una emergencia. La aplicación no rastrea la ubicación en segundo plano.
              </li>
              <li>
                <strong>Identificador de notificaciones Push:</strong> Token técnico del dispositivo para el envío de avisos preventivos comunitarios y confirmaciones de despacho de unidades (&quot;Ayuda en camino&quot;).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              3. Finalidad del Uso de los Datos
            </h2>
            <p className="mb-2">
              Los datos recopilados se utilizan exclusivamente para:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Localizar y asistir de forma inmediata al vecino que reporta una emergencia al cuartel.</li>
              <li>Enviar alertas comunitarias de prevención civil e informar cuando una unidad está en camino.</li>
              <li>Gestionar de manera opcional el estado de aportes societarios o colaboraciones voluntarias mediante pasarelas de pago externas seguras (Mercado Pago), sin almacenar datos de tarjetas bancarias en nuestros servidores.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              4. Compartición y Seguridad de la Información
            </h2>
            <p>
              <strong>No vendemos, alquilamos ni comercializamos datos personales con terceros.</strong> La información de las alertas es accesible únicamente por el personal autorizado de guardia y administración del cuartel a través de servidores seguros con cifrado en tránsito (HTTPS/TLS).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              5. Retención y Eliminación de Datos (Derechos del Usuario)
            </h2>
            <p>
              Los datos se conservan mientras el usuario mantenga activa su cuenta en el sistema comunitario. El usuario puede solicitar en cualquier momento la actualización, rectificación o <strong>eliminación total y definitiva de su cuenta y sus datos personales</strong> enviando un correo electrónico a <a href="mailto:nachoandrey@gmail.com" className="text-sky-400 underline">nachoandrey@gmail.com</a> o acercándose a la administración del cuartel, procesándose la baja en un plazo máximo de 72 horas hábiles.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              6. Contacto
            </h2>
            <p>
              Ante cualquier consulta relacionada con esta Política de Privacidad o el tratamiento de sus datos, puede comunicarse por correo electrónico a: <a href="mailto:nachoandrey@gmail.com" className="text-sky-400 underline">nachoandrey@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
