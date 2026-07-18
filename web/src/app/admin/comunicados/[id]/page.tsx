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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !mensaje) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('comunicados')
      .update({ titulo, mensaje, severidad })
      .eq('id', id);
    
    setSaving(false);
    if (!error) {
      alert('Comunicado actualizado correctamente.');
      router.push('/admin/comunicados');
    } else {
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl">
        <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Edit2 className="text-blue-400" />
            Editar Aviso
          </h1>
          
          <button 
            onClick={handleDelete}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <Trash2 size={16} /> Eliminar
          </button>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
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
              Nota: Guardar estos cambios actualizará el texto en la app de todos los vecinos instantáneamente. No se enviará una nueva notificación sonora. Si desea ocultar el aviso de la app, utilice el botón Eliminar.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4"
          >
            <Save size={20} />
            {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        </form>
      </div>
    </div>
  );
}
