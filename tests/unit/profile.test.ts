import { describe, expect, it } from "vitest";
import { goalsToProfileFields, isProfileComplete } from "@/lib/profile";
import { draftFromProfile, parseDraft } from "@/components/profile/profile-form-parts";

describe("isProfileComplete", () => {
  it("es falso para el documento vacío creado en el primer login", () => {
    expect(
      isProfileComplete({ age: 0, heightCm: 0, weightKg: 0, dailyCaloriesTarget: 0 }),
    ).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
  });

  it("es verdadero tras el onboarding", () => {
    expect(
      isProfileComplete({
        onboardingCompleted: true,
        age: 25,
        heightCm: 175,
        weightKg: 75,
        dailyCaloriesTarget: 2353,
      }),
    ).toBe(true);
  });
});

describe("parseDraft", () => {
  const base = draftFromProfile(null);

  it("rechaza el borrador vacío", () => {
    const result = parseDraft(base);
    expect(result.ok).toBe(false);
  });

  it("acepta coma decimal y redondea", () => {
    const result = parseDraft({ ...base, age: "25", heightCm: "175", weightKg: "75,46" });
    expect(result.ok && result.input.weightKg).toBe(75.5);
  });

  it("activo sin actividades se trata como sedentario", () => {
    const result = parseDraft({
      ...base,
      age: "25",
      heightCm: "175",
      weightKg: "75",
      isActive: true,
      activities: [],
    });
    expect(result.ok && result.input.isActive).toBe(false);
  });

  it("goalsToProfileFields genera los campos de metas", () => {
    const result = parseDraft({
      ...base,
      age: "25",
      heightCm: "175",
      weightKg: "75",
      isActive: true,
      activities: [{ type: "strength", timesPerWeek: 3 }],
    });
    if (!result.ok) throw new Error("debería ser válido");
    expect(goalsToProfileFields(result.input)).toMatchObject({
      dailyCaloriesTarget: 2353,
      dailyProteinGTarget: 120,
      dailyCarbsGTarget: 322,
      dailyFatGTarget: 65,
      goalsCustomized: false,
    });
  });
});
