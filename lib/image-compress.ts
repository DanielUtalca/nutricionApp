"use client";

// ============================================================
// Compresión de fotos en el navegador antes de enviarlas a la IA
// ============================================================
// Una foto de celular pesa 3-12 MB; redimensionada a 1024 px y JPEG 0.8
// queda en ~150-400 KB: sube rápido con datos móviles, cabe en el límite
// del servidor (3 MB; Vercel corta en ~4,5 MB) y a la IA le sobra
// resolución para reconocer comida.

export const MAX_DIMENSION = 1024;
export const JPEG_QUALITY = 0.8;
/** Tope de entrada para no colgar el navegador con archivos gigantes */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
/** Si el JPEG queda más pesado que esto se vuelve a comprimir más fuerte */
export const TARGET_OUTPUT_BYTES = 1.5 * 1024 * 1024;
/** Tope duro de salida (el servidor acepta hasta 3 MB) */
export const MAX_OUTPUT_BYTES = 2.5 * 1024 * 1024;

/** Intentos de compresión, de mayor a menor calidad; casi siempre basta el primero */
export const COMPRESSION_STEPS = [
  { maxDimension: MAX_DIMENSION, quality: JPEG_QUALITY },
  { maxDimension: 800, quality: 0.6 },
  { maxDimension: 640, quality: 0.5 },
] as const;

export class ImageCompressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageCompressError";
  }
}

/** Escala (sin agrandar) para que el lado mayor no pase de `maxDimension` */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function isHeic(file: Blob): boolean {
  const name = (file as File).name ?? "";
  return /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(name);
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // createImageBitmap respeta la orientación EXIF (fotos verticales de iPhone)
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fallback a <img> (p. ej. HEIC en Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } catch {
    throw new ImageCompressError(
      isHeic(file)
        ? "Tu navegador no puede leer fotos HEIC. Elige una JPG o PNG, o cambia la cámara a «Más compatible»."
        : "No pudimos leer esa imagen. Prueba con otra foto (JPG o PNG).",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function render(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageCompressError("Tu navegador no permite procesar imágenes.");
  // Fondo blanco: los PNG transparentes no quedan negros al pasar a JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new ImageCompressError("No pudimos comprimir la foto.");
  return blob;
}

/** Redimensiona y recomprime a JPEG. Devuelve el blob listo para enviar. */
export async function compressImage(file: Blob): Promise<Blob> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new ImageCompressError("El archivo no es una imagen.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageCompressError("La foto es demasiado grande (máx. 25 MB).");
  }

  const img = await decode(file);
  try {
    let blob: Blob | null = null;
    for (const step of COMPRESSION_STEPS) {
      const { width, height } = fitWithin(img.width, img.height, step.maxDimension);
      blob = await render(img.source, width, height, step.quality);
      if (blob.size <= TARGET_OUTPUT_BYTES) return blob;
    }
    if (!blob || blob.size > MAX_OUTPUT_BYTES) {
      throw new ImageCompressError("No pudimos reducir lo suficiente esa foto. Prueba con otra.");
    }
    return blob;
  } finally {
    img.close();
  }
}
