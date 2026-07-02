'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const rol = localStorage.getItem('rol');
    
    if (!rol) {
      router.replace('/login');
      return;
    }

    if (adminOnly && rol !== 'admin') {
      router.replace('/'); // Redirigir a inicio si no es admin
      return;
    }

    setIsAuthenticated(true);
  }, [router, adminOnly, pathname]);

  if (!isAuthenticated) {
    return <div className="h-screen w-full bg-slate-950 flex items-center justify-center text-slate-400">Verificando acceso...</div>;
  }

  return <>{children}</>;
}
