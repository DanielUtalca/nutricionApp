"use client";

// ============================================================
// Layout protegido para las rutas de la app autenticada
// ============================================================
// Si no hay sesión, redirige a /login.
// Mientras se verifica el estado de auth, muestra un spinner.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Mientras se resuelve el auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // Si no hay usuario, no renderizamos nada (el useEffect redirige)
  if (!user) return null;

  return <>{children}</>;
}
