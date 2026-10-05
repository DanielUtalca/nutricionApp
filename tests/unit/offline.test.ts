import { describe, expect, it, vi } from "vitest";
import { settleWrite } from "@/lib/offline";

describe("settleWrite", () => {
  it("devuelve saved si el servidor confirma a tiempo", async () => {
    await expect(settleWrite(Promise.resolve(), 50)).resolves.toBe("saved");
  });

  it("devuelve queued si no hay confirmación (sin conexión)", async () => {
    await expect(settleWrite(new Promise(() => {}), 20)).resolves.toBe("queued");
  });

  it("propaga errores que llegan antes del timeout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(settleWrite(Promise.reject(new Error("permission-denied")), 50)).rejects.toThrow("permission-denied");
  });
});
