"use client";

// ============================================================
// AuthProvider + useAuth hook
// ============================================================
// Expone: user (Firebase User | null), loading, signIn, signOut.
// Montado en el root layout para que toda la app tenga acceso.
// En el primer login, crea el documento users/{uid} en Firestore
// con los campos básicos vacíos (el perfil se llenará en Onboarding).

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ----- Tipos del contexto ---------------------------------------------------

interface AuthContextValue {
  /** Usuario de Firebase (null si no hay sesión) */
  user: FirebaseUser | null;
  /** true mientras se resuelve el estado inicial de autenticación */
  loading: boolean;
  /** Inicia sesión con Google (popup) */
  signIn: () => Promise<void>;
  /** Cierra sesión */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ----- Proveedor de Google --------------------------------------------------

const googleProvider = new GoogleAuthProvider();

// ----- Creación del documento de usuario en Firestore -----------------------

async function ensureUserDocument(firebaseUser: FirebaseUser): Promise<void> {
  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) return; // Ya existe → nada que hacer

  // Primera vez: crear con campos básicos vacíos según la interfaz User
  await setDoc(userRef, {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    displayName: firebaseUser.displayName ?? "",
    photoURL: firebaseUser.photoURL ?? "",

    // Perfil corporal — se llenará en la tanda de Onboarding
    age: 0,
    sex: "male",
    heightCm: 0,
    weightKg: 0,
    goal: "maintain",

    // Actividad física
    isActive: false,
    activities: [],

    // Metas calculadas — se calcularán cuando el perfil esté completo
    dailyCaloriesTarget: 0,
    dailyProteinGTarget: 0,
    dailyCarbsGTarget: 0,
    dailyFatGTarget: 0,

    // Hidratación
    dailyWaterLTarget: 2,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ----- AuthProvider ----------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Escucha cambios de sesión (incluye el estado inicial)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Asegurar que el documento de usuario exista en Firestore
        try {
          await ensureUserDocument(firebaseUser);
        } catch (err) {
          console.error("Error al crear documento de usuario:", err);
        }
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ----- Hook ------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }
  return ctx;
}
