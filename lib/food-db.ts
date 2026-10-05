// ============================================================
// food-db.ts — Base local de alimentos comunes para la búsqueda
// ============================================================
// Valores por 100 g (o 100 ml) tomados de referencias públicas (USDA
// FoodData Central y tablas chilenas de composición). Las preparaciones
// caseras son promedios aproximados. Funciona sin conexión y sin cuota.

import type { FoodEntry } from "@/types";

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  /** kcal, proteína, carbos y grasa por 100 g */
  per100: { calories: number; proteinG: number; carbsG: number; fatG: number };
  serving: { label: string; grams: number };
  aliases?: string[];
  approximate?: boolean;
}

export type FoodCategory =
  | "Proteínas"
  | "Lácteos"
  | "Cereales y tubérculos"
  | "Legumbres"
  | "Frutas"
  | "Verduras"
  | "Grasas y frutos secos"
  | "Snacks y dulces"
  | "Bebidas"
  | "Preparaciones";

type Row = [
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  servingLabel: string,
  servingGrams: number,
  aliases?: string[],
];

const DATA: Record<FoodCategory, Row[]> = {
  Proteínas: [
    ["Pechuga de pollo cocida", 165, 31, 0, 3.6, "1 filete", 150, ["pollo", "pechuga"]],
    ["Trutro de pollo sin piel", 209, 26, 0, 10.9, "1 trutro", 100, ["muslo", "pollo"]],
    ["Carne de vacuno magra (posta)", 217, 26, 0, 12, "1 bistec", 150, ["carne", "bife", "filete", "res"]],
    ["Carne molida 10% grasa", 217, 26.1, 0, 11.8, "1 porción", 120, ["carne picada", "hamburguesa casera"]],
    ["Lomo de cerdo", 242, 27, 0, 14, "1 chuleta", 150, ["chancho", "cerdo"]],
    ["Salmón", 206, 22, 0, 12.4, "1 filete", 150, ["pescado"]],
    ["Merluza", 90, 19, 0, 1.3, "1 filete", 150, ["pescado", "reineta"]],
    ["Atún en agua", 116, 25.5, 0, 0.8, "1 lata escurrida", 120, ["atun", "lata"]],
    ["Huevo", 143, 12.6, 0.7, 9.5, "1 unidad", 50, ["huevos", "huevo duro", "huevo revuelto"]],
    ["Clara de huevo", 52, 10.9, 0.7, 0.2, "1 clara", 33, ["claras"]],
    ["Jamón de pavo", 104, 17, 2, 3, "2 láminas", 40, ["pavo", "fiambre"]],
    ["Jamón de cerdo", 145, 21, 1.5, 6, "2 láminas", 40, ["jamon", "fiambre"]],
    ["Camarones", 99, 24, 0.2, 0.3, "1 porción", 100, ["mariscos"]],
    ["Tofu firme", 144, 17.3, 2.8, 8.7, "1 porción", 100, ["soya"]],
    ["Proteína whey (polvo)", 400, 80, 8, 6, "1 scoop", 30, ["proteina", "suplemento", "batido"]],
  ],
  Lácteos: [
    ["Leche entera", 61, 3.2, 4.8, 3.3, "1 taza (240 ml)", 240, ["leche"]],
    ["Leche semidescremada", 46, 3.3, 4.8, 1.5, "1 taza (240 ml)", 240, ["leche"]],
    ["Leche descremada", 34, 3.4, 5, 0.1, "1 taza (240 ml)", 240, ["leche"]],
    ["Yogur natural", 61, 3.5, 4.7, 3.3, "1 pote", 125, ["yogurt"]],
    ["Yogur griego natural", 97, 9, 3.6, 5, "1 pote", 150, ["yogurt griego"]],
    ["Yogur griego descremado", 59, 10.2, 3.6, 0.4, "1 pote", 150, ["yogurt proteico"]],
    ["Quesillo / cottage", 98, 11.1, 3.4, 4.3, "1/2 taza", 110, ["queso cottage", "quesillo"]],
    ["Queso fresco", 299, 18, 3, 24, "1 rebanada", 30, ["queso"]],
    ["Queso gauda / mantecoso", 356, 25, 2.2, 27.4, "1 lámina", 20, ["queso laminado", "queso"]],
    ["Queso parmesano", 431, 38, 4, 29, "1 cda rallado", 10, ["queso rallado"]],
    ["Mantequilla", 717, 0.9, 0.1, 81, "1 cdta", 5, ["manteca"]],
  ],
  "Cereales y tubérculos": [
    ["Arroz blanco cocido", 130, 2.7, 28, 0.3, "1 taza", 160, ["arroz"]],
    ["Arroz integral cocido", 123, 2.7, 25.6, 1, "1 taza", 160, ["arroz"]],
    ["Fideos cocidos", 158, 5.8, 30.9, 0.9, "1 taza", 140, ["pasta", "tallarines", "spaghetti"]],
    ["Marraqueta", 275, 9, 56, 1.5, "1 unidad", 100, ["pan batido", "pan francés", "pan"]],
    ["Hallulla", 300, 8.5, 55, 5, "1 unidad", 90, ["pan"]],
    ["Pan de molde blanco", 265, 9, 49, 3.2, "1 rebanada", 28, ["pan", "sandwich"]],
    ["Pan de molde integral", 252, 12.5, 43, 3.5, "1 rebanada", 28, ["pan integral"]],
    ["Tortilla de trigo", 312, 8.3, 51.6, 8, "1 unidad", 45, ["wrap", "burrito"]],
    ["Avena", 389, 16.9, 66.3, 6.9, "1/2 taza", 40, ["avena en hojuelas", "porridge"]],
    ["Quinoa cocida", 120, 4.4, 21.3, 1.9, "1 taza", 185, ["quinua"]],
    ["Papa cocida", 87, 1.9, 20.1, 0.1, "1 mediana", 150, ["papas", "patata"]],
    ["Puré de papas", 113, 1.9, 16.8, 4.2, "1 taza", 210, ["pure"]],
    ["Papas fritas", 312, 3.4, 41, 15, "porción mediana", 115, ["papas fritas", "french fries"]],
    ["Camote cocido", 90, 2, 20.7, 0.2, "1 mediano", 150, ["batata"]],
    ["Choclo cocido", 96, 3.4, 21, 1.5, "1 taza", 145, ["maíz", "elote"]],
    ["Cereal de maíz (corn flakes)", 357, 7.5, 84, 0.4, "1 taza", 30, ["cereal"]],
    ["Granola", 471, 10, 64, 20, "1/2 taza", 50, ["muesli"]],
    ["Galletas de agua / soda", 418, 9.5, 71, 10, "4 unidades", 25, ["galletas saladas", "crackers"]],
  ],
  Legumbres: [
    ["Porotos cocidos", 127, 8.7, 22.8, 0.5, "1 taza", 180, ["frijoles", "porotos"]],
    ["Lentejas cocidas", 116, 9, 20, 0.4, "1 plato", 200, ["lentejas"]],
    ["Garbanzos cocidos", 164, 8.9, 27.4, 2.6, "1 taza", 165, ["garbanzos"]],
    ["Hummus", 166, 7.9, 14.3, 9.6, "2 cucharadas", 30, ["humus"]],
  ],
  Frutas: [
    ["Plátano", 89, 1.1, 22.8, 0.3, "1 mediano", 120, ["banana", "banano"]],
    ["Manzana", 52, 0.3, 13.8, 0.2, "1 mediana", 180],
    ["Naranja", 47, 0.9, 11.8, 0.1, "1 mediana", 140],
    ["Mandarina", 53, 0.8, 13.3, 0.3, "1 unidad", 90, ["clementina"]],
    ["Frutillas", 32, 0.7, 7.7, 0.3, "1 taza", 150, ["fresas"]],
    ["Arándanos", 57, 0.7, 14.5, 0.3, "1 taza", 150, ["berries"]],
    ["Uvas", 69, 0.7, 18.1, 0.2, "1 taza", 150],
    ["Pera", 57, 0.4, 15.2, 0.1, "1 mediana", 180],
    ["Kiwi", 61, 1.1, 14.7, 0.5, "1 unidad", 75],
    ["Piña", 50, 0.5, 13.1, 0.1, "1 taza", 165, ["ananá"]],
    ["Mango", 60, 0.8, 15, 0.4, "1 taza", 165],
    ["Sandía", 30, 0.6, 7.6, 0.2, "1 tajada", 280],
    ["Durazno", 39, 0.9, 9.5, 0.3, "1 mediano", 150, ["melocotón"]],
    ["Palta", 160, 2, 8.5, 14.7, "1/2 unidad", 70, ["aguacate", "palta hass"]],
  ],
  Verduras: [
    ["Tomate", 18, 0.9, 3.9, 0.2, "1 mediano", 120],
    ["Lechuga", 15, 1.4, 2.9, 0.2, "1 taza", 50, ["ensalada verde"]],
    ["Pepino", 15, 0.7, 3.6, 0.1, "1/2 unidad", 100],
    ["Zanahoria", 41, 0.9, 9.6, 0.2, "1 mediana", 60],
    ["Brócoli cocido", 35, 2.4, 7.2, 0.4, "1 taza", 155, ["brocoli"]],
    ["Espinaca", 23, 2.9, 3.6, 0.4, "1 taza", 30],
    ["Cebolla", 40, 1.1, 9.3, 0.1, "1/2 unidad", 100],
    ["Zapallo italiano", 17, 1.2, 3.1, 0.3, "1 unidad", 150, ["calabacín", "zucchini"]],
    ["Pimentón", 31, 1, 6, 0.3, "1 unidad", 120, ["pimiento"]],
    ["Champiñones", 22, 3.1, 3.3, 0.3, "1 taza", 100, ["hongos"]],
    ["Betarraga cocida", 44, 1.7, 10, 0.2, "1/2 taza", 100, ["remolacha"]],
    ["Porotos verdes cocidos", 35, 1.9, 7.9, 0.3, "1 taza", 125, ["judías verdes"]],
  ],
  "Grasas y frutos secos": [
    ["Aceite de oliva", 884, 0, 0, 100, "1 cucharada", 13, ["aceite"]],
    ["Aceite vegetal", 884, 0, 0, 100, "1 cucharada", 13, ["aceite maravilla", "aceite canola"]],
    ["Almendras", 579, 21.2, 21.6, 49.9, "1 puñado", 28, ["frutos secos"]],
    ["Nueces", 654, 15.2, 13.7, 65.2, "1 puñado", 28, ["frutos secos"]],
    ["Maní tostado", 585, 23.7, 21.5, 49.7, "1 puñado", 28, ["cacahuate", "mani"]],
    ["Mantequilla de maní", 588, 25, 20, 50, "1 cucharada", 16, ["crema de maní", "peanut butter"]],
    ["Mayonesa", 680, 1, 0.6, 75, "1 cucharada", 14, ["mayo"]],
    ["Semillas de chía", 486, 16.5, 42.1, 30.7, "1 cucharada", 12, ["chia"]],
  ],
  "Snacks y dulces": [
    ["Chocolate amargo 70%", 598, 7.8, 45.9, 42.6, "2 cuadritos", 20, ["chocolate"]],
    ["Chocolate de leche", 535, 7.7, 59.4, 29.7, "2 cuadritos", 20, ["chocolate"]],
    ["Galletas dulces", 480, 6, 68, 20, "3 unidades", 30, ["galletas", "cookies"]],
    ["Papas fritas de bolsa", 536, 7, 53, 34.6, "1 bolsa chica", 40, ["chips", "snack"]],
    ["Barra de cereal", 400, 6, 70, 10, "1 barra", 25, ["barrita"]],
    ["Helado de crema", 207, 3.5, 23.6, 11, "1 bola", 70, ["helado"]],
    ["Azúcar", 387, 0, 100, 0, "1 cucharadita", 5, ["azucar"]],
    ["Miel", 304, 0.3, 82.4, 0, "1 cucharada", 21],
    ["Mermelada", 250, 0.4, 62, 0.1, "1 cucharada", 20, ["dulce"]],
  ],
  Bebidas: [
    ["Café negro", 2, 0.3, 0, 0, "1 taza", 240, ["cafe", "americano", "espresso"]],
    ["Café con leche", 33, 1.7, 2.5, 1.7, "1 taza", 240, ["cortado", "latte"]],
    ["Té sin azúcar", 1, 0, 0.3, 0, "1 taza", 240, ["te", "infusión"]],
    ["Jugo de naranja natural", 45, 0.7, 10.4, 0.2, "1 vaso", 250, ["jugo"]],
    ["Bebida gaseosa", 42, 0, 10.6, 0, "1 lata (350 ml)", 350, ["bebida", "coca cola", "refresco"]],
    ["Bebida zero / light", 0, 0, 0, 0, "1 lata (350 ml)", 350, ["coca zero", "light"]],
    ["Leche chocolatada", 76, 3.2, 12, 1.9, "1 caja", 200, ["leche con chocolate"]],
    ["Cerveza", 43, 0.5, 3.6, 0, "1 lata (350 ml)", 350, ["chela"]],
    ["Vino tinto", 85, 0.1, 2.6, 0, "1 copa", 150, ["vino"]],
  ],
  Preparaciones: [
    ["Empanada de pino (horno)", 240, 9, 26, 11, "1 unidad", 250, ["empanada"]],
    ["Pastel de choclo", 150, 8, 14, 7, "1 porción", 350],
    ["Cazuela de vacuno", 60, 5, 5, 2.3, "1 plato", 400, ["cazuela", "sopa"]],
    ["Lentejas guisadas", 110, 6.5, 17, 2, "1 plato", 300, ["lentejas con arroz"]],
    ["Porotos con riendas", 110, 5, 18, 2, "1 plato", 350, ["porotos granados"]],
    ["Completo italiano", 230, 7, 20, 13, "1 unidad", 250, ["hot dog", "completo"]],
    ["Sopaipilla", 330, 5, 40, 17, "1 unidad", 50],
    ["Pizza de queso", 266, 11, 33, 10, "1 trozo", 110, ["pizza"]],
    ["Hamburguesa con pan", 254, 13, 30, 9, "1 unidad", 150, ["hamburguesa"]],
    ["Sushi (roll)", 150, 6, 22, 4.5, "8 piezas", 200, ["sushi", "roll"]],
    ["Tallarines con salsa boloñesa", 140, 7, 17, 5, "1 plato", 300, ["pasta bolognesa", "fideos con salsa"]],
    ["Ensalada chilena", 25, 1, 5, 0.2, "1 porción", 150, ["tomate cebolla"]],
    ["Huevos revueltos", 166, 11, 2, 12.5, "2 huevos", 120, ["huevo revuelto"]],
  ],
};

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const slug = (s: string) => normalizeText(s).replace(/[^a-z0-9]+/g, "-");

