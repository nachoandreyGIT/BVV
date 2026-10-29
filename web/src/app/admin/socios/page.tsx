'use client';
import { useState, useEffect } from 'react';
import { Search, HeartHandshake, DollarSign, Settings, Ban, Trash2, CheckCircle2, ShieldAlert, KeyRound, BellRing } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SociosManagement() {
  const [socios, setSocios] = useState<any[]>([]);
  const [cuota, setCuota] = useState(1500);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Traer configuracion cuota
    const { data: config } = await supabase.from('configuraciones').select('valor').eq('clave', 'cuota_mensual').single();
    if (config) setCuota(Number(config.valor));

    // Traer socios
    const { data: sociosData } = await supabase.from('socios').select('*').order('created_at', { ascending: false });
    
    // Traer todos los pagos
    const { data: pagosData } = await supabase.from('pagos').select('*').in('estado', ['aprobado', 'perdonado']);

    if (sociosData) {
      // Calcular deuda para cada socio
      const hoy = new Date();
      const sociosConDeuda = sociosData.map(socio => {
        const registro = new Date(socio.created_at);
        const diffAños = hoy.getFullYear() - registro.getFullYear();
        const diffMeses = hoy.getMonth() - registro.getMonth();
        let totalMesesHistoricos = diffAños * 12 + diffMeses + 1;

        const pagosSocio = pagosData?.filter(p => p.socio_id === socio.id && p.tipo === 'cuota') || [];
        const mesesPagados = pagosSocio.length;
        
        let deudaMeses = totalMesesHistoricos - mesesPagados;
        if (deudaMeses < 0) deudaMeses = 0;

        return {
          ...socio,
          mesesDeuda: deudaMeses,
          montoDeuda: deudaMeses * (config ? Number(config.valor) : 1500)
        };
      });

      setSocios(sociosConDeuda);
    }
    setLoading(false);
  };

  const handlePerdonarDeuda = async (socio: any) => {
    if (socio.mesesDeuda === 0) {
      alert('El socio ya está al día.');
      return;
    }
    
    const confirmacion = window.confirm(`¿Seguro que deseas perdonar ${socio.mesesDeuda} meses de deuda a ${socio.nombre}? Esta acción es irreversible e incrementará el contador de meses pagados.`);
    if (!confirmacion) return;

    // Crear un registro de pago "perdonado" por cada mes
    const mesesFicticios = Array.from({length: socio.mesesDeuda}).map((_, i) => `Perdon-${Date.now()}-${i}`);
    
    const pagosToInsert = mesesFicticios.map(mes => ({
      socio_id: socio.id,
      monto: cuota,
      tipo: 'cuota',
      mes_cobertura: mes,
      estado: 'perdonado'
    }));

    await supabase.from('pagos').insert(pagosToInsert);
    alert('Deuda perdonada exitosamente.');
    fetchData();
  };

  const handleChangeCuota = async () => {
    const nuevoValor = window.prompt('Ingrese el nuevo valor de la cuota mensual en pesos:', cuota.toString());
    if (nuevoValor && !isNaN(Number(nuevoValor))) {
      await supabase.from('configuraciones').update({ valor: nuevoValor }).eq('clave', 'cuota_mensual');
      alert('Valor de cuota actualizada para todos los socios.');
      fetchData();
    }
  };

  const handleCambiarEstado = async (id: string, nuevoEstado: string, nombre: string) => {
    if (window.confirm(`¿Seguro que deseas cambiar el estado de ${nombre} a ${nuevoEstado.toUpperCase()}?`)) {
      await supabase.from('socios').update({ estado: nuevoEstado }).eq('id', id);
      fetchData();
    }
  };

  const handleResetPassword = async (socio: any) => {
    const nuevaClave = window.prompt(
      `Cambiar contraseña de ${socio.nombre} (Tel: ${socio.telefono}).\nIngrese la nueva contraseña:`,
      '123456'
    );
    if (!nuevaClave || !nuevaClave.trim()) return;

    const { error } = await supabase
      .from('socios')
      .update({ password: nuevaClave.trim() })
      .eq('id', socio.id);

    if (error) {
      alert('Error al actualizar la contraseña: ' + error.message);
      return;
    }
    alert(`Contraseña de ${socio.nombre} actualizada correctamente a: ${nuevaClave.trim()}`);
    fetchData();
  };

  const handleTestPush = async (socio: any) => {
    if (!socio.push_token) {
      alert(`El socio ${socio.nombre} aún no tiene un token Push registrado en su celular (debe abrir la app y aceptar el permiso de notificaciones).`);
      return;
    }

    const opcion = window.prompt(
      `Enviar notificación de prueba SOLO a ${socio.nombre} (${socio.telefono}).\n\nElige qué sonido quieres probar:\n1 = 🚨 Sirena de Cuartel Principal\n2 = ⚠️ Alarma Táctica de Evacuación\n3 = 📢 Corneta Pesada de Rescate\n4 = 📱 Sonido Predeterminado del Teléfono`,
      '1'
    );
    if (!opcion) return;

    const soundMap: Record<string, { soundId: string; channelId: string; label: string }> = {
      '1': { soundId: 'sirena_cuartel', channelId: 'channel_sirena_cuartel', label: 'Sirena de Cuartel' },
      '2': { soundId: 'alarma_tactica', channelId: 'channel_alarma_tactica', label: 'Alarma Táctica' },
      '3': { soundId: 'corneta_emergencia', channelId: 'channel_corneta_emergencia', label: 'Corneta Pesada' },
      '4': { soundId: 'sistema', channelId: 'channel_default_sistema', label: 'Sonido del Sistema' },
    };

    const chosen = soundMap[opcion.trim()] || soundMap['1'];

    try {
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            to: socio.push_token,
            title: `🚨 Prueba BVV: ${chosen.label}`,
            body: `Hola ${socio.nombre}, esta es una prueba individual de notificación (${chosen.label}).`,
            soundId: chosen.soundId,
            channelId: chosen.channelId,
            priority: 'high',
            data: { url: '/notifications' },
          },
        ]),
      });

      if (res.ok) {
        alert(`✅ Notificación de prueba (${chosen.label}) enviada al celular de ${socio.nombre}.`);
      } else {
        alert('❌ Hubo un error al enviar la notificación de prueba.');
      }
    } catch (e) {
      console.error('Error enviando push de prueba:', e);
      alert('❌ Error de conexión al enviar la notificación de prueba.');
    }
  };

  const handleEliminarSocio = async (id: string, nombre: string) => {
    if (window.confirm(`¡ATENCIÓN! ¿Estás absolutamente seguro de ELIMINAR a ${nombre}? Esta acción borrará todo su historial y no se puede deshacer.`)) {
      // Primero eliminar registros relacionados para evitar error de Foreign Key
      await supabase.from('alertas').delete().eq('socio_id', id);
      await supabase.from('pagos').delete().eq('socio_id', id);
      // Finalmente eliminar al socio
      await supabase.from('socios').delete().eq('id', id);
      fetchData();
    }
  };

  const handleToggleBombero = async (id: string, currentIsBombero: boolean, nombre: string) => {
    const accion = currentIsBombero ? 'quitar el rol de BOMBERO a' : 'promover a BOMBERO a';
    if (window.confirm(`¿Seguro que deseas ${accion} ${nombre}?`)) {
      await supabase.from('socios').update({ is_bombero: !currentIsBombero }).eq('id', id);
      fetchData();
    }
  };

  if (loading) return <div className="text-white p-8">Calculando deudas históricas...</div>;

  const sociosFiltrados = socios.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (s.nombre || '').toLowerCase().includes(q) ||
      (s.telefono || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Estado de Cuenta de Socios</h1>
        <div className="flex gap-3">
          <button onClick={handleChangeCuota} className="w-full sm:w-auto justify-center bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors border border-slate-700 font-medium">
            <Settings size={18} /> Ajustar Cuota ($ {cuota})
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
        <div className="relative w-full md:w-1/2 lg:w-1/3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, teléfono o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* VISTA MÓVIL EN TARJETAS (< md) */}
      <div className="md:hidden space-y-4">
        {sociosFiltrados.map((socio) => (
          <div key={socio.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-white text-base flex items-center gap-2 flex-wrap">
                  <span>{socio.nombre}</span>
                  {socio.is_bombero && (
                    <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                      <ShieldAlert size={10} /> BOMBERO
                    </span>
                  )}
                </div>
                <div className="text-slate-300 text-sm mt-0.5 font-medium">{socio.telefono}</div>
                {socio.email && <div className="text-slate-400 text-xs break-all">{socio.email}</div>}
                <div className="text-slate-500 text-xs mt-1">
                  Alta: {new Date(socio.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded text-xs font-bold ${
                socio.estado === 'activo' ? 'bg-green-500/20 text-green-400' : 
                socio.estado === 'suspendido' ? 'bg-orange-500/20 text-orange-400' : 
                'bg-red-500/20 text-red-400'
              }`}>
                {(socio.estado || 'activo').toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 rounded-lg px-3 py-2">
              <div>
                {socio.mesesDeuda === 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                    Al día
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    Debe {socio.mesesDeuda} meses
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400">
                Deuda: <strong className="text-white font-bold">${socio.montoDeuda}</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
              <button
                onClick={() => handleTestPush(socio)}
                className={`flex-1 min-w-[125px] justify-center px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border text-xs font-bold ${
                  socio.push_token
                    ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border-purple-600/30'
                    : 'bg-slate-800/40 text-slate-600 border-slate-700/40 cursor-not-allowed'
                }`}
              >
                <BellRing size={14} /> Probar Push
              </button>
              <button
                onClick={() => handleResetPassword(socio)}
                className="flex-1 min-w-[100px] justify-center bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border border-blue-600/30 text-xs font-bold"
              >
                <KeyRound size={14} /> Clave
              </button>
              {socio.mesesDeuda > 0 && (
                <button 
                  onClick={() => handlePerdonarDeuda(socio)}
                  className="flex-1 min-w-[110px] justify-center bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border border-yellow-600/30 text-xs font-bold"
                >
                  <HeartHandshake size={14} /> Perdonar
                </button>
              )}
              {socio.estado !== 'suspendido' && (
                <button
                  onClick={() => handleCambiarEstado(socio.id, 'suspendido', socio.nombre)}
                  className="flex-1 min-w-[110px] justify-center bg-orange-600/20 text-orange-500 hover:bg-orange-600/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border border-orange-600/30 text-xs font-bold"
                >
                  <Ban size={14} /> Suspender
                </button>
              )}
              {socio.estado !== 'baja' && (
                <button
                  onClick={() => handleCambiarEstado(socio.id, 'baja', socio.nombre)}
                  className="flex-1 min-w-[90px] justify-center bg-red-600/20 text-red-500 hover:bg-red-600/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border border-red-600/30 text-xs font-bold"
                >
                  <Trash2 size={14} /> Baja
                </button>
              )}
              {socio.estado !== 'activo' && (
                <button
                  onClick={() => handleCambiarEstado(socio.id, 'activo', socio.nombre)}
                  className="flex-1 min-w-[110px] justify-center bg-green-600/20 text-green-500 hover:bg-green-600/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border border-green-600/30 text-xs font-bold"
                >
                  <CheckCircle2 size={14} /> Reactivar
                </button>
              )}
              <button 
                onClick={() => handleToggleBombero(socio.id, socio.is_bombero, socio.nombre)} 
                className={`flex-1 min-w-[135px] justify-center px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border text-xs font-bold ${
                  socio.is_bombero
                    ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border-slate-600'
                    : 'bg-red-600/20 text-red-400 hover:bg-red-600/40 border-red-600/30'
                }`}
              >
                <ShieldAlert size={14} /> {socio.is_bombero ? 'Quitar Bombero' : 'Hacer Bombero'}
              </button>
              <button
                onClick={() => handleEliminarSocio(socio.id, socio.nombre)}
                className="bg-slate-800/80 text-slate-400 hover:text-red-500 px-3 py-2 rounded-lg border border-slate-700 transition-colors flex items-center justify-center"
                title="Eliminar Registro Físico"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {sociosFiltrados.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            No se encontraron socios.
          </div>
        )}
      </div>

      {/* VISTA ESCRITORIO EN TABLA (>= md) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Socio</th>
              <th className="px-6 py-4 font-semibold">Registro</th>
              <th className="px-6 py-4 font-semibold">Estado App</th>
              <th className="px-6 py-4 font-semibold">Meses Deuda</th>
              <th className="px-6 py-4 font-semibold">Monto Deuda</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sociosFiltrados.map((socio) => (
              <tr key={socio.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-white flex items-center gap-2">
                    {socio.nombre}
                    {socio.is_bombero && (
                      <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                        <ShieldAlert size={10} /> BOMBERO
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-xs">{socio.telefono}</div>
                  {socio.email && <div className="text-slate-500 text-xs">{socio.email}</div>}
                </td>
                <td className="px-6 py-4 text-slate-300">{new Date(socio.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    socio.estado === 'activo' ? 'bg-green-500/20 text-green-400' : 
                    socio.estado === 'suspendido' ? 'bg-orange-500/20 text-orange-400' : 
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {(socio.estado || 'activo').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {socio.mesesDeuda === 0 ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      Al día
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                      Debe {socio.mesesDeuda} meses
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-bold text-white">
                  ${socio.montoDeuda}
                </td>
                <td className="px-6 py-4 flex justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => handleTestPush(socio)}
                    className={`px-2 py-1 rounded transition-colors flex items-center gap-1 border text-xs font-bold ${
                      socio.push_token
                        ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border-purple-600/30'
                        : 'bg-slate-800/40 text-slate-600 border-slate-700/40 cursor-not-allowed'
                    }`}
                    title={socio.push_token ? 'Enviar notificación de prueba solo a este celular' : 'Sin token Push registrado aún'}
                  >
                    <BellRing size={14} /> Probar Push
                  </button>
                  <button
                    onClick={() => handleResetPassword(socio)}
                    className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-blue-600/30 text-xs font-bold"
                    title="Cambiar o blanquear contraseña del socio"
                  >
                    <KeyRound size={14} /> Clave
                  </button>
                  {socio.mesesDeuda > 0 && (
                    <button 
                      onClick={() => handlePerdonarDeuda(socio)}
                      className="bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/40 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-yellow-600/30 text-xs font-bold" 
                      title="Perdonar Deuda"
                    >
                      <HeartHandshake size={14} /> Perdonar
                    </button>
                  )}
                  {socio.estado !== 'suspendido' && (
                    <button onClick={() => handleCambiarEstado(socio.id, 'suspendido', socio.nombre)} className="bg-orange-600/20 text-orange-500 hover:bg-orange-600/40 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-orange-600/30 text-xs font-bold" title="Suspender">
                      <Ban size={14} /> Suspender
                    </button>
                  )}
                  {socio.estado !== 'baja' && (
                    <button onClick={() => handleCambiarEstado(socio.id, 'baja', socio.nombre)} className="bg-red-600/20 text-red-500 hover:bg-red-600/40 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-red-600/30 text-xs font-bold" title="Dar de Baja">
                      <Trash2 size={14} /> Baja
                    </button>
                  )}
                  {socio.estado !== 'activo' && (
                    <button onClick={() => handleCambiarEstado(socio.id, 'activo', socio.nombre)} className="bg-green-600/20 text-green-500 hover:bg-green-600/40 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-green-600/30 text-xs font-bold" title="Reactivar">
                      <CheckCircle2 size={14} /> Reactivar
                    </button>
                  )}
                  <button 
                    onClick={() => handleToggleBombero(socio.id, socio.is_bombero, socio.nombre)} 
                    className={`px-2 py-1 rounded transition-colors flex items-center gap-1 border text-xs font-bold ${socio.is_bombero ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border-slate-600' : 'bg-red-600/20 text-red-400 hover:bg-red-600/40 border-red-600/30'}`}
                    title={socio.is_bombero ? "Quitar rol de Bombero" : "Hacer Bombero"}
                  >
                    <ShieldAlert size={14} /> {socio.is_bombero ? 'Quitar Bombero' : 'Hacer Bombero'}
                  </button>
                  <button onClick={() => handleEliminarSocio(socio.id, socio.nombre)} className="text-slate-500 hover:text-red-500 px-2 py-1 transition-colors" title="Eliminar Registro Físico">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {socios.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">No hay socios registrados</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
