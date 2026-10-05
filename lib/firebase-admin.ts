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
import { resolveServiceAccount } from "@/lib/server/service-account";

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  // Emuladores (pruebas locales): no se necesitan credenciales reales
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }

  // La service account se provee como JSON completo (FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)
  // o como campos individuales (útil en Vercel/Railway). resolveServiceAccount normaliza
  // comillas, saltos de línea y \n escapados, y falla con un error que no incluye secretos.
  return initializeApp({ credential: cert(resolveServiceAccount(process.env)) });
}

export function getAdminAuth(): Auth {
  return getAuth(createAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(createAdminApp());
}
