"use client";

// Registro por foto: elegir/tomar foto → comprimir → enviar a la IA.
// La foto vive solo en memoria del navegador (object URL) y en la petición;
// no se sube a Storage ni se guarda en ningún lado.

import { useEffect, useRef, useState } from "react";
import { analyzeMealPhoto, ApiError, type AnalyzeResponse } from "@/lib/api-client";
import { compressImage, ImageCompressError } from "@/lib/image-compress";
import { MAX_HINT_LENGTH } from "@/lib/ai/image";
import { Button } from "@/components/ui/button";
import { CameraIcon, CloseIcon, SparkIcon } from "@/components/ui/icons";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function PhotoPanel({
  onResult,
  onFallback,
}: {
  onResult: (res: AnalyzeResponse) => void;
  /** Ir a búsqueda/manual cuando la IA no está disponible */
  onFallback: (tab: "search" | "manual") => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [hint, setHint] = useState("");
  const [status, setStatus] = useState<"idle" | "compressing" | "analyzing">("idle");
  const [error, setError] = useState<{ message: string; quota?: boolean } | null>(null);

  // Libera el object URL al cambiar de foto o salir
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStatus("compressing");
    try {
      const blob = await compressImage(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError({ message: err instanceof ImageCompressError ? err.message : "No pudimos leer esa imagen." });
    } finally {
      setStatus("idle");
    }
  };

  const analyze = async () => {
    if (!photo) return;
    setError(null);
    setStatus("analyzing");
    try {
      onResult(await analyzeMealPhoto(photo.blob, hint));
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      const quota = apiErr?.status === 429 || apiErr?.code === "not_configured";
      let message = apiErr?.message ?? "No se pudo analizar la foto. Intenta de nuevo.";
      if (apiErr?.code === "rate_limited" && apiErr.retryAfterSeconds) {
        message = `${message} (${apiErr.retryAfterSeconds} s)`;
      }
      setError({ message, quota });
    } finally {
      setStatus("idle");
    }
  };

  const reset = () => {
    setPhoto(null);
    setHint("");
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Elegir foto de la galería"
        data-testid="photo-input"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {!photo ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={status !== "idle"}
            className="aspect-[4/3] w-full rounded-3xl border-2 border-dashed border-border bg-bg-surface flex flex-col items-center justify-center gap-3 text-text-secondary hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:opacity-60"
          >
            <span className="w-16 h-16 rounded-full bg-primary-muted text-primary flex items-center justify-center">
              <CameraIcon size={30} />
            </span>
            <span className="font-semibold text-text-primary">
              {status === "compressing" ? "Preparando foto…" : "Tomar foto"}
            </span>
            <span className="text-xs max-w-60 text-center">
              Encuadra el plato completo desde arriba, con buena luz.
            </span>
          </button>
          <Button variant="secondary" onClick={() => galleryRef.current?.click()} disabled={status !== "idle"}>
            Elegir de la galería
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-3xl bg-bg-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL local, no optimizable */}
            <img src={photo.url} alt="Foto de tu comida" className="w-full max-h-80 object-cover" />
            {status === "analyzing" && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 text-white">
                <SparkIcon size={28} className="animate-pulse" />
                <span className="text-sm font-medium">Analizando tu comida…</span>
              </div>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={status === "analyzing"}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
              aria-label="Quitar foto"
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Detalles <span className="font-normal text-text-secondary">(opcional)</span>
            </span>
            <textarea
              className={cn(inputClasses, "h-auto min-h-20 py-3 resize-none")}
              placeholder="Ej: frito en aceite, sin azúcar, porción doble…"
              maxLength={MAX_HINT_LENGTH}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
            />
          </label>
          <Button size="lg" fullWidth onClick={analyze} loading={status === "analyzing"}>
            <SparkIcon size={18} /> Analizar con IA
          </Button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl bg-danger-muted text-danger p-4 flex flex-col gap-3">
          <p className="text-sm">{error.message}</p>
          {error.quota && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => onFallback("search")}>
                Buscar alimento
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onFallback("manual")}>
                Ingresar a mano
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-text-secondary text-center">
        🔒 La foto se usa solo para el análisis y no se guarda.
      </p>
    </div>
  );
}
