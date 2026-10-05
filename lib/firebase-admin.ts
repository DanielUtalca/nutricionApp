// ============================================================
// Firebase Admin SDK — solo para Route Handlers (server-side)
// ============================================================
// NUNCA importar este archivo desde componentes cliente.
// Variables de entorno requeridas (ver .env.example).
//
// Inicialización perezosa: el build no necesita credenciales y un error
// de configuración se reporta en la petición, no al importar el módulo.

import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  // Emuladores (pruebas locales): no se necesitan credenciales reales
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }

  // La service account key se puede proveer como JSON string completo
  // o bien como campos individuales en las variables de entorno.
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  }

  // Fallback: campos individuales (útil para plataformas como Vercel/Railway)
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Las nuevas líneas en la private key se escapan como \n en .env
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(createAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(createAdminApp());
}
