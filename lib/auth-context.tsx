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
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, USE_EMULATORS } from "@/lib/firebase";
import {
  canFallbackToRedirect,
  pickSignInMethod,
  shouldFallbackToRedirect,
  type SignInContext,
} from "@/lib/auth-strategy";

// ----- Tipos del contexto ---------------------------------------------------

interface AuthContextValue {
  /** Usuario de Firebase (null si no hay sesión) */
  user: FirebaseUser | null;
  /** true mientras se resuelve el estado inicial de autenticación */
  loading: boolean;
  /** Código de error (`auth/...`) si el login por redirect falló al volver a la app */
  redirectError: string | null;
  /** Inicia sesión con Google (popup en escritorio, redirect en móvil/PWA) */
  signIn: () => Promise<void>;
  /** Cierra sesión */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ----- Proveedor de Google --------------------------------------------------

const googleProvider = new GoogleAuthProvider();
// Permite elegir cuenta aunque el navegador ya tenga una de Google abierta
googleProvider.setCustomParameters({ prompt: "select_account" });

/** Señales del navegador actual para elegir popup o redirect (solo en el cliente) */
export function getSignInContext(): SignInContext {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    host: window.location.host,
    emulators: USE_EMULATORS,
  };
}

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
  const [redirectError, setRedirectError] = useState<string | null>(null);

  // Al volver de Google tras `signInWithRedirect`, el SDK ya deja la sesión lista
  // (onAuthStateChanged); esta llamada solo sirve para enterarnos si falló.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      console.error("Error al volver del login con Google:", err);
      setRedirectError((err as { code?: string })?.code ?? "auth/unknown");
    });
  }, []);

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
    setRedirectError(null);
    const ctx = getSignInContext();
    if (pickSignInMethod(ctx) === "redirect") {
      // La página navega a Google; esta promesa no se resuelve en este documento
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      // Popup bloqueado o sin soporte: si el proxy de mismo dominio está activo, redirect
      if (shouldFallbackToRedirect((err as { code?: string })?.code) && canFallbackToRedirect(ctx)) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw err;
    }
  }, []);

  // Solo con emuladores (pruebas E2E): login sin popup con una credencial
  // de Google falsa que el emulador de Auth acepta. No existe en producción.
  useEffect(() => {
    // Condición literal para que el build de producción elimine este bloque
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true") return;
    const w = window as unknown as { __testSignIn?: (email: string, name?: string) => Promise<void> };
    w.__testSignIn = async (email, name = "Usuario Prueba") => {
      const credential = GoogleAuthProvider.credential(
        JSON.stringify({ sub: email, email, email_verified: true, name }),
      );
      await signInWithCredential(auth, credential);
    };
    return () => {
      delete w.__testSignIn;
    };
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, redirectError, signIn, signOut }}>
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
