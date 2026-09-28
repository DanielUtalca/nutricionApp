"use client";

// ============================================================
// Home — /home (placeholder tanda 2)
// ============================================================
// Muestra "Bienvenido, {nombre}" y un botón de cerrar sesión.

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
      {/* Avatar + saludo */}
      <div className="flex flex-col items-center gap-4">
        {user?.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName ?? "Avatar"}
            className="w-20 h-20 rounded-full shadow-md"
            referrerPolicy="no-referrer"
          />
        )}

        <h1
          className="text-3xl font-bold tracking-tight text-center"
          style={{ color: "var(--text-primary)" }}
        >
          Bienvenido, {user?.displayName?.split(" ")[0] ?? "usuario"}
        </h1>

        <p
          className="text-sm text-center"
          style={{ color: "var(--text-secondary)" }}
        >
          Esta pantalla se completará en las próximas tandas con tu resumen
          diario de calorías y macros.
        </p>
      </div>

      {/* Botón cerrar sesión */}
      <button
        id="sign-out-button"
        onClick={handleSignOut}
        className="px-6 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
        style={{
          backgroundColor: "var(--bg-subtle)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-base)",
        }}
      >
        Cerrar sesión
      </button>
    </main>
  );
}
