import { describe, expect, it } from "vitest";
import { parseServiceAccountJson, resolveServiceAccount, ServiceAccountError } from "@/lib/server/service-account";

// Clave de relleno: solo importa el formato PEM, no es una credencial real
const PEM = "-----BEGIN PRIVATE KEY-----\nMIIFAKEFAKEFAKE\nabcdef\n-----END PRIVATE KEY-----\n";

const account = {
  type: "service_account",
  project_id: "demo-proyecto",
  private_key: PEM,
  client_email: "firebase-adminsdk@demo-proyecto.iam.gserviceaccount.com",
};

const expected = {
  projectId: "demo-proyecto",
  clientEmail: "firebase-adminsdk@demo-proyecto.iam.gserviceaccount.com",
  privateKey: PEM.trim(),
};

describe("parseServiceAccountJson", () => {
  it("lee el JSON en una sola línea con \\n escapados (el formato normal)", () => {
    expect(parseServiceAccountJson(JSON.stringify(account))).toEqual(expected);
  });

  it("tolera espacios, BOM y saltos de línea alrededor", () => {
    expect(parseServiceAccountJson(`﻿\n  ${JSON.stringify(account)}  \n`)).toEqual(expected);
  });

  it("tolera JSON con formato (varias líneas entre claves)", () => {
    expect(parseServiceAccountJson(JSON.stringify(account, null, 2))).toEqual(expected);
  });

  it("tolera saltos de línea reales dentro de private_key", () => {
    const raw = `{"project_id":"demo-proyecto","client_email":"${account.client_email}","private_key":"${PEM}"}`;
    expect(raw).toContain("PRIVATE KEY-----\nMIIFAKE"); // salto real, JSON.parse directo fallaría
    expect(parseServiceAccountJson(raw)).toEqual(expected);
  });

  it("tolera el JSON entre comillas simples o dobles", () => {
    expect(parseServiceAccountJson(`'${JSON.stringify(account)}'`)).toEqual(expected);
    expect(parseServiceAccountJson(JSON.stringify(JSON.stringify(account)))).toEqual(expected);
  });

  it("tolera \\n doblemente escapado en private_key", () => {
    const double = { ...account, private_key: PEM.replace(/\n/g, "\\n") };
    expect(parseServiceAccountJson(JSON.stringify(double))).toEqual(expected);
  });

  it("acepta claves en camelCase", () => {
    const camel = { projectId: account.project_id, clientEmail: account.client_email, privateKey: PEM };
    expect(parseServiceAccountJson(JSON.stringify(camel))).toEqual(expected);
  });

  it("rechaza JSON roto sin incluir el contenido en el error", () => {
    const secret = "SECRETO-NO-DEBE-APARECER";
    try {
      parseServiceAccountJson(`{"private_key": "${secret}`);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceAccountError);
      expect((err as Error).message).not.toContain(secret);
      expect((err as Error).message).toMatch(/JSON válido/);
    }
  });

  it("indica qué campos faltan", () => {
    expect(() => parseServiceAccountJson(JSON.stringify({ project_id: "x" }))).toThrow(/client_email, private_key/);
  });

  it("rechaza una private_key que no es PEM", () => {
    expect(() => parseServiceAccountJson(JSON.stringify({ ...account, private_key: "no-es-pem" }))).toThrow(/PEM/);
  });

  it("rechaza vacío y valores que no son objetos", () => {
    expect(() => parseServiceAccountJson("   ")).toThrow(/vacío/);
    expect(() => parseServiceAccountJson("123")).toThrow(/objeto/);
  });
});

describe("resolveServiceAccount", () => {
  const parts = {
    FIREBASE_ADMIN_PROJECT_ID: "demo-proyecto",
    FIREBASE_ADMIN_CLIENT_EMAIL: account.client_email,
    FIREBASE_ADMIN_PRIVATE_KEY: PEM.replace(/\n/g, "\\n"),
  };

  it("prefiere el JSON cuando es válido", () => {
    const env = { FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: JSON.stringify(account), ...parts, FIREBASE_ADMIN_PROJECT_ID: "otro" };
    expect(resolveServiceAccount(env).projectId).toBe("demo-proyecto");
  });

  it("usa los campos sueltos (con \\n literales y comillas) si no hay JSON", () => {
    expect(resolveServiceAccount({ ...parts, FIREBASE_ADMIN_PRIVATE_KEY: `"${parts.FIREBASE_ADMIN_PRIVATE_KEY}"` })).toEqual(expected);
  });

  it("cae a los campos sueltos si el JSON es inservible", () => {
    expect(resolveServiceAccount({ FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: "{roto", ...parts })).toEqual(expected);
  });

  it("falla con el error del JSON si no hay campos sueltos de respaldo", () => {
    expect(() => resolveServiceAccount({ FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: "{roto" })).toThrow(/JSON válido/);
  });

  it("falla con un mensaje claro si no hay nada configurado", () => {
    expect(() => resolveServiceAccount({})).toThrow(/Faltan las credenciales/);
  });
});