export const FOODS: FoodItem[] = (Object.entries(DATA) as [FoodCategory, Row[]][]).flatMap(
  ([category, rows]) =>
    rows.map(([name, calories, proteinG, carbsG, fatG, label, grams, aliases]) => ({
      id: slug(name),
      name,
      category,
      per100: { calories, proteinG, carbsG, fatG },
      serving: { label, grams },
      aliases,
      approximate: category === "Preparaciones",
    })),
);

const INDEX = FOODS.map((food) => ({
  food,
  name: normalizeText(food.name),
  haystack: normalizeText([food.name, ...(food.aliases ?? [])].join(" ")),
}));

/** Búsqueda por palabras (sin tildes). Prioriza coincidencias al inicio del nombre. */
export function searchFoods(query: string, limit = 20): FoodItem[] {
  const q = normalizeText(query);
  if (!q) return [];
  const tokens = q.split(" ");
  return INDEX.filter(({ haystack }) => tokens.every((t) => haystack.includes(t)))
    .map(({ food, name }) => ({
      food,
      score: name.startsWith(q) ? 0 : name.split(" ").some((w) => w.startsWith(tokens[0])) ? 1 : 2,
    }))
    .sort((a, b) => a.score - b.score || a.food.name.localeCompare(b.food.name, "es"))
    .slice(0, limit)
    .map(({ food }) => food);
}

/** Convierte un alimento de la base a una entrada con la porción indicada */
export function foodItemToEntry(food: FoodItem, grams: number = food.serving.grams): FoodEntry {
  const f = grams / 100;
  const r1 = (n: number) => Math.round(n * f * 10) / 10;
  return {
    name: food.name,
    portionDescription:
      grams === food.serving.grams ? `${food.serving.label} (${grams} g)` : `${grams} g`,
    portionGrams: grams,
    calories: Math.round(food.per100.calories * f),
    proteinG: r1(food.per100.proteinG),
    carbsG: r1(food.per100.carbsG),
    fatG: r1(food.per100.fatG),
  };
}
