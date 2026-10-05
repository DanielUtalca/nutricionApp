import { describe, expect, it } from "vitest";
import {
  COMPRESSION_STEPS,
  MAX_OUTPUT_BYTES,
  TARGET_OUTPUT_BYTES,
  fitWithin,
} from "@/lib/image-compress";
import { MAX_IMAGE_BYTES } from "@/lib/ai/image";

describe("fitWithin", () => {
  it("reduce una foto de 12 MP al lado mayor indicado manteniendo la proporción", () => {
    expect(fitWithin(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 });
  });

  it("nunca agranda imágenes pequeñas", () => {
    expect(fitWithin(640, 480, 1024)).toEqual({ width: 640, height: 480 });
  });

  it("no deja lados en cero con imágenes muy alargadas", () => {
    expect(fitWithin(10000, 2, 1024)).toEqual({ width: 1024, height: 1 });
  });
});

describe("pasos de compresión", () => {
  it("van de mayor a menor calidad y tamaño", () => {
    for (let i = 1; i < COMPRESSION_STEPS.length; i++) {
      expect(COMPRESSION_STEPS[i].quality).toBeLessThan(COMPRESSION_STEPS[i - 1].quality);
      expect(COMPRESSION_STEPS[i].maxDimension).toBeLessThan(COMPRESSION_STEPS[i - 1].maxDimension);
    }
  });

  it("el tope duro de salida cabe en lo que acepta el servidor", () => {
    expect(TARGET_OUTPUT_BYTES).toBeLessThan(MAX_OUTPUT_BYTES);
    expect(MAX_OUTPUT_BYTES).toBeLessThan(MAX_IMAGE_BYTES);
  });
});
