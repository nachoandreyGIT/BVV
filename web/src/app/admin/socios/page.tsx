'use client';
import { useState, useEffect } from 'react';
import { Search, HeartHandshake, DollarSign, Settings, Ban, Trash2, CheckCircle2, ShieldAlert, KeyRound, BellRing, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SociosManagement() {
  const [socios, setSocios] = useState<any[]>([]);
  const [cuota, setCuota] = useState(1500);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMembresia, setFilterMembresia] = useState<'todos' | 'aportantes' | 'gratuitos' | 'deuda'>('todos');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Traer configuracion cuota
    const { data: config } = await supabase.from('configuraciones').select('valor').eq('clave', 'cuota_mensual').single();
    const cuotaActual = config ? Number(config.valor) : 1500;
    if (config) setCuota(cuotaActual);

    // Traer socios
    const { data: sociosData } = await supabase.from('socios').select('*').order('created_at', { ascending: false });
    
    // Traer todos los pagos
    const { data: pagosData } = await supabase.from('pagos').select('*').in('estado', ['aprobado', 'perdonado']);

    if (sociosData) {
      // Calcular deuda ÚNICAMENTE para socios adheridos voluntariamente a cuota mensual
      const hoy = new Date();
      const sociosConDeuda = sociosData.map(socio => {
        const esAportante = Boolean(socio.es_socio_aportante);
        let deudaMeses = 0;

        if (esAportante) {
          const fechaBase = socio.fecha_adhesion_socio
            ? new Date(socio.fecha_adhesion_socio)
            : new Date(socio.created_at);
          const diffAños = hoy.getFullYear() - fechaBase.getFullYear();
          const diffMeses = hoy.getMonth() - fechaBase.getMonth();
          const totalMesesHistoricos = Math.max(1, diffAños * 12 + diffMeses + 1);

          const pagosSocio = pagosData?.filter(p => p.socio_id === socio.id && p.tipo === 'cuota') || [];
          const mesesPagados = pagosSocio.length;

          deudaMeses = Math.max(0, totalMesesHistoricos - mesesPagados);
        }

        return {
          ...socio,
          esAportante,
          mesesDeuda: deudaMeses,
          montoDeuda: deudaMeses * cuotaActual
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

  const handleToggleAportante = async (socio: any) => {
    const actualmenteAportante = Boolean(socio.esAportante);
    const mensaje = actualmenteAportante
      ? `¿Deseas quitar la cuota mensual a ${socio.nombre}? Pasará a figurar como Vecino (Gratuito) y dejará de acumular deuda.`
      : `¿Deseas marcar a ${socio.nombre} como SOCIO APORTANTE con cuota mensual a partir de hoy?`;

    if (!window.confirm(mensaje)) return;

    const { error } = await supabase
      .from('socios')
      .update({
        es_socio_aportante: !actualmenteAportante,
        fecha_adhesion_socio: !actualmenteAportante ? new Date().toISOString() : null,
      })
      .eq('id', socio.id);

    if (error) {
      alert('Error al actualizar membresía (verifica que existan las columnas es_socio_aportante y fecha_adhesion_socio en Supabase): ' + error.message);
      return;
    }

    fetchData();
  };

  if (loading) return <div className="text-white p-8">Cargando padrón de vecinos y socios...</div>;

  const sociosFiltrados = socios.filter((s) => {
    if (filterMembresia === 'aportantes' && !s.esAportante) return false;
    if (filterMembresia === 'gratuitos' && s.esAportante) return false;
    if (filterMembresia === 'deuda' && (!s.esAportante || s.mesesDeuda === 0)) return false;

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
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Padrón de Vecinos y Socios</h1>
        <div className="flex gap-3">
          <button onClick={handleChangeCuota} className="w-full sm:w-auto justify-center bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors border border-slate-700 font-medium">
            <Settings size={18} /> Ajustar Cuota ($ {cuota})
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative w-full lg:w-1/3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, teléfono o email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'todos', label: `Todos (${socios.length})` },
            { key: 'aportantes', label: `Socios Aportantes (${socios.filter(s => s.esAportante).length})` },
            { key: 'gratuitos', label: `Vecinos Gratuitos (${socios.filter(s => !s.esAportante).length})` },
            { key: 'deuda', label: `Con Deuda (${socios.filter(s => s.esAportante && s.mesesDeuda > 0).length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterMembresia(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                filterMembresia === tab.key
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
                  {socio.esAportante && (
                    <span className="bg-sky-500/20 text-sky-300 text-[10px] px-2 py-0.5 rounded border border-sky-500/30">
                      SOCIO APORTANTE
                    </span>
                  )}
                </div>
                <div className="text-slate-300 text-sm mt-0.5 font-medium">{socio.telefono}</div>
                {socio.email && <div className="text-slate-400 text-xs break-all">{socio.email}</div>}
                <div className="text-slate-500 text-xs mt-1">
                  Alta app: {new Date(socio.created_at).toLocaleDateString()}
                  {socio.esAportante && socio.fecha_adhesion_socio && (
                    <> • Socio desde: {new Date(socio.fecha_adhesion_socio).toLocaleDateString()}</>
                  )}
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
                {!socio.esAportante ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Vecino (Gratuito)
                  </span>
                ) : socio.mesesDeuda === 0 ? (
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
                {socio.esAportante ? (
                  <>Deuda: <strong className="text-white font-bold">${socio.montoDeuda}</strong></>
                ) : (
                  <span className="text-slate-500 text-xs">Sin cuota mensual</span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
              <button
                onClick={() => handleToggleAportante(socio)}
                className={`flex-1 min-w-[140px] justify-center px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 border text-xs font-bold ${
                  socio.esAportante
                    ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border-slate-600'
                    : 'bg-sky-600/20 text-sky-400 hover:bg-sky-600/40 border-sky-600/30'
                }`}
              >
                <UserCheck size={14} /> {socio.esAportante ? 'Quitar Cuota' : 'Hacer Aportante'}
              </button>
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
              {socio.esAportante && socio.mesesDeuda > 0 && (
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
            No se encontraron vecinos con ese filtro.
          </div>
        )}
      </div>

      {/* VISTA ESCRITORIO EN TABLA (>= md) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Vecino / Socio</th>
              <th className="px-6 py-4 font-semibold">Registro</th>
              <th className="px-6 py-4 font-semibold">Estado App</th>
              <th className="px-6 py-4 font-semibold">Cuota Social</th>
              <th className="px-6 py-4 font-semibold">Monto Deuda</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sociosFiltrados.map((socio) => (
              <tr key={socio.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-white flex items-center gap-2 flex-wrap">
                    {socio.nombre}
                    {socio.is_bombero && (
                      <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                        <ShieldAlert size={10} /> BOMBERO
                      </span>
                    )}
                    {socio.esAportante && (
                      <span className="bg-sky-500/20 text-sky-300 text-[10px] px-2 py-0.5 rounded border border-sky-500/30">
                        APORTANTE
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-xs">{socio.telefono}</div>
                  {socio.email && <div className="text-slate-500 text-xs">{socio.email}</div>}
                </td>
                <td className="px-6 py-4 text-slate-300">
                  <div>{new Date(socio.created_at).toLocaleDateString()}</div>
                  {socio.esAportante && socio.fecha_adhesion_socio && (
                    <div className="text-xs text-sky-400/80">
                      Socio: {new Date(socio.fecha_adhesion_socio).toLocaleDateString()}
                    </div>
                  )}
                </td>
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
                  {!socio.esAportante ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      Vecino (Gratuito)
                    </span>
                  ) : socio.mesesDeuda === 0 ? (
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
                  {socio.esAportante ? `$${socio.montoDeuda}` : <span className="text-slate-500 font-normal">—</span>}
                </td>
                <td className="px-6 py-4 flex justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => handleToggleAportante(socio)}
                    className={`px-2 py-1 rounded transition-colors flex items-center gap-1 border text-xs font-bold ${
                      socio.esAportante
                        ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border-slate-600'
                        : 'bg-sky-600/20 text-sky-400 hover:bg-sky-600/40 border-sky-600/30'
                    }`}
                    title={socio.esAportante ? 'Quitar cuota mensual (pasar a vecino gratuito)' : 'Marcar como Socio Aportante con cuota mensual'}
                  >
                    <UserCheck size={14} /> {socio.esAportante ? 'Quitar Cuota' : 'Hacer Aportante'}
                  </button>
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
                  {socio.esAportante && socio.mesesDeuda > 0 && (
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
            {sociosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">No se encontraron vecinos con ese filtro</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
