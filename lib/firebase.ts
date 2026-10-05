// ============================================================
// Firebase Client SDK — inicialización del lado del cliente
// ============================================================
// Variables de entorno requeridas (ver .env.example)

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Solo para pruebas locales/E2E: conecta a los emuladores de Firebase */
export const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const isFirstInit = getApps().length === 0;

// Evita reinicializar si ya existe una instancia (hot reload en dev)
const app: FirebaseApp = isFirstInit ? initializeApp(firebaseConfig) : getApp();

const auth: Auth = getAuth(app);

// Caché persistente (IndexedDB) en el navegador: la app abre rápido y
// funciona sin conexión; en el servidor (prerender) usamos memoria.
const db: Firestore = isFirstInit
  ? initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache:
        typeof window !== "undefined" && !USE_EMULATORS
          ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          : memoryLocalCache(),
    })
  : getFirestore(app);

if (USE_EMULATORS && isFirstInit && typeof window !== "undefined") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export { app, auth, db };
