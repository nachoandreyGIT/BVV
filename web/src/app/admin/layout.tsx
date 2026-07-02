'use client';
import Link from 'next/link';
import { Users, BarChart3, ShieldAlert, LayoutDashboard, Megaphone, UserCog, LogOut } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute adminOnly={true}>
      <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Sidebar de Administración */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-800 bg-slate-950">
          <h2 className="text-xl font-black text-white tracking-wide">ADMINISTRACIÓN</h2>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-semibold">Módulo Interno</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
            <LayoutDashboard size={20} />
            <span className="font-semibold">Resumen</span>
          </Link>
          
          <Link href="/admin/socios" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
            <Users size={20} />
            <span className="font-medium">Gestión de Socios</span>
          </Link>
          
          <Link href="/admin/comunicados" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
            <Megaphone size={20} />
            <span className="font-medium">Avisos a Comunidad</span>
          </Link>

          <Link href="/admin/operadores" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
            <UserCog size={20} />
            <span className="font-medium">Gestión de Operadores</span>
          </Link>

          {/* Separador */}
          <div className="my-4 border-t border-slate-800"></div>

          <Link href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-red-900/30 transition-colors text-red-400 hover:text-red-300">
            <ShieldAlert size={20} />
            <span className="font-bold">Volver a Consola de Alertas</span>
          </Link>
          
          <button 
            onClick={() => {
              localStorage.removeItem('rol');
              localStorage.removeItem('usuario');
              window.location.href = '/login';
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-500 hover:text-white mt-auto"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </nav>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black">
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
      </div>
    </ProtectedRoute>
  );
}
