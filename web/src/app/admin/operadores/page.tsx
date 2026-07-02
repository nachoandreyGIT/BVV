'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserCog, Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';

export default function OperadoresPage() {
  const [operadores, setOperadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ usuario: '', password: '', rol: 'cuartelero' });

  useEffect(() => {
    fetchOperadores();
  }, []);

  const fetchOperadores = async () => {
    setLoading(true);
    const { data } = await supabase.from('operadores').select('*').order('created_at', { ascending: false });
    if (data) setOperadores(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.usuario || !formData.password) return;

    const { error } = await supabase.from('operadores').insert([formData]);
    if (error) {
      alert('Error al crear operador (quizás el usuario ya existe)');
    } else {
      setFormData({ usuario: '', password: '', rol: 'cuartelero' });
      setShowModal(false);
      fetchOperadores();
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('operadores').update({ activo: !currentStatus }).eq('id', id);
    fetchOperadores();
  };

  const deleteOperador = async (id: string, usuario: string) => {
    if(usuario === 'admin') {
      alert('No puedes eliminar al administrador principal.');
      return;
    }
    if(confirm(`¿Estás seguro de eliminar a ${usuario}?`)) {
      await supabase.from('operadores').delete().eq('id', id);
      fetchOperadores();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <UserCog className="text-blue-500" />
            Gestión de Operadores
          </h1>
          <p className="text-slate-400 mt-1">Crea cuentas para los cuarteleros o nuevos administradores.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
        >
          <Plus size={20} />
          NUEVO OPERADOR
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold border-b border-slate-800">
            <tr>
              <th className="p-4">Usuario</th>
              <th className="p-4">Rol</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center text-slate-500">Cargando...</td></tr>
            ) : (
              operadores.map(op => (
                <tr key={op.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-medium text-white">{op.usuario}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${op.rol === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-300 border border-slate-600'}`}>
                      {op.rol.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${op.activo ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {op.activo ? 'ACTIVO' : 'BLOQUEADO'}
                    </span>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button 
                      onClick={() => toggleStatus(op.id, op.activo)}
                      className={`px-3 py-1 rounded border text-xs font-bold ${op.activo ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' : 'border-green-500/50 text-green-400 hover:bg-green-500/10'}`}
                    >
                      {op.activo ? 'BLOQUEAR' : 'DESBLOQUEAR'}
                    </button>
                    <button 
                      onClick={() => deleteOperador(op.id, op.usuario)}
                      className="p-1 text-slate-500 hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Crear Nuevo Operador</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-bold mb-1">USUARIO</label>
                <input 
                  type="text" 
                  value={formData.usuario}
                  onChange={e => setFormData({...formData, usuario: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-bold mb-1">CONTRASEÑA</label>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-bold mb-1">ROL</label>
                <select 
                  value={formData.rol}
                  onChange={e => setFormData({...formData, rol: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded p-2"
                >
                  <option value="cuartelero">Cuartelero (Solo ver alertas)</option>
                  <option value="admin">Administrador (Acceso total)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold">Crear Operador</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
