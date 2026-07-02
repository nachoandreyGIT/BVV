'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Bell, Flame, Car, Phone, ShieldAlert, X, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';

// Importación dinámica de Leaflet para evitar errores en SSR
const Map = dynamic(() => import('@/components/Map'), { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-400">Cargando mapa en tiempo real...</div> });

export default function Dashboard() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => {
    setRol(localStorage.getItem('rol'));
  }, []);
  
  // Estados para el Modal de Difusión Masiva
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [allSugerencias, setAllSugerencias] = useState<any[]>([]);
  const [sugerenciasActuales, setSugerenciasActuales] = useState<any[]>([]);
  const [selectedSugerenciasIds, setSelectedSugerenciasIds] = useState<number[]>([]);
  const [customText, setCustomText] = useState('');

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

      const { data, error } = await supabase
        .from('alertas')
        .select(`
          id, lat, lng, tipo, estado, created_at,
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
          user: (a.socios as any)?.nombre || 'Desconocido',
          phone: (a.socios as any)?.telefono || 'N/A',
          address: (a.socios as any)?.direccion || 'N/A',
          time: new Date(a.created_at).toLocaleTimeString()
        }));
        setAlerts(formattedAlerts);
      }
    };
    fetchAlerts();

    const channel = supabase
      .channel('public:alertas_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas' }, () => {
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

  const openBroadcastModal = (alert: any) => {
    setSelectedAlert(alert);
    
    const relevant = allSugerencias.filter(s => {
      const tipoSug = s.tipo?.toLowerCase().trim() || '';
      const tipoAlert = alert.type?.toLowerCase().trim() || '';
      return tipoSug === tipoAlert || tipoSug === 'general';
    });
    
    // Si la tabla de sugerencias tiene datos pero el filtro no trajo nada (por errores de tipeo en la DB), mostramos todas
    const finalSugerencias = relevant.length > 0 ? relevant : allSugerencias;
    
    setSugerenciasActuales(finalSugerencias);
    setSelectedSugerenciasIds(finalSugerencias.filter(s => s.fija).map(s => s.id));
    setCustomText('');
  };

  const handleAttendOnly = async () => {
    if (!selectedAlert) return;
    await supabase.from('alertas').update({ estado: 'En proceso' }).eq('id', selectedAlert.id);
    setSelectedAlert(null);
  };

  const handleAttendAndBroadcast = async () => {
    if (!selectedAlert) return;
    
    // Armar el mensaje final
    const selectedTexts = sugerenciasActuales
      .filter(s => selectedSugerenciasIds.includes(s.id))
      .map(s => s.texto);
    
    if (customText.trim() !== '') {
      selectedTexts.push(customText.trim());
    }
    
    const finalMessage = selectedTexts.join(' \n\n');

    // 1. Insertar comunicado público
    await supabase.from('comunicados').insert({
      titulo: selectedAlert.type === 'fire' ? 'INCENDIO' : 'SINIESTRO VIAL',
      mensaje: finalMessage || 'El cuartel está atendiendo un evento en este momento. Por favor libere las vías.',
      severidad: 'peligro',
      lat: selectedAlert.lat,
      lng: selectedAlert.lng
    });

    // 2. Marcar como en proceso
    await supabase.from('alertas').update({ estado: 'En proceso' }).eq('id', selectedAlert.id);
    setSelectedAlert(null);
  };

  const pendientes = alerts.filter(a => a.estado === 'Pendiente');
  const enProceso = alerts.filter(a => a.estado === 'En proceso');

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans relative">
      
      {/* MODAL DE DIFUSIÓN MASIVA */}
      {selectedAlert && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-950 p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Bell className="text-blue-500" />
                  Notificar al Pueblo
                </h2>
                <p className="text-slate-400 mt-1">Configure el aviso masivo para los vecinos antes de salir.</p>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="text-slate-500 hover:text-white">
                <X size={28} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              
              {/* Protocolo de Contacto */}
              <div className="bg-slate-800/80 p-4 rounded-xl mb-6 border border-blue-500/30 shadow-inner">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Phone size={16} /> Protocolo de Contacto
                </h3>
                <p className="text-slate-300 text-sm mb-1">1. Comuníquese con el vecino para certificar el evento y obtener detalles.</p>
                <p className="text-slate-300 text-sm mb-3">2. Si el vecino solicita reserva o es un evento menor, elija <strong className="text-slate-100">SOLO ATENDER</strong>.</p>
                
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/50 flex flex-col gap-1">
                  <p className="text-sm"><span className="text-slate-500">Vecino:</span> <strong className="text-white">{selectedAlert.user}</strong></p>
                  <p className="text-sm"><span className="text-slate-500">Teléfono:</span> <a href={`tel:${selectedAlert.phone}`} className="text-blue-400 font-bold hover:underline">{selectedAlert.phone}</a></p>
                  <p className="text-sm"><span className="text-slate-500">Lugar:</span> <strong className="text-white">{selectedAlert.address}</strong></p>
                </div>
              </div>

              {sugerenciasActuales.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Sugerencias Predefinidas</h3>
                  <div className="space-y-3">
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

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Instrucciones Específicas (Opcional)</h3>
                <textarea
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  rows={3}
                  placeholder="Ej: Evitar Ruta 36 km 140 por humo en calzada..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                />
              </div>
            </div>

            <div className="p-6 bg-slate-950 border-t border-slate-800 flex gap-4">
              <button 
                onClick={handleAttendOnly}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-lg transition-colors border border-slate-700"
              >
                SOLO ATENDER (Silencioso)
              </button>
              <button 
                onClick={handleAttendAndBroadcast}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
              >
                NOTIFICAR Y ATENDER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de Alertas (35%) */}
      <div className="w-[35%] bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-3 tracking-wide">
                <ShieldAlert className="text-red-500 animate-pulse" size={32} />
                CONSOLA ALERTAS
              </h1>
              <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-semibold">Bomberos Verónica</p>
            </div>
            
            <div className="flex gap-2">
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
              {rol === 'admin' && (
                <a href="/admin" className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 transition-colors">
                  GESTIÓN
                </a>
              )}
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
            className={`w-full py-3 rounded-lg font-bold text-sm transition-colors border shadow-lg ${audioEnabled ? 'bg-green-600 hover:bg-green-500 text-white border-green-400 shadow-green-900/50' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'}`}
          >
            {audioEnabled ? '🔊 SIRENA DESBLOQUEADA Y ACTIVA' : '🔇 CLIC PARA DESBLOQUEAR SIRENA'}
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
                <div key={alert.id} className="bg-slate-800 rounded-xl p-5 border border-red-500/30 shadow-lg shadow-red-900/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-500/20 text-red-400 p-3 rounded-lg border border-red-500/30">
                      {alert.type === 'fire' ? <Flame size={24} /> : <Car size={24} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg tracking-wide">
                        {alert.type === 'fire' ? 'INCENDIO' : 'SINIESTRO VIAL'}
                      </h3>
                      <span className="text-xs font-medium text-red-400 bg-red-900/20 px-2 py-1 rounded border border-red-500/20">URGENTE - {alert.time}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm bg-slate-900/80 p-3 rounded-lg border border-slate-800 mb-4">
                    <p><span className="text-slate-500">Vecino:</span> <strong className="text-white">{alert.user}</strong></p>
                    <p><span className="text-slate-500">Tel:</span> <strong className="text-white">{alert.phone}</strong></p>
                    <p><span className="text-slate-500">Lugar:</span> <strong className="text-white">{alert.address}</strong></p>
                  </div>

                  <button 
                    onClick={() => openBroadcastModal(alert)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg"
                  >
                    ATENDER EVENTO
                  </button>
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
              {enProceso.map(alert => (
                <div key={alert.id} className="bg-slate-800/50 rounded-xl p-4 border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-300">
                        {alert.type === 'fire' ? 'INCENDIO' : 'SINIESTRO VIAL'}
                      </h3>
                      <span className="text-xs text-slate-500">{alert.time}</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-400 mb-3">
                    {alert.user} - {alert.address}
                  </div>
                  <button 
                    onClick={async () => {
                      await supabase.from('alertas').update({ estado: 'Cerrado' }).eq('id', alert.id);
                    }}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors text-sm"
                  >
                    MARCAR COMO CERRADO
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-[65%] h-full relative bg-black">
        <Map alerts={alerts as any} />
        
        <div className="absolute top-6 right-6 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Estado</p>
                <p className="text-sm font-bold text-white">ONLINE Y ACTIVO</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </ProtectedRoute>
  );
}
