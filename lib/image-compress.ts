"use client";

// ============================================================
// Compresión de fotos en el navegador antes de enviarlas a la IA
// ============================================================
// Una foto de celular pesa 3-12 MB; redimensionada a 1024 px y JPEG 0.8
// queda en ~150-400 KB: sube rápido con datos móviles, cabe en el límite
// del servidor y a la IA le sobra resolución para reconocer comida.

export const MAX_DIMENSION = 1024;
export const JPEG_QUALITY = 0.8;
/** Tope de entrada para no colgar el navegador con archivos gigantes */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export class ImageCompressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageCompressError";
  }
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
    throw new ImageCompressError("No pudimos leer esa imagen. Prueba con otra foto (JPG o PNG).");
  } finally {
    URL.revokeObjectURL(url);
  }
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
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageCompressError("Tu navegador no permite procesar imágenes.");
    // Fondo blanco: los PNG transparentes no quedan negros al pasar a JPEG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new ImageCompressError("No pudimos comprimir la foto.");
    return blob;
  } finally {
    img.close();
  }
}
