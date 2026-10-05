// Validación de imágenes recibidas por la API (puro, testeable)

/** Tamaño máximo aceptado por el servidor (el cliente comprime a ~150-400 KB) */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Largo máximo de los textos que acompañan el análisis */
export const MAX_HINT_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 500;

export type SupportedImageType = "image/jpeg" | "image/png" | "image/webp";

/**
 * Detecta el tipo real por los "magic bytes" (no se confía en el
 * Content-Type declarado por el cliente).
 */
export function detectImageType(bytes: Uint8Array): SupportedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}
