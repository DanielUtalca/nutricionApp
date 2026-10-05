// ============================================================
// Credenciales de Firebase Admin desde variables de entorno (puro)
// ============================================================
// Pegar el JSON de la service account en el panel de Vercel falla de formas
// sutiles: entre comillas, con saltos de línea reales dentro de `private_key`,
// con `\\n` doblemente escapado... Aquí se normalizan esos casos y, si algo no
// sirve, el error dice QUÉ falta sin incluir nunca el valor (es un secreto).

export interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export class ServiceAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceAccountError";
  }
}

/** Convierte saltos de línea reales dentro de strings JSON en `\n` escapado */
function escapeNewlinesInStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
      } else if (ch === "\\") {
        escaped = true;
        out += ch;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch !== "\r") {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

function stripWrappingQuotes(value: string): string {
  const v = value.trim();
  const first = v[0];
  if (v.length >= 2 && (first === '"' || first === "'") && v[v.length - 1] === first) return v.slice(1, -1);
  return v;
}

function normalizePrivateKey(value: string): string {
  return stripWrappingQuotes(value).replace(/\\n/g, "\n").trim();
}

function validate(projectId: unknown, clientEmail: unknown, privateKey: unknown): ServiceAccountCredentials {
  const missing: string[] = [];
  if (typeof projectId !== "string" || !projectId.trim()) missing.push("project_id");
  if (typeof clientEmail !== "string" || !clientEmail.trim()) missing.push("client_email");
  if (typeof privateKey !== "string" || !privateKey.trim()) missing.push("private_key");
  if (missing.length) {
    throw new ServiceAccountError(`Credenciales de Firebase Admin incompletas: falta ${missing.join(", ")}.`);
  }
  const key = normalizePrivateKey(privateKey as string);
  if (!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(key)) {
    throw new ServiceAccountError("La private_key de Firebase Admin no tiene el formato PEM esperado (-----BEGIN PRIVATE KEY-----).");
  }
  return { projectId: (projectId as string).trim(), clientEmail: (clientEmail as string).trim(), privateKey: key };
}

/** Parsea el contenido de FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON */
export function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  let text = raw.replace(/^﻿/, "").trim();
  if (!text) throw new ServiceAccountError("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON está vacío.");

  const attempt = (candidate: string): unknown => {
    try {
      return JSON.parse(candidate);
    } catch {
      return JSON.parse(escapeNewlinesInStrings(candidate));
    }
  };

  let parsed: unknown;
  try {
    parsed = attempt(text);
    // JSON doblemente codificado: "{\"type\":\"service_account\",...}"
    if (typeof parsed === "string") parsed = attempt(parsed);
  } catch {
    // Quizá venga entre comillas simples o dobles sueltas
    text = stripWrappingQuotes(text);
    try {
      parsed = attempt(text);
    } catch {
      throw new ServiceAccountError(
        "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON no es un JSON válido. Pega el archivo de la service account completo, en una sola línea.",
      );
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ServiceAccountError("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON no contiene un objeto JSON.");
  }
  const o = parsed as Record<string, unknown>;
  return validate(o.project_id ?? o.projectId, o.client_email ?? o.clientEmail, o.private_key ?? o.privateKey);
}

export interface ServiceAccountEnv {
  // Permite pasar `process.env` completo
  [key: string]: string | undefined;
  FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON?: string;
  FIREBASE_ADMIN_PROJECT_ID?: string;
  FIREBASE_ADMIN_CLIENT_EMAIL?: string;
  FIREBASE_ADMIN_PRIVATE_KEY?: string;
}

/**
 * Credenciales desde el entorno: el JSON completo si está definido; si no sirve
 * y hay campos sueltos completos, usa esos. Lanza ServiceAccountError si ninguno vale.
 */
export function resolveServiceAccount(env: ServiceAccountEnv): ServiceAccountCredentials {
  const json = env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  const hasParts = !!(env.FIREBASE_ADMIN_PROJECT_ID && env.FIREBASE_ADMIN_CLIENT_EMAIL && env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (json?.trim()) {
    try {
      return parseServiceAccountJson(json);
    } catch (err) {
      if (!hasParts) throw err;
      // JSON inservible pero hay campos sueltos: se sigue con ellos
    }
  }

  if (!hasParts && !json?.trim()) {
    throw new ServiceAccountError(
      "Faltan las credenciales de Firebase Admin: define FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON o FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }
  return validate(
    stripWrappingQuotes(env.FIREBASE_ADMIN_PROJECT_ID ?? ""),
    stripWrappingQuotes(env.FIREBASE_ADMIN_CLIENT_EMAIL ?? ""),
    env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}
