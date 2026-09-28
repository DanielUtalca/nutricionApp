"use client";

// ============================================================
// Pantalla de Login — /login
// ============================================================
// Botón "Continuar con Google" con la paleta de NutriTrack.
// Si ya hay sesión activa, redirige directo a /home.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, redirige a /home
  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [loading, user, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signIn();
      // onAuthStateChanged se encarga de actualizar `user`,
      // el useEffect de arriba redirigirá a /home
    } catch (err: unknown) {
      console.error("Error al iniciar sesión:", err);
      // No mostrar error si el usuario simplemente cerró el popup
      const firebaseError = err as { code?: string };
      if (firebaseError.code !== "auth/popup-closed-by-user") {
        setError("No se pudo iniciar sesión. Intenta de nuevo.");
      }
      setSigningIn(false);
    }
  };

  // Mientras se resuelve el auth state, mostramos un spinner sutil
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        />
      </main>
    );
  }

  // Si ya tiene sesión, no renderizamos nada (el useEffect redirige)
  if (user) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[var(--bg-base)]">
      {/* Contenedor principal estilo card con sombra y borde sutil */}
      <div
        className="w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center gap-6 shadow-md transition-all duration-300"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-base)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Logo */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm"
          style={{ backgroundColor: "var(--color-primary-muted)" }}
        >
          <span role="img" aria-label="ensalada">
            🥗
          </span>
        </div>

        {/* Encabezado: Nombre de la app y mensaje de bienvenida */}
        <div className="flex flex-col gap-2">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            NutriTrack
          </h1>
          <p
            className="text-sm font-medium leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Tu dieta, sin suscripciones.
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--text-disabled)" }}
          >
            Registra tus comidas con IA, sigue tus macros y alcanza tus metas.
          </p>
        </div>

        {/* Separador sutil */}
        <div
          className="w-full h-px"
          style={{ backgroundColor: "var(--border-subtle)" }}
        />

        {/* Botón Google */}
        <button
          id="google-sign-in-button"
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-base)",
          }}
        >
          {signingIn ? (
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: "var(--color-primary)",
                borderTopColor: "transparent",
              }}
            />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span>{signingIn ? "Conectando…" : "Continuar con Google"}</span>
        </button>

        {/* Mensaje de error si falla el login */}
        {error && (
          <p
            className="text-xs px-3 py-2 rounded-lg w-full text-center"
            style={{
              backgroundColor: "var(--color-danger-muted)",
              color: "var(--color-danger)",
            }}
          >
            {error}
          </p>
        )}

        {/* Footer */}
        <p
          className="text-[11px] leading-tight"
          style={{ color: "var(--text-disabled)" }}
        >
          Sin costos · Sin suscripciones · Tus datos, solo tuyos
        </p>
      </div>
    </main>
  );
}
