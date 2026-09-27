// ============================================================
// Firebase Admin SDK — solo para Route Handlers (server-side)
// ============================================================
// NUNCA importar este archivo desde componentes cliente.
// Variables de entorno requeridas (ver .env.example)

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

function createAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // La service account key se puede proveer como JSON string completo
  // o bien como campos individuales en las variables de entorno.
  const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    return initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  // Fallback: campos individuales (útil para plataformas como Vercel/Railway)
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Las nuevas líneas en la private key se escapan como \n en .env
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminApp: App = createAdminApp();

const adminAuth: Auth = getAuth(adminApp);
const adminDb: Firestore = getFirestore(adminApp);
const adminStorage: Storage = getStorage(adminApp);

export { adminApp, adminAuth, adminDb, adminStorage };
