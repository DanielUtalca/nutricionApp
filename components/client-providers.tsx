"use client";

// ============================================================
// ClientProviders — wrapper "use client" para el root layout
// ============================================================
// El root layout (app/layout.tsx) es un Server Component, así que
// los providers que usan hooks del cliente van aquí.

import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
