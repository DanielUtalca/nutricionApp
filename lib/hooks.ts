"use client";

// ============================================================
// hooks.ts — Suscripciones en tiempo real a Firestore
// ============================================================

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CollectionState<T> {
  key?: string;
  data: T[];
  error: string | null;
}

/**
 * Escucha una colección/consulta. `key` identifica la consulta: al cambiar,
 * se re-suscribe. Mientras llega el primer snapshot de la nueva clave,
 * `loading` es true y `data` queda vacío.
 */
export function useCollection<T extends { id: string }>(
  path: string | null,
  constraints: QueryConstraint[],
  key: string,
): { data: T[]; loading: boolean; error: string | null } {
  const [state, setState] = useState<CollectionState<T>>({ data: [], error: null });
  const fullKey = path ? `${path}|${key}` : undefined;

  useEffect(() => {
    if (!path || !fullKey) return;
    const q = query(collection(db, path), ...constraints);
    return onSnapshot(
      q,
      (snap) =>
        setState({
          key: fullKey,
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as T),
          error: null,
        }),
      (err) => {
        console.error(`Error escuchando ${path}:`, err);
        setState({ key: fullKey, data: [], error: "No se pudieron cargar los datos." });
      },
    );
    // `constraints` se recrea en cada render; `fullKey` representa su identidad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const loading = Boolean(fullKey) && state.key !== fullKey;
  return { data: loading ? [] : state.data, loading, error: loading ? null : state.error };
}

/** Escucha un documento puntual (null si no existe) */
export function useDocument<T>(path: string | null): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{ path?: string; data: T | null; error: string | null }>({
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db, path),
      (snap) =>
        setState({
          path,
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null,
          error: null,
        }),
      (err) => {
        console.error(`Error escuchando ${path}:`, err);
        setState({ path, data: null, error: "No se pudieron cargar los datos." });
      },
    );
  }, [path]);

  const loading = Boolean(path) && state.path !== path;
  return { data: loading ? null : state.data, loading, error: loading ? null : state.error };
}
