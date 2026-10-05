// Tests de las reglas de Firestore contra el emulador.
// Ejecutar con: npm run test:rules  (levanta el emulador automáticamente)

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-nutritrack-rules",
    firestore: { rules: readFileSync(process.env.RULES_FILE ?? "firestore.rules", "utf8"), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anon = () => env.unauthenticatedContext().firestore();

const profile = (uid: string) => ({
  uid,
  email: `${uid}@test.dev`,
  displayName: uid,
  photoURL: "",
  age: 25,
  sex: "male",
  heightCm: 175,
  weightKg: 75,
  goal: "maintain",
  isActive: true,
  activities: [{ type: "strength", timesPerWeek: 3 }],
  dailyCaloriesTarget: 2353,
  dailyProteinGTarget: 120,
  dailyCarbsGTarget: 322,
  dailyFatGTarget: 65,
  dailyWaterLTarget: 2.75,
  onboardingCompleted: true,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const meal = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid,
  date: "2026-10-04",
  type: "lunch",
  source: "manual",
  foods: [{ name: "Arroz", portionDescription: "1 taza", calories: 208, proteinG: 4.3, carbsG: 44.8, fatG: 0.5 }],
  totalCalories: 208,
  totalProteinG: 4.3,
  totalCarbsG: 44.8,
  totalFatG: 0.5,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

/** Siembra datos saltándose las reglas */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe("users/{uid}", () => {
  it("el dueño puede crear, leer y actualizar su perfil", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice"), profile("alice")));
    await assertSucceeds(getDoc(doc(alice(), "users/alice")));
    await assertSucceeds(updateDoc(doc(alice(), "users/alice"), { weightKg: 74 }));
  });

  it("nadie más puede leer ni escribir el perfil", async () => {
    await seed("users/alice", profile("alice"));
    await assertFails(getDoc(doc(bob(), "users/alice")));
    await assertFails(updateDoc(doc(bob(), "users/alice"), { weightKg: 50 }));
    await assertFails(getDoc(doc(anon(), "users/alice")));
    await assertFails(setDoc(doc(bob(), "users/alice"), profile("alice")));
  });

  it("no se puede crear un perfil con uid ajeno dentro del documento", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice"), profile("bob")));
  });

  it("rechaza campos desconocidos y valores fuera de rango", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice"), { ...profile("alice"), isAdmin: true }));
    await assertFails(setDoc(doc(alice(), "users/alice"), { ...profile("alice"), dailyCaloriesTarget: 99999 }));
    await assertFails(setDoc(doc(alice(), "users/alice"), { ...profile("alice"), sex: "x" }));
  });

  it("no se puede listar la colección de usuarios", async () => {
    await seed("users/alice", profile("alice"));
    await assertFails(getDocs(collection(bob(), "users")));
  });
});

describe("users/{uid}/meals", () => {
  it("el dueño gestiona sus comidas", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/meals/m1"), meal("alice")));
    await assertSucceeds(getDocs(collection(alice(), "users/alice/meals")));
    await assertSucceeds(updateDoc(doc(alice(), "users/alice/meals/m1"), { type: "dinner" }));
    await assertSucceeds(deleteDoc(doc(alice(), "users/alice/meals/m1")));
  });

  it("otro usuario no puede leer, crear ni borrar comidas ajenas", async () => {
    await seed("users/alice/meals/m1", meal("alice"));
    await assertFails(getDoc(doc(bob(), "users/alice/meals/m1")));
    await assertFails(getDocs(collection(bob(), "users/alice/meals")));
    await assertFails(setDoc(doc(bob(), "users/alice/meals/m2"), meal("alice")));
    await assertFails(deleteDoc(doc(bob(), "users/alice/meals/m1")));
    await assertFails(getDoc(doc(anon(), "users/alice/meals/m1")));
  });

  it("valida la forma de la comida", async () => {
    const ref = doc(alice(), "users/alice/meals/bad");
    await assertFails(setDoc(ref, meal("alice", { type: "brunch" })));
    await assertFails(setDoc(ref, meal("alice", { date: "04/10/2026" })));
    await assertFails(setDoc(ref, meal("alice", { totalCalories: -5 })));
    await assertFails(setDoc(ref, meal("alice", { photoURL: "https://x" })));
    await assertFails(setDoc(ref, meal("alice", { foods: Array.from({ length: 51 }, () => ({})) })));
    await assertFails(setDoc(ref, meal("bob")));
  });
});

describe("otras subcolecciones del dueño", () => {
  it("peso: id = fecha y rango válido", async () => {
    const ok = { uid: "alice", date: "2026-10-04", weightKg: 75, waistCm: 84, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(alice(), "users/alice/weightLogs/2026-10-04"), ok));
    await assertFails(setDoc(doc(alice(), "users/alice/weightLogs/2026-10-05"), ok)); // id ≠ date
    await assertFails(setDoc(doc(alice(), "users/alice/weightLogs/2026-10-04"), { ...ok, weightKg: 5 }));
    await assertFails(getDoc(doc(bob(), "users/alice/weightLogs/2026-10-04")));
  });

  it("agua", async () => {
    const ok = { uid: "alice", date: "2026-10-04", totalMl: 500, entries: [], updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(alice(), "users/alice/water/2026-10-04"), ok));
    await assertFails(setDoc(doc(alice(), "users/alice/water/2026-10-04"), { ...ok, totalMl: -100 }));
    await assertFails(setDoc(doc(bob(), "users/alice/water/2026-10-04"), ok));
  });

  it("recetas", async () => {
    const ok = {
      uid: "alice",
      name: "Lentejas",
      description: "",
      servings: 4,
      ingredients: [],
      tags: ["almuerzo"],
      totalCalories: 0,
      totalProteinG: 0,
      totalCarbsG: 0,
      totalFatG: 0,
      caloriesPerServing: 0,
      proteinGPerServing: 0,
      carbsGPerServing: 0,
      fatGPerServing: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(alice(), "users/alice/recipes/r1"), ok));
    await assertFails(setDoc(doc(alice(), "users/alice/recipes/r2"), { ...ok, name: "" }));
    await assertFails(getDoc(doc(bob(), "users/alice/recipes/r1")));
  });

  it("plan y lista de compras", async () => {
    await assertSucceeds(
      setDoc(doc(alice(), "users/alice/mealPlans/2026-10-04"), { uid: "alice", date: "2026-10-04", items: [], updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      setDoc(doc(alice(), "users/alice/shoppingLists/2026-09-28"), {
        uid: "alice",
        weekStart: "2026-09-28",
        checked: [],
        extras: [],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(bob(), "users/alice/mealPlans/2026-10-04")));
    await assertFails(getDoc(doc(bob(), "users/alice/shoppingLists/2026-09-28")));
  });

  it("aiUsage: el dueño lee, pero nadie escribe desde el cliente", async () => {
    await seed("users/alice/aiUsage/2026-10-04", { count: 3 });
    await assertSucceeds(getDoc(doc(alice(), "users/alice/aiUsage/2026-10-04")));
    await assertFails(setDoc(doc(alice(), "users/alice/aiUsage/2026-10-04"), { count: 0 }));
    await assertFails(getDoc(doc(bob(), "users/alice/aiUsage/2026-10-04")));
  });

  it("subcolecciones no declaradas quedan denegadas, incluso para el dueño", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice/secrets/x"), { a: 1 }));
    await assertFails(getDoc(doc(alice(), "users/alice/secrets/x")));
  });

  it("colecciones fuera de users/ quedan denegadas", async () => {
    await assertFails(setDoc(doc(alice(), "public/x"), { a: 1 }));
  });
});
