"use client";

// ============================================================
// ProfileProvider + useProfile
// ============================================================
// Mantiene un único listener en tiempo real sobre users/{uid} para que
// todas las pantallas de la app compartan el mismo perfil y metas.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/types";

interface ProfileContextValue {
  profile: User | null;
  loading: boolean;
  error: string | null;
  /** Merge parcial sobre users/{uid} (actualiza updatedAt) */
  updateProfile: (fields: Partial<Omit<User, "uid" | "createdAt" | "updatedAt">>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState<{ uid?: string; profile: User | null; error: string | null }>(
    { profile: null, error: null },
  );

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => setState({ uid, profile: snap.exists() ? (snap.data() as User) : null, error: null }),
      (err) => {
        console.error("Error leyendo el perfil:", err);
        setState({ uid, profile: null, error: "No se pudo cargar tu perfil." });
      },
    );
  }, [uid]);

  const updateProfile = useCallback<ProfileContextValue["updateProfile"]>(
    async (fields) => {
      if (!uid) throw new Error("No hay sesión activa");
      await setDoc(doc(db, "users", uid), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
    },
    [uid],
  );

  // Mientras el snapshot corresponde a otro uid (o aún no llega) seguimos cargando
  const loading = !uid || state.uid !== uid;

  return (
    <ProfileContext.Provider
      value={{
        profile: loading ? null : state.profile,
        loading,
        error: loading ? null : state.error,
        updateProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile debe usarse dentro de un <ProfileProvider>");
  return ctx;
}
