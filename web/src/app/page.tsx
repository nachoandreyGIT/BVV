'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Bell, Flame, Car, Phone, ShieldAlert, X, LogOut, LifeBuoy, AlertTriangle, Edit3, Megaphone, Zap, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';

const SUGERENCIAS_SUBTIPO: Record<string, string[]> = {
  fire: [
    'Vivienda / Domicilio',
    'Automóvil en vía pública',
    'Campo / Pastizales / Forestal',
    'Comercio / Depósito',
    'Principio de fuego controlado',
    'Humo denso con corte preventivo'
  ],
  accident: [
    'Colisión entre vehículos',
    'Vuelco de rodado',
    'Corte total de calzada',
    'Calzada reducida / Precaución',
    'Sin víctimas de gravedad',
    'Víctimas asistidas en el lugar',
    'Traslado hacia centro de salud'
  ],
  auxilio: [
    'Asistencia por descompensación médica',
    'Rescate de persona en altura / pozo',
    'Rescate animal en altura / pozo',
    'Riesgo de derrumbe o árbol caído',
    'Cable de alta tensión con chispas'
  ],
  otro: [
    'Temporal / Alerta de vientos fuertes',
    'Anegamiento / Inundación zonal',
    'Patrullaje preventivo de bomberos',
    'Simulacro oficial de guardia'
  ]
};

const CHIPS_VICTIMAS = [
  'Sin heridos',
  'Ocupantes ilesos',
  'Heridos leves asistidos',
  'Personal de SAME en el lugar',
  'Víctima atrapada liberada',
  'Traslado a hospital'
];

