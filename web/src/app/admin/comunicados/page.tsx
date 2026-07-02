'use client';
import { useState, useEffect } from 'react';
import { Megaphone, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Comunicados() {
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [severidad, setSeveridad] = useState('informativo');
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => {
    fetchComunicados();
  }, []);

  const fetchComunicados = async () => {
    const { data } = await supabase
      .from('comunicados')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setHistorial(data);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !mensaje) return;
    
    setLoading(true);
    const { error } = await supabase.from('comunicados').insert([
      { titulo, mensaje, severidad }
    ]);
    
    setLoading(false);
    if (!error) {
      setTitulo('');
      setMensaje('');
      alert('¡Comunicado publicado a la comunidad exitosamente!');
      fetchComunicados();
    } else {
      alert('Error al publicar: ' + error.message);
    }
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
        <div>
          <h2 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-slate-500" /> 
            Últimos 10 Avisos Emitidos
          </h2>
          <div className="space-y-4">
            {historial.map(com => (
              <div key={com.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-white text-lg">{com.titulo}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                    com.severidad === 'peligro' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    com.severidad === 'precaucion' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    'bg-green-500/20 text-green-400 border-green-500/30'
                  }`}>
                    {com.severidad.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{com.mensaje}</p>
                <div className="text-xs text-slate-600 mt-3">{new Date(com.created_at).toLocaleString()}</div>
              </div>
            ))}
            
            {historial.length === 0 && (
              <div className="text-center p-8 text-slate-600 border border-dashed border-slate-800 rounded-lg">
                No hay comunicados recientes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
