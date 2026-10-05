"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Contenedor de página móvil (ancho máximo, márgenes y espacio para el bottom nav) */
export function Page({
  children,
  className,
  withNav = true,
}: {
  children: ReactNode;
  className?: string;
  withNav?: boolean;
}) {
  return (
    <main
      className={cn(
        "w-full max-w-md mx-auto px-4 pt-6 flex flex-col gap-5",
        withNav ? "pb-28" : "pb-10",
        className,
      )}
    >
      {children}
    </main>
  );
}

/** Encabezado de página con título, subtítulo, botón volver opcional y acción */
export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  /** true = router.back(); string = ruta a la que volver */
  back?: boolean | string;
  action?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-2">
      {back && (
        <button
          type="button"
          onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-subtle cursor-pointer shrink-0"
          aria-label="Volver"
        >
          <ChevronLeftIcon />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** Mensaje de error en línea */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm rounded-xl px-3.5 py-2.5 bg-danger-muted text-danger">
      {children}
    </p>
  );
}

/** Estado vacío con icono, texto y acción */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-6">
      {icon && <div className="text-text-disabled mb-1">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-text-secondary max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