// Importación dinámica de Leaflet para evitar errores en SSR
const Map = dynamic(() => import('@/components/Map'), { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-400">Cargando mapa en tiempo real...</div> });

export default function Dashboard() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentComunicados, setRecentComunicados] = useState<any[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [rol, setRol] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'alerts' | 'map'>('alerts');

  useEffect(() => {
    setRol(localStorage.getItem('rol'));
  }, []);
  
  // Estados para el Modal de Difusión Masiva y Edición
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [editingComunicadoId, setEditingComunicadoId] = useState<string | null>(null);
  const [allSugerencias, setAllSugerencias] = useState<any[]>([]);
  const [sugerenciasActuales, setSugerenciasActuales] = useState<any[]>([]);
  const [selectedSugerenciasIds, setSelectedSugerenciasIds] = useState<number[]>([]);
  const [broadcastTipo, setBroadcastTipo] = useState<'fire' | 'accident' | 'auxilio' | 'otro'>('fire');
  const [broadcastSubtipo, setBroadcastSubtipo] = useState('');
  const [broadcastDetallesVictimas, setBroadcastDetallesVictimas] = useState('');
  const [customText, setCustomText] = useState('');

  // Estados para creación de alerta manual
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [newAlertLocation, setNewAlertLocation] = useState<{lat: number, lng: number} | null>(null);
  const [newAlertType, setNewAlertType] = useState<'fire' | 'accident'>('fire');
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [newAlertReporterName, setNewAlertReporterName] = useState('');
  const [newAlertReporterPhone, setNewAlertReporterPhone] = useState('');
  const [focusLocation, setFocusLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    const fetchSugerencias = async () => {
      // Ignoramos errores si la tabla aún no existe, para no romper la UI
      const { data } = await supabase.from('sugerencias').select('*');
      if (data) setAllSugerencias(data);
    };
    fetchSugerencias();

    const fetchAlerts = async () => {
      const ayer = new Date();
      ayer.setHours(ayer.getHours() - 24);

      // Cargar comunicados recientes de las últimas 24 hs
      const { data: comsData } = await supabase
        .from('comunicados')
        .select('*')
        .gte('created_at', ayer.toISOString())
        .order('created_at', { ascending: false });
      if (comsData) {
        setRecentComunicados(comsData);
      }

      const { data, error } = await supabase
        .from('alertas')
        .select(`
          id, lat, lng, tipo, estado, socio_id, created_at,
          socios(nombre, telefono, direccion)
        `)
        .gte('created_at', ayer.toISOString())
        .order('created_at', { ascending: false });

      if (data) {
        const formattedAlerts = data.map(a => ({
          id: a.id,
          lat: a.lat,
          lng: a.lng,
          type: a.tipo,
          estado: a.estado,
          socio_id: a.socio_id,
          user: (a.socios as any)?.nombre || 'Reporte Externo',
          phone: (a.socios as any)?.telefono || 'N/A',
          address: (a.socios as any)?.direccion || 'N/A',
          time: new Date(a.created_at).toLocaleTimeString()
        }));
        setAlerts(formattedAlerts);
        
        setFocusLocation((prev) => {
          if (!prev) {
            const pendingAlert = formattedAlerts.find(a => a.estado === 'Pendiente');
            if (pendingAlert) {
              return [pendingAlert.lat, pendingAlert.lng];
            }
          }
          return prev;
        });
      }
    };
    fetchAlerts();

    const channel = supabase
      .channel('public:alertas_y_coms_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.estado === 'Pendiente') {
          setFocusLocation([payload.new.lat, payload.new.lng]);
        }
        fetchAlerts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sirenRef = useRef<{ init: () => void, play: () => void, pause: () => void } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !sirenRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.connect(gain);
      osc.start();

      let interval: NodeJS.Timeout | null = null;

      sirenRef.current = {
        init: () => {
          if (ctx.state === 'suspended') ctx.resume();
        },
        play: () => {
          if (ctx.state === 'suspended') ctx.resume();
          gain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05);
          if (!interval) {
            let isHigh = true;
            interval = setInterval(() => {
              osc.frequency.setValueAtTime(isHigh ? 800 : 600, ctx.currentTime);
              isHigh = !isHigh;
            }, 600);
          }
        },
        pause: () => {
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      };
    }
  }, []);

  useEffect(() => {
    if (!sirenRef.current) return;
    const pendingAlerts = alerts.filter(a => a.estado === 'Pendiente');
    
    // Si hay alerta seleccionada (modal abierto), pausamos el sonido
    if (audioEnabled && pendingAlerts.length > 0 && !selectedAlert) {
      sirenRef.current.play();
    } else {
      sirenRef.current.pause();
    }
  }, [alerts, audioEnabled, selectedAlert]);

  const getAlertComunicado = (alert: any) => {
    if (!alert || recentComunicados.length === 0) return null;
    return recentComunicados.find(c => {
      if (c.lat && c.lng && alert.lat && alert.lng) {
        const dLat = Math.abs(Number(c.lat) - Number(alert.lat));
        const dLng = Math.abs(Number(c.lng) - Number(alert.lng));
        return dLat < 0.003 && dLng < 0.003;
      }
      return false;
    }) || null;
  };

  const handleQuickAttend = async (alert: any) => {
    await supabase.from('alertas').update({ estado: 'En proceso' }).eq('id', alert.id);
    if (alert.socio_id) {
      await sendPushToVictim(alert.socio_id);
    }
  };

  const openBroadcastModal = (alert: any, existingCom: any = null) => {
    setSelectedAlert(alert);
    setFocusLocation([alert.lat, alert.lng]);
    
    if (existingCom) {
      setIsUpdateMode(true);
      setEditingComunicadoId(existingCom.id);

      const t = existingCom.titulo?.toUpperCase() || '';
      let detectedTipo: 'fire' | 'accident' | 'auxilio' | 'otro' = 'fire';
      if (t.includes('ACCIDENTE') || t.includes('SINIESTRO') || alert.type === 'accident') detectedTipo = 'accident';
      else if (t.includes('AUXILIO') || alert.type === 'auxilio') detectedTipo = 'auxilio';
      else if (t.includes('INCENDIO') || alert.type === 'fire') detectedTipo = 'fire';
      else detectedTipo = 'otro';

      setBroadcastTipo(detectedTipo);

      if (existingCom.titulo?.includes(':')) {
        const parts = existingCom.titulo.split(':');
        setBroadcastSubtipo(parts.slice(1).join(':').trim());
      } else {
        setBroadcastSubtipo('');
      }

      setBroadcastDetallesVictimas('');
      setCustomText(existingCom.mensaje || '');

      const relevant = allSugerencias.filter(s => {
        const tipoSug = s.tipo?.toLowerCase().trim() || '';
        return tipoSug === detectedTipo || tipoSug === 'general';
      });
      setSugerenciasActuales(relevant.length > 0 ? relevant : allSugerencias);
      setSelectedSugerenciasIds([]);
    } else {
      setIsUpdateMode(false);
      setEditingComunicadoId(null);

      // El tipo inicial se deduce si venía predeterminado, o por defecto Incendio
      const initialTipo: 'fire' | 'accident' | 'auxilio' | 'otro' = 
        alert.type === 'accident' ? 'accident' : 
        alert.type === 'auxilio' ? 'auxilio' : 
        alert.type === 'fire' ? 'fire' : 'fire';

      setBroadcastTipo(initialTipo);
      setBroadcastSubtipo('');
      setBroadcastDetallesVictimas('');
      setCustomText('');

      const relevant = allSugerencias.filter(s => {
        const tipoSug = s.tipo?.toLowerCase().trim() || '';
        return tipoSug === initialTipo || tipoSug === 'general';
      });
      const finalSugerencias = relevant.length > 0 ? relevant : allSugerencias;
      setSugerenciasActuales(finalSugerencias);
      setSelectedSugerenciasIds(finalSugerencias.filter(s => s.fija).map(s => s.id));
    }
  };

  const handleTipoChange = (newTipo: 'fire' | 'accident' | 'auxilio' | 'otro') => {
    setBroadcastTipo(newTipo);
    const relevant = allSugerencias.filter(s => {
      const tipoSug = s.tipo?.toLowerCase().trim() || '';
      return tipoSug === newTipo || tipoSug === 'general';
    });
    const finalSugerencias = relevant.length > 0 ? relevant : allSugerencias;
    setSugerenciasActuales(finalSugerencias);
  };

  const handleAddSubtipoChip = (chip: string) => {
    if (!broadcastSubtipo) {
      setBroadcastSubtipo(chip);
    } else if (!broadcastSubtipo.includes(chip)) {
      setBroadcastSubtipo(prev => `${prev} • ${chip}`);
    } else {
      setBroadcastSubtipo(prev => prev.replace(` • ${chip}`, '').replace(chip, '').trim());
    }
  };

  const handleAddVictimasChip = (chip: string) => {
    if (!broadcastDetallesVictimas) {
      setBroadcastDetallesVictimas(chip);
    } else if (!broadcastDetallesVictimas.includes(chip)) {
      setBroadcastDetallesVictimas(prev => `${prev}, ${chip}`);
    }
  };

  const buildPreviewBody = () => {
    const partes: string[] = [];
    if (broadcastSubtipo.trim()) {
      partes.push(`📍 Lugar / Tipo: ${broadcastSubtipo.trim()}`);
    }
    if (broadcastDetallesVictimas.trim()) {
      partes.push(`👥 Estado / Afectados: ${broadcastDetallesVictimas.trim()}`);
    }
    const selectedTexts = sugerenciasActuales
      .filter(s => selectedSugerenciasIds.includes(s.id))
      .map(s => s.texto);
    if (selectedTexts.length > 0) {
      partes.push(selectedTexts.join(' \n'));
    }
    if (customText.trim()) {
      partes.push(`ℹ️ Indicaciones: ${customText.trim()}`);
    }
    return partes.join('\n\n');
  };

  const sendPushToVictim = async (socioId: string) => {
    try {
      const { data } = await supabase.from('socios').select('push_token').eq('id', socioId).maybeSingle();
      if (data && data.push_token) {
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            to: data.push_token,
            sound: 'default',
            title: '¡AYUDA EN CAMINO! 🚒',
            body: 'El cuartel ha tomado tu alerta y se dirige hacia ti.',
            priority: 'high',
            data: { url: '/notifications' }
          }]),
        });
      }
    } catch (e) {
      console.error('Error push victim:', e);
    }
  };

  const sendPushToAll = async (title: string, body: string) => {
    try {
      const { data: socios } = await supabase.from('socios').select('push_token').not('push_token', 'is', null).neq('push_token', '');
      if (!socios || socios.length === 0) return;
      const tokens = socios.map(s => s.push_token);
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        priority: 'high',
        data: { url: '/notifications' }
      }));
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    } catch (e) {
      console.error('Error push all:', e);
    }
  };

  const handleAttendOnly = async () => {
    if (!selectedAlert) return;
    await supabase.from('alertas').update({ estado: 'En proceso' }).eq('id', selectedAlert.id);
    
    // 🚀 AVISAR A LA VÍCTIMA
    if (selectedAlert.socio_id) {
      await sendPushToVictim(selectedAlert.socio_id);
    }
    
    setSelectedAlert(null);
  };

  const handleAttendAndBroadcast = async () => {
    if (!selectedAlert) return;
    
    let tipoTitulo = 'EMERGENCIA';
    if (broadcastTipo === 'fire') tipoTitulo = 'INCENDIO';
    else if (broadcastTipo === 'accident') tipoTitulo = 'ACCIDENTE DE TRÁNSITO';
    else if (broadcastTipo === 'auxilio') tipoTitulo = 'PEDIDO DE AUXILIO';
    else tipoTitulo = 'AVISO OFICIAL';

    const tituloComunicado = broadcastSubtipo.trim()
      ? `${tipoTitulo}: ${broadcastSubtipo.trim().toUpperCase()}`
      : tipoTitulo;

    const previewBody = buildPreviewBody();
    const cuerpoComunicado = previewBody || 'El cuartel está atendiendo un llamado en este momento. Por favor libere las vías de acceso a los móviles.';

    // 1. Insertar comunicado público
    await supabase.from('comunicados').insert({
      titulo: tituloComunicado,
      mensaje: cuerpoComunicado,
      severidad: 'peligro',
      lat: selectedAlert.lat,
      lng: selectedAlert.lng
    });

    // 2. Marcar como en proceso y sincronizar con tipo de evento
    const dbTipo = broadcastTipo === 'accident' ? 'accident' : 'fire';
    await supabase.from('alertas').update({ 
      estado: 'En proceso',
      tipo: dbTipo
    }).eq('id', selectedAlert.id);
    
    // 🚀 AVISAR A LA VÍCTIMA Y AL PUEBLO
    if (selectedAlert.socio_id) {
      await sendPushToVictim(selectedAlert.socio_id);
    }
    await sendPushToAll(`🚨 AVISO: ${tituloComunicado}`, cuerpoComunicado);

    setSelectedAlert(null);
  };

  const handleSaveCorrection = async (sendPush: boolean) => {
    if (!selectedAlert) return;

    let tipoTitulo = 'EMERGENCIA';
    if (broadcastTipo === 'fire') tipoTitulo = 'INCENDIO';
    else if (broadcastTipo === 'accident') tipoTitulo = 'ACCIDENTE DE TRÁNSITO';
    else if (broadcastTipo === 'auxilio') tipoTitulo = 'PEDIDO DE AUXILIO';
    else tipoTitulo = 'AVISO OFICIAL';

    const baseTitulo = broadcastSubtipo.trim()
      ? `${tipoTitulo}: ${broadcastSubtipo.trim().toUpperCase()}`
      : tipoTitulo;

    const preview = buildPreviewBody();
    const cuerpoFinal = preview || customText || 'El cuartel continúa interviniendo en el lugar del evento.';

    if (editingComunicadoId) {
      await supabase.from('comunicados').update({
        titulo: baseTitulo,
        mensaje: cuerpoFinal,
      }).eq('id', editingComunicadoId);
    } else {
      await supabase.from('comunicados').insert({
        titulo: baseTitulo,
        mensaje: cuerpoFinal,
        severidad: 'peligro',
        lat: selectedAlert.lat,
        lng: selectedAlert.lng
      });
    }

    // Actualizar tipo de alerta si cambió
    const dbTipo = broadcastTipo === 'accident' ? 'accident' : 'fire';
    await supabase.from('alertas').update({ 
      tipo: dbTipo,
      estado: 'En proceso'
    }).eq('id', selectedAlert.id);

    if (sendPush) {
      await sendPushToAll(`🚨 ACTUALIZACIÓN: ${baseTitulo}`, cuerpoFinal);
    }

    setSelectedAlert(null);
    setIsUpdateMode(false);
    setEditingComunicadoId(null);
  };

  const handleCreateManualAlert = async () => {
    if (!newAlertLocation) return;
    
    const tituloComunicado = newAlertType === 'fire' ? 'INCENDIO' : 'SINIESTRO VIAL';
    const cuerpoComunicado = newAlertMessage.trim() !== '' ? newAlertMessage : 'El cuartel está atendiendo un evento en este momento. Por favor libere las vías.';
    const reportero = newAlertReporterName.trim() !== '' ? newAlertReporterName : 'Reporte Externo';
    const telefono = newAlertReporterPhone.trim() !== '' ? newAlertReporterPhone : 'N/A';

    // 1. Insertar comunicado público
    await supabase.from('comunicados').insert({
      titulo: tituloComunicado,
      mensaje: cuerpoComunicado,
      severidad: 'peligro',
      lat: newAlertLocation.lat,
      lng: newAlertLocation.lng
    });

    // 2. Crear un socio temporal para vincular la alerta (así evitamos fallos si socio_id es obligatorio)
    let manualSocioId = null;
    const { data: newSocio, error: socioError } = await supabase.from('socios').insert({
      nombre: reportero,
      telefono: telefono,
      direccion: 'Reporte Manual desde Consola'
    }).select('id').maybeSingle();

    if (newSocio) {
      manualSocioId = newSocio.id;
    } else {
      console.warn('No se pudo crear socio temporal, intentando insertar alerta sin socio_id:', socioError);
    }

    // 3. Insertar alerta
    const { error: alertError } = await supabase.from('alertas').insert({
      lat: newAlertLocation.lat,
      lng: newAlertLocation.lng,
      tipo: newAlertType,
      estado: 'En proceso',
      socio_id: manualSocioId
    });

    if (alertError) {
      console.error('Error creando alerta manual en BD:', alertError);
    }

    // 🚀 AVISAR AL PUEBLO
    await sendPushToAll(`🚨 AVISO A LA COMUNIDAD: ${tituloComunicado}`, cuerpoComunicado);

    setIsCreatingAlert(false);
    setNewAlertLocation(null);
    setNewAlertMessage('');
    setNewAlertReporterName('');
    setNewAlertReporterPhone('');
    setNewAlertType('fire');
  };

  const pendientes = alerts.filter(a => a.estado === 'Pendiente');
  const enProceso = alerts.filter(a => a.estado === 'En proceso');

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans relative">
      
      {/* MODAL DE DIFUSIÓN MASIVA */}
      {selectedAlert && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {isUpdateMode ? (
                    <>
                      <Edit3 className="text-amber-400" />
                      Modificar / Actualizar Aviso a la Comunidad
                    </>
                  ) : (
                    <>
                      <Bell className="text-blue-500" />
                      Notificar al Pueblo (Alerta Oficial)
                    </>
                  )}
                </h2>
                <p className="text-slate-400 mt-1 text-sm">
                  {isUpdateMode
                    ? 'Corrija datos o redacte una ampliación de la situación. Se actualizará en la app de todos los vecinos.'
                    : 'Configure los detalles del evento antes de despachar y notificar a la comunidad.'
                  }
                </p>
              </div>
              <button 
                onClick={() => {
                  setSelectedAlert(null);
                  setIsUpdateMode(false);
                  setEditingComunicadoId(null);
                }} 
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                <X size={26} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              
              {/* Protocolo de Contacto */}
              <div className="bg-slate-800/80 p-4 rounded-xl border border-blue-500/30 shadow-inner">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Phone size={16} /> 1. Datos del Solicitante
                </h3>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm"><span className="text-slate-500">Vecino:</span> <strong className="text-white">{selectedAlert.user}</strong></p>
                    <p className="text-sm"><span className="text-slate-500">Lugar:</span> <strong className="text-white">{selectedAlert.address}</strong></p>
                  </div>
                  <a 
                    href={`tel:${selectedAlert.phone}`} 
                    className="inline-flex items-center gap-2 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-blue-500/40"
                  >
                    <Phone size={14} /> Llamar: {selectedAlert.phone}
                  </a>
                </div>
              </div>

              {/* 2. Selector de Tipo de Evento */}
              <div>
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
                  2. Tipo de Emergencia
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTipoChange('fire')}
                    className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm border transition-all ${
                      broadcastTipo === 'fire'
                        ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-900/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <Flame size={18} /> Incendio
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTipoChange('accident')}
                    className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm border transition-all ${
                      broadcastTipo === 'accident'
                        ? 'bg-orange-600 text-white border-orange-400 shadow-lg shadow-orange-900/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <Car size={18} /> Accidente
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTipoChange('auxilio')}
                    className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm border transition-all ${
                      broadcastTipo === 'auxilio'
                        ? 'bg-sky-600 text-white border-sky-400 shadow-lg shadow-sky-900/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <LifeBuoy size={18} /> Auxilio / Rescate
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTipoChange('otro')}
                    className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-sm border transition-all ${
                      broadcastTipo === 'otro'
                        ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-900/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <AlertTriangle size={18} /> Otro Evento
                  </button>
                </div>
              </div>

              {/* 3. Subtipo y Características del Hecho */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                    3. Subtipo y Lugar Afectado (Texto Libre)
                  </h3>
                  <span className="text-xs text-slate-400">Clic en las sugerencias para insertar</span>
                </div>

                {/* Chips de sugerencias rápidas según el tipo */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {SUGERENCIAS_SUBTIPO[broadcastTipo]?.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAddSubtipoChip(chip)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        broadcastSubtipo.includes(chip)
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Ej: Vivienda particular de dos pisos, pastizales frente a Ruta 36..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  value={broadcastSubtipo}
                  onChange={(e) => setBroadcastSubtipo(e.target.value)}
                />
              </div>

              {/* 4. Personas Afectadas / Víctimas y Estado */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                    4. Personas Afectadas y Estado (Opcional)
                  </h3>
                  <span className="text-xs text-slate-400">Información para tranquilidad comunitaria</span>
                </div>

                {/* Chips de víctimas */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {CHIPS_VICTIMAS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAddVictimasChip(chip)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        broadcastDetallesVictimas.includes(chip)
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Ej: Ocupantes asistidos ilesos, personal médico trabajando en el lugar..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  value={broadcastDetallesVictimas}
                  onChange={(e) => setBroadcastDetallesVictimas(e.target.value)}
                />
              </div>

              {/* 5. Sugerencias Predefinidas Institucionales */}
              {sugerenciasActuales.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                    5. Sugerencias Institucionales Rápidas
                  </h3>
                  <div className="space-y-2">
                    {sugerenciasActuales.map(sug => (
                      <label key={sug.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer border border-slate-700/50 hover:border-slate-500 transition-colors">
                        <input 
                          type="checkbox" 
                          className="mt-1 w-5 h-5 accent-blue-500"
                          checked={selectedSugerenciasIds.includes(sug.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSugerenciasIds(prev => [...prev, sug.id]);
                            } else {
                              setSelectedSugerenciasIds(prev => prev.filter(id => id !== sug.id));
                            }
                          }}
                        />
                        <span className="text-slate-200 text-sm leading-relaxed">{sug.texto}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Indicaciones Espontáneas del Cuartelero */}
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  6. Instrucciones Adicionales del Cuartelero (Opcional)
                </h3>
                <textarea
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  rows={2}
                  placeholder="Ej: Circular con balizas encendidas, desviar por calle 22 hacia Verónica centro..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                />
              </div>

              {/* 7. Live Preview (Vista previa en vivo de la notificación) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/40 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    📱 Vista Previa del Aviso a los Vecinos
                  </span>
                  <span className="text-[11px] text-slate-500">Notificación Push Móvil</span>
                </div>
                <div className="bg-slate-900 rounded-lg p-3.5 border border-slate-800">
                  <p className="text-sm font-black text-white flex items-center gap-2">
                    <span>🚨</span>
                    <span>
                      {broadcastTipo === 'fire' ? 'INCENDIO' : broadcastTipo === 'accident' ? 'ACCIDENTE DE TRÁNSITO' : broadcastTipo === 'auxilio' ? 'PEDIDO DE AUXILIO' : 'AVISO OFICIAL'}
                      {broadcastSubtipo.trim() ? `: ${broadcastSubtipo.trim().toUpperCase()}` : ''}
                    </span>
                  </p>
                  <p className="text-xs text-slate-300 mt-2 whitespace-pre-line leading-relaxed">
                    {buildPreviewBody() || 'El cuartel está atendiendo un evento en este momento. Por favor libere las vías.'}
                  </p>
                </div>
              </div>

            </div>

            <div className="p-6 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
              {isUpdateMode ? (
                <>
                  <button 
                    onClick={() => {
                      setSelectedAlert(null);
                      setIsUpdateMode(false);
                      setEditingComunicadoId(null);
                    }}
                    className="sm:w-1/4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-lg transition-colors border border-slate-700 text-sm"
                  >
                    CANCELAR
                  </button>
                  <button 
                    onClick={() => handleSaveCorrection(false)}
                    className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold py-3.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                    title="Actualiza el texto en la app de los vecinos de forma silenciosa"
                  >
                    <Edit3 size={18} />
                    GUARDAR CORRECCIÓN (Silencioso)
                  </button>
                  <button 
                    onClick={() => handleSaveCorrection(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-lg transition-colors shadow-lg shadow-blue-900/30 text-sm flex items-center justify-center gap-2"
                    title="Actualiza y envía una notificación push con prefijo ACTUALIZACIÓN"
                  >
                    <Bell size={18} />
                    GUARDAR Y ENVIAR PUSH
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleAttendOnly}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-lg transition-colors border border-slate-700 text-sm"
                  >
                    SOLO ATENDER (Silencioso)
                  </button>
                  <button 
                    onClick={handleAttendAndBroadcast}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-lg transition-colors shadow-lg shadow-blue-900/30 text-sm flex items-center justify-center gap-2"
                  >
                    <Bell size={18} />
                    NOTIFICAR Y ATENDER
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CREACIÓN DE ALERTA MANUAL */}
      {isCreatingAlert && newAlertLocation && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-950 p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="text-red-500 shrink-0" />
                  Configurar Alerta Manual
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">Complete los datos del reporte para notificar a la comunidad.</p>
              </div>
              <button 
                onClick={() => {
                  setNewAlertLocation(null);
                  setIsCreatingAlert(false);
                }} 
                className="text-slate-500 hover:text-white"
              >
                <X size={28} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh] space-y-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-400 mb-2">Nombre del Reportante</label>
                  <input 
                    type="text"
                    placeholder="Ej. Juan Pérez"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    value={newAlertReporterName}
                    onChange={(e) => setNewAlertReporterName(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-400 mb-2">Teléfono (opcional)</label>
                  <input 
                    type="text"
                    placeholder="Ej. 2221-555555"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    value={newAlertReporterPhone}
                    onChange={(e) => setNewAlertReporterPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Tipo de Evento</label>
                <div className="flex gap-3 sm:gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-sm font-semibold ${newAlertType === 'fire' ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                    <input type="radio" name="alertType" className="hidden" checked={newAlertType === 'fire'} onChange={() => setNewAlertType('fire')} />
                    <Flame size={20} /> Incendio
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-sm font-semibold ${newAlertType === 'accident' ? 'bg-orange-900/40 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                    <input type="radio" name="alertType" className="hidden" checked={newAlertType === 'accident'} onChange={() => setNewAlertType('accident')} />
                    <Car size={20} /> Siniestro Vial
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Mensaje para la Comunidad (Aviso)</label>
                <textarea
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  rows={3}
                  placeholder="Detalles del evento. Ej: Fuego en banquina, circular con precaución."
                  value={newAlertMessage}
                  onChange={(e) => setNewAlertMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-slate-950 border-t border-slate-800 flex gap-4">
              <button 
                onClick={handleCreateManualAlert}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-red-900/20 text-sm sm:text-base"
              >
                CREAR ALERTA Y NOTIFICAR AL PUEBLO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de Alertas: 100% ancho en celular, 38% en escritorio */}
      <div className={`${mobileView === 'alerts' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[38%] xl:w-[35%] h-full bg-slate-900 border-r border-slate-800 flex-col shadow-2xl z-10 pb-14 lg:pb-0`}>
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950 flex flex-col justify-between">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-wide">
                <ShieldAlert className="text-red-500 animate-pulse shrink-0" size={28} />
                CONSOLA ALERTAS
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5 uppercase tracking-widest font-semibold">Bomberos Verónica</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <a 
                href="/admin/comunicados" 
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
                title="Historial de Comunicados y Edición"
              >
                <Megaphone size={14} className="text-blue-400" />
                AVISOS
              </a>
              {rol === 'admin' && (
                <a href="/admin" className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold px-3 py-2 rounded-lg border border-blue-500/40 transition-colors">
                  GESTIÓN
                </a>
              )}
              <button 
                onClick={() => {
                  localStorage.removeItem('rol');
                  localStorage.removeItem('usuario');
                  window.location.href = '/login';
                }}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => {
              if (sirenRef.current) {
                if (!audioEnabled) {
                  sirenRef.current.init();
                  setAudioEnabled(true);
                  if (pendientes.length === 0) {
                    sirenRef.current.pause();
                  } else {
                    sirenRef.current.play();
                  }
                } else {
                  sirenRef.current.pause();
                  setAudioEnabled(false);
                }
              }
            }}
            className={`w-full py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-colors border shadow-lg ${audioEnabled ? 'bg-green-600 hover:bg-green-500 text-white border-green-400 shadow-green-900/50' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}
          >
            {audioEnabled ? '🔊 SIRENA DESBLOQUEADA Y ACTIVA' : '🔇 CLIC PARA DESBLOQUEAR SIRENA'}
          </button>
          
          <button 
            onClick={() => {
              const nextState = !isCreatingAlert;
              setIsCreatingAlert(nextState);
              setNewAlertLocation(null);
              if (nextState) {
                setMobileView('map');
              }
            }}
            className={`w-full py-2.5 sm:py-3 mt-3 rounded-lg font-bold text-xs sm:text-sm transition-colors border shadow-lg ${isCreatingAlert ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}
          >
            {isCreatingAlert ? 'CANCELAR CREACIÓN DE ALERTA' : '🚨 GENERAR ALERTA MANUAL'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Emergencias Nuevas
              </h2>
              <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded-full border border-red-500/30">
                {pendientes.length} PENDIENTES
              </span>
            </div>
            <div className="space-y-4">
              {pendientes.map(alert => (
                <div 
                  key={alert.id} 
                  className="bg-slate-800 rounded-xl p-4 sm:p-5 border border-red-500/30 shadow-lg shadow-red-900/10 cursor-pointer hover:border-red-400 transition-colors"
                  onClick={() => {
                    setFocusLocation([alert.lat, alert.lng]);
                    setMobileView('map');
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-500/20 text-red-400 p-3 rounded-lg border border-red-500/30">
                      {alert.type === 'fire' ? <Flame size={24} /> : alert.type === 'accident' ? <Car size={24} /> : <ShieldAlert size={24} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base sm:text-lg tracking-wide">
                        {alert.type === 'fire' ? 'INCENDIO' : alert.type === 'accident' ? 'SINIESTRO VIAL' : 'PEDIDO DE AYUDA'}
                      </h3>
                      <span className="text-xs font-medium text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-500/20">URGENTE - {alert.time}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm bg-slate-900/80 p-3 rounded-lg border border-slate-800 mb-4">
                    <p><span className="text-slate-500">Vecino:</span> <strong className="text-white">{alert.user}</strong></p>
                    <p><span className="text-slate-500">Tel:</span> <strong className="text-white">{alert.phone}</strong></p>
                    <p><span className="text-slate-500">Lugar:</span> <strong className="text-white">{alert.address}</strong></p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAttend(alert);
                      }}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 px-2 rounded-lg text-xs transition-colors border border-slate-600 flex items-center justify-center gap-1.5"
                      title="Silencia la alarma, pasa a eventos en curso y avisa a la víctima para salir rápido"
                    >
                      <Zap size={14} className="text-yellow-400" />
                      TOMAR GUARDIA (Rápido)
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openBroadcastModal(alert);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-2 rounded-lg text-xs transition-colors shadow-lg flex items-center justify-center gap-1.5"
                    >
                      <Bell size={14} />
                      ATENDER Y NOTIFICAR
                    </button>
                  </div>
                </div>
              ))}
              {pendientes.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No hay emergencias nuevas.</p>}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Eventos en Curso
              </h2>
              <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded-full border border-blue-500/30">
                {enProceso.length} EN PROCESO
              </span>
            </div>
            <div className="space-y-4">
              {enProceso.map(alert => {
                const linkedCom = getAlertComunicado(alert);
                return (
                  <div 
                    key={alert.id} 
                    className="bg-slate-800/60 rounded-xl p-4 border border-blue-500/20 cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => {
                      setFocusLocation([alert.lat, alert.lng]);
                      setMobileView('map');
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <h3 className="font-bold text-slate-200 text-base">
                          {alert.type === 'fire' ? 'INCENDIO' : alert.type === 'accident' ? 'SINIESTRO VIAL' : 'PEDIDO DE AYUDA'}
                        </h3>
                        <span className="text-xs text-slate-400">{alert.time}</span>
                      </div>
                    </div>
                    <div className="text-sm text-slate-300 mb-3">
                      <strong className="text-white">{alert.user}</strong> — {alert.address}
                    </div>

                    {linkedCom ? (
                      <div className="mb-3 p-2.5 bg-blue-950/50 rounded-lg border border-blue-500/30 text-xs">
                        <div className="text-blue-300 font-bold flex items-center gap-1.5 mb-1">
                          <Bell size={13} />
                          Aviso oficial emitido:
                        </div>
                        <p className="text-slate-300 line-clamp-1">{linkedCom.titulo}</p>
                      </div>
                    ) : (
                      <div className="mb-3 p-2.5 bg-amber-950/40 rounded-lg border border-amber-500/30 text-xs">
                        <div className="text-amber-300 font-bold flex items-center gap-1.5 mb-0.5">
                          <AlertTriangle size={13} />
                          Atendida en silencio:
                        </div>
                        <p className="text-slate-400">Sin notificación masiva emitida aún.</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openBroadcastModal(alert, linkedCom);
                        }}
                        className={`flex-1 font-bold py-2 px-2 rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 ${
                          linkedCom 
                            ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
                        }`}
                      >
                        {linkedCom ? (
                          <>
                            <Edit3 size={13} />
                            MODIFICAR / ACTUALIZAR
                          </>
                        ) : (
                          <>
                            <Bell size={13} />
                            NOTIFICAR AL PUEBLO
                          </>
                        )}
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          await supabase.from('alertas').update({ estado: 'Cerrado' }).eq('id', alert.id);
                        }}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs"
                      >
                        CERRAR
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mapa en vivo: oculto en celular salvo que mobileView === 'map', 62%/65% en escritorio */}
      <div className={`${mobileView === 'map' ? 'block' : 'hidden'} lg:block w-full lg:w-[62%] xl:w-[65%] h-full relative bg-black pb-14 lg:pb-0`}>
        {isCreatingAlert && !newAlertLocation && (
          <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] sm:w-auto bg-blue-600/90 backdrop-blur-md border border-blue-400 p-3 sm:p-4 rounded-xl shadow-2xl text-white text-xs sm:text-base font-bold animate-pulse text-center">
            📍 HAGA CLIC EN EL MAPA PARA INDICAR<br/>LA UBICACIÓN DE LA EMERGENCIA
          </div>
        )}
        
        <Map 
          alerts={alerts as any} 
          isSelectionMode={isCreatingAlert}
          onLocationSelected={(lat, lng) => {
            if (isCreatingAlert) setNewAlertLocation({lat, lng});
          }}
          selectedLocation={newAlertLocation}
          focusLocation={focusLocation}
        />
        
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700 px-3 py-2 sm:p-4 rounded-xl shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-400 font-bold tracking-widest uppercase">Estado</p>
                <p className="text-xs sm:text-sm font-bold text-white">ONLINE Y ACTIVO</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra inferior de navegación en móviles (< lg) para alternar entre Consola de Alertas y Mapa */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-[1500] bg-slate-950 border-t border-slate-800 grid grid-cols-2 h-14 shadow-2xl">
        <button
          onClick={() => setMobileView('alerts')}
          className={`flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-colors ${
            mobileView === 'alerts'
              ? 'bg-red-600/20 text-red-400 border-t-2 border-red-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert size={16} />
          Alertas ({pendientes.length + enProceso.length})
        </button>
        <button
          onClick={() => setMobileView('map')}
          className={`flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-colors ${
            mobileView === 'map'
              ? 'bg-blue-600/20 text-blue-400 border-t-2 border-blue-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MapPin size={16} />
          Mapa en Vivo
        </button>
      </div>
      </div>
    </ProtectedRoute>
  );
}
