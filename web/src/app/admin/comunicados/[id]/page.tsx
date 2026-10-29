'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Edit2, Save, Trash2, ArrowLeft, Megaphone } from 'lucide-react';

export default function EditComunicado({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [severidad, setSeveridad] = useState('informativo');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchComunicado = async () => {
      const { data, error } = await supabase
        .from('comunicados')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        alert('No se encontró el comunicado');
        router.push('/admin/comunicados');
        return;
      }
      
      setTitulo(data.titulo);
      setMensaje(data.mensaje);
      setSeveridad(data.severidad);
      setLoading(false);
    };

    fetchComunicado();
  }, [id, router]);

  const sendPushNotification = async (title: string, body: string) => {
    const { data: socios } = await supabase
      .from('socios')
      .select('push_token')
      .not('push_token', 'is', null)
      .neq('push_token', '');

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

  const handleUpdate = async (withPush: boolean = false) => {
    if (!titulo || !mensaje) return;
    
    setSaving(true);
    const finalTitulo = withPush && !titulo.startsWith('ACTUALIZACIÓN:') 
      ? `ACTUALIZACIÓN: ${titulo}` 
      : titulo;

    const { error } = await supabase
      .from('comunicados')
      .update({ titulo: finalTitulo, mensaje, severidad })
      .eq('id', id);
    
    if (!error) {
      if (withPush) {
        await sendPushNotification(`🚨 ${finalTitulo}`, mensaje);
      }
      setSaving(false);
      alert('Comunicado actualizado correctamente' + (withPush ? ' y notificación push enviada a la comunidad.' : '.'));
      router.push('/admin/comunicados');
    } else {
      setSaving(false);
      alert('Error al actualizar: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de eliminar este aviso? Desaparecerá de la app de todos los vecinos.')) {
      setSaving(true);
      const { error } = await supabase.from('comunicados').delete().eq('id', id);
      setSaving(false);
      
      if (!error) {
        alert('Comunicado eliminado.');
        router.push('/admin/comunicados');
      } else {
        alert('Error al eliminar: ' + error.message);
      }
    }
  };

  if (loading) {
    return <div className="text-white text-center mt-20">Cargando aviso...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button 
        onClick={() => router.push('/admin/comunicados')}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Avisos
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3">
            <Edit2 className="text-blue-400" />
            Editar Aviso
          </h1>
          
          <button 
            onClick={handleDelete}
            className="w-full sm:w-auto justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <Trash2 size={16} /> Eliminar
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleUpdate(false); }} className="space-y-6">
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
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none h-48 resize-none"
              placeholder="Explique el motivo y recomendaciones para la población..."
            ></textarea>
            <p className="text-slate-500 text-xs mt-2">
              Nota: Guardar silenciosamente actualizará el texto en la app de todos los vecinos sin emitir sonido. Si desea alertar sobre una corrección de urgencia, utilice "Guardar y Enviar Push".
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <button 
              type="button" 
              disabled={saving}
              onClick={() => handleUpdate(false)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-4 rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              <Save size={18} />
              {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS (Silencioso)'}
            </button>
            <button 
              type="button" 
              disabled={saving}
              onClick={() => handleUpdate(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-colors flex justify-center items-center gap-2 shadow-lg shadow-blue-900/30"
            >
              <Megaphone size={18} />
              {saving ? 'ENVIANDO...' : 'GUARDAR Y ENVIAR PUSH'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
