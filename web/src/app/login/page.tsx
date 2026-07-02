'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, KeyRound, UserRound } from 'lucide-react';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase
        .from('operadores')
        .select('*')
        .eq('usuario', usuario)
        .eq('password', password)
        .single();

      if (error || !data) {
        setErrorMsg('Credenciales incorrectas');
        setLoading(false);
        return;
      }

      if (!data.activo) {
        setErrorMsg('Esta cuenta está suspendida');
        setLoading(false);
        return;
      }

      // Guardar sesión en el cliente
      localStorage.setItem('rol', data.rol);
      localStorage.setItem('usuario', data.usuario);

      // Redirigir al inicio
      window.location.href = '/';

    } catch (err) {
      setErrorMsg('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <ShieldAlert className="text-red-500 mb-2" size={48} />
          <h1 className="text-2xl font-black text-white tracking-wide">ACCESO RESTRINGIDO</h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-semibold">Bomberos Verónica</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-center text-sm font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Usuario</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Nombre de usuario"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Contraseña</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold text-sm transition-colors border shadow-lg 
              ${loading ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-900/50'}`}
          >
            {loading ? 'VERIFICANDO...' : 'INGRESAR AL SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  );
}
