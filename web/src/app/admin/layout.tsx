'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Users, ShieldAlert, LayoutDashboard, Megaphone, UserCog, LogOut, Menu, X } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('rol');
    localStorage.removeItem('usuario');
    window.location.href = '/login';
  };

  return (
    <ProtectedRoute adminOnly={true}>
      <div className="flex flex-col lg:flex-row h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
        {/* Barra Superior Móvil (Visible solo en celulares/tablets verticales) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-white border border-slate-700 hover:bg-slate-700"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div>
              <h2 className="text-base font-black text-white tracking-wide leading-tight">ADMINISTRACIÓN</h2>
              <p className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">Bomberos Verónica</p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-bold"
          >
            <ShieldAlert size={16} />
            <span>Alertas</span>
          </Link>
        </header>

        {/* Menú Desplegable Móvil (Overlay) */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/75 z-40 flex"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 h-full flex flex-col shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-black text-white">MENÚ DE GESTIÓN</h2>
                  <p className="text-slate-400 text-xs">Módulo Interno</p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X size={22} />
                </button>
              </div>

              <nav className="flex-1 space-y-2 overflow-y-auto">
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 font-semibold"
                >
                  <LayoutDashboard size={20} />
                  <span>Resumen</span>
                </Link>

                <Link
                  href="/admin/socios"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 font-medium"
                >
                  <Users size={20} />
                  <span>Gestión de Socios</span>
                </Link>

                <Link
                  href="/admin/comunicados"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 font-medium"
                >
                  <Megaphone size={20} />
                  <span>Avisos a Comunidad</span>
                </Link>

                <Link
                  href="/admin/operadores"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 font-medium"
                >
                  <UserCog size={20} />
                  <span>Gestión de Operadores</span>
                </Link>

                <div className="my-4 border-t border-slate-800"></div>

                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 font-bold"
                >
                  <ShieldAlert size={20} />
                  <span>Volver a Consola de Alertas</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white mt-4"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Cerrar Sesión</span>
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Sidebar de Administración (Escritorio) */}
        <div className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shadow-xl z-10 shrink-0">
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
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-500 hover:text-white mt-auto"
            >
              <LogOut size={20} />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </nav>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black">
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
