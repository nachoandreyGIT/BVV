'use client';
import { useState, useEffect } from 'react';
import { Megaphone, Send, AlertTriangle, Search, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Comunicados() {
  const router = useRouter();
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [severidad, setSeveridad] = useState('informativo');
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);
  
  // Filtros
  const [filterTipo, setFilterTipo] = useState('todos'); // 'todos', 'incendio', 'siniestro', 'otros'
  
  // Rango de fechas por defecto: últimos 10 días
  const getDefaultStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    return d.toISOString().split('T')[0];
  };
  const getDefaultEndDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // +1 to include today fully
    return d.toISOString().split('T')[0];
  };
  
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());

  useEffect(() => {
    fetchComunicados();
  }, [filterTipo, startDate, endDate]);

  const fetchComunicados = async () => {
    let query = supabase
      .from('comunicados')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    if (filterTipo === 'incendio') {
      query = query.ilike('titulo', '%INCENDIO%');
    } else if (filterTipo === 'siniestro') {
      query = query.ilike('titulo', '%SINIESTRO%');
    } else if (filterTipo === 'otros') {
      query = query.not('titulo', 'ilike', '%INCENDIO%').not('titulo', 'ilike', '%SINIESTRO%');
    }

    const { data } = await query;
    if (data) setHistorial(data);
  };

  const sendPushNotification = async (title: string, body: string, priority: string) => {
    // Obtener todos los tokens válidos
    const { data: socios } = await supabase
      .from('socios')
      .select('push_token')
      .not('push_token', 'is', null)
      .neq('push_token', '');

    if (!socios || socios.length === 0) return;

    // Extraer solo los strings de los tokens
    const tokens = socios.map(s => s.push_token);

    // Preparar los mensajes para el API de Expo
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      priority: priority === 'peligro' ? 'high' : 'default',
    }));

    // Enviar en bloques usando el API de Expo (Chunking automático recomendado por Expo)
    try {
      await fetch('/api/push', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch (e) {
      console.error('Error enviando push:', e);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !mensaje) return;
    
    setLoading(true);
    const { error } = await supabase.from('comunicados').insert([
      { titulo, mensaje, severidad }
    ]);
    
    if (!error) {
      // 🚀 ENVIAR NOTIFICACIÓN PUSH A TODOS
      await sendPushNotification(titulo, mensaje, severidad);

      setTitulo('');
      setMensaje('');
      alert('¡Comunicado y Notificación Push enviados a toda la comunidad exitosamente!');
      fetchComunicados();
    } else {
      alert('Error al publicar: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Megaphone className="text-blue-400" />
          Emitir Aviso a la Comunidad
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulario */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-slate-300 mb-4 border-b border-slate-800 pb-2">Redactar Nuevo Aviso</h2>
          <form onSubmit={handlePublish} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Nivel de Severidad</label>
              <select 
                value={severidad}
                onChange={(e) => setSeveridad(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
              >
                <option value="informativo">🟢 Informativo (Recomendaciones, rutas)</option>
                <option value="precaucion">🟡 Precaución (Alerta meteorológica, niebla)</option>
                <option value="peligro">🔴 Peligro Inminente (Evacuación, catástrofe)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Título Corto</label>
              <input 
                type="text" 
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                placeholder="Ej: Toque de Sirena por Accidente en Ruta 36"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-bold mb-2">Mensaje Detallado</label>
              <textarea 
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none h-32 resize-none"
                placeholder="Explique el motivo y recomendaciones para la población..."
              ></textarea>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4"
            >
              <Send size={20} />
              {loading ? 'EMITIENDO...' : 'EMITIR COMUNICADO A TODOS'}
            </button>
          </form>
        </div>

        {/* Historial Reciente */}
        <div className="flex flex-col h-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-300 flex items-center gap-2">
              <Search size={18} className="text-slate-500" /> 
              Buscar Avisos (Para Editar)
            </h2>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 font-bold mb-1">TIPO</label>
              <select 
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
              >
                <option value="todos">Todos</option>
                <option value="incendio">Incendios</option>
                <option value="siniestro">Siniestros</option>
                <option value="otros">Otros Avisos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-bold mb-1">DESDE</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-bold mb-1">HASTA</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm"
              />
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            {historial.map(com => (
              <div 
                key={com.id} 
                onClick={() => router.push(`/admin/comunicados/${com.id}`)}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 cursor-pointer hover:bg-slate-800 hover:border-blue-500/50 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">{com.titulo}</h3>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                    com.severidad === 'peligro' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    com.severidad === 'precaucion' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    'bg-green-500/20 text-green-400 border-green-500/30'
                  }`}>
                    {com.severidad.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-400 text-sm line-clamp-2">{com.mensaje}</p>
                <div className="flex justify-between items-center mt-3">
                  <div className="text-xs text-slate-500 font-mono">{new Date(com.created_at).toLocaleString()}</div>
                  <div className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Hacer clic para editar <AlertTriangle size={12}/>
                  </div>
                </div>
              </div>
            ))}
            
            {historial.length === 0 && (
              <div className="text-center p-8 text-slate-600 border border-dashed border-slate-800 rounded-lg">
                No se encontraron comunicados con estos filtros.
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}
