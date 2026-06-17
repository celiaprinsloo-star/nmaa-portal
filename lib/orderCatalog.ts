export type OrderCurrency = "ZAR" | "USD";

export type CatalogItem = {
  id: string;
  section: string;
  item: string;
  size?: string;
  instructorPrice?: number;
  studentPrice?: number;
  currency: OrderCurrency;
  note?: string;
  specialOrder?: boolean;
};

export const orderCatalog: CatalogItem[] = [
  { id: "white-100", section: "White Uniforms", item: "White uniform", size: "100 (0000)", instructorPrice: 300, studentPrice: 350, currency: "ZAR" },
  { id: "white-110", section: "White Uniforms", item: "White uniform", size: "110 (000)", instructorPrice: 300, studentPrice: 350, currency: "ZAR" },
  { id: "white-120", section: "White Uniforms", item: "White uniform", size: "120 (00)", instructorPrice: 300, studentPrice: 350, currency: "ZAR" },
  { id: "white-130", section: "White Uniforms", item: "White uniform", size: "130 (0)", instructorPrice: 320, studentPrice: 370, currency: "ZAR" },
  { id: "white-140", section: "White Uniforms", item: "White uniform", size: "140 (1)", instructorPrice: 320, studentPrice: 370, currency: "ZAR" },
  { id: "white-150", section: "White Uniforms", item: "White uniform", size: "150 (2)", instructorPrice: 320, studentPrice: 370, currency: "ZAR" },
  { id: "white-160", section: "White Uniforms", item: "White uniform", size: "160 (3)", instructorPrice: 350, studentPrice: 400, currency: "ZAR" },
  { id: "white-170", section: "White Uniforms", item: "White uniform", size: "170 (4)", instructorPrice: 350, studentPrice: 400, currency: "ZAR" },
  { id: "white-180", section: "White Uniforms", item: "White uniform", size: "180 (5)", instructorPrice: 380, studentPrice: 430, currency: "ZAR" },
  { id: "white-190", section: "White Uniforms", item: "White uniform", size: "190 (6)", instructorPrice: 400, studentPrice: 450, currency: "ZAR" },
  { id: "white-200", section: "White Uniforms", item: "White uniform", size: "200 (7)", instructorPrice: 450, studentPrice: 500, currency: "ZAR" },
  { id: "bb-140", section: "Black Belt Uniforms", item: "Black and white uniform, includes back", size: "140 (1)", instructorPrice: 760, studentPrice: 810, currency: "ZAR" },
  { id: "bb-150", section: "Black Belt Uniforms", item: "Black and white uniform, includes back", size: "150 (2)", instructorPrice: 760, studentPrice: 810, currency: "ZAR" },
  { id: "bb-160", section: "Black Belt Uniforms", item: "Black and white uniform, includes back", size: "160 (3)", instructorPrice: 790, studentPrice: 840, currency: "ZAR" },
  { id: "bb-170", section: "Black Belt Uniforms", item: "Black and white uniform, includes back", size: "170 (4)", instructorPrice: 820, studentPrice: 870, currency: "ZAR" },
  { id: "bb-180", section: "Black Belt Uniforms", item: "Black and white uniform, includes back", size: "180 (5)", instructorPrice: 850, studentPrice: 900, currency: "ZAR" },
  { id: "bb-190", section: "Black Belt Uniforms", item: "Black and white uniform, includes back", size: "190 (6)", instructorPrice: 870, studentPrice: 920, currency: "ZAR" },
  { id: "bb-200", section: "Black Belt Uniforms", item: "Black and white uniform, includes back", size: "200 (7)", currency: "ZAR", specialOrder: true, note: "Special order" },
  { id: "black-v-neck", section: "Black V neck", item: "Black V neck", size: "0000 - 200", instructorPrice: 300, studentPrice: 450, currency: "ZAR" },
  { id: "gloves", section: "Sparring Gear", item: "Gloves", instructorPrice: 300, studentPrice: 410, currency: "ZAR" },
  { id: "foot-protectors", section: "Sparring Gear", item: "Foot protectors", instructorPrice: 300, studentPrice: 410, currency: "ZAR" },
  { id: "head-guard", section: "Sparring Gear", item: "Head guard", instructorPrice: 400, studentPrice: 510, currency: "ZAR" },
  { id: "chest-guard", section: "Sparring Gear", item: "Chest guard", instructorPrice: 450, studentPrice: 550, currency: "ZAR" },
  { id: "shield", section: "Sparring Gear", item: "Shield", instructorPrice: 300, studentPrice: 410, currency: "ZAR" },
  { id: "combat-gloves", section: "Sparring Gear", item: "Combat Gloves", instructorPrice: 200, studentPrice: 250, currency: "ZAR" },
  { id: "combat-weapon", section: "Sparring Gear", item: "Combat Weapon", instructorPrice: 300, studentPrice: 400, currency: "ZAR" },
  { id: "groin-guards", section: "Sparring Gear", item: "Groin Guards", instructorPrice: 200, studentPrice: 250, currency: "ZAR" },
  { id: "combat-swords", section: "Sparring Gear", item: "Combat Swords", instructorPrice: 450, studentPrice: 550, currency: "ZAR" },
  { id: "mountain-patch", section: "Patches", item: "Blackbelt uniform mountain patch", currency: "ZAR", specialOrder: true, note: "Price to be confirmed" },
  { id: "southern-patch", section: "Patches", item: "NMAA Southern Hemisphere Patch", instructorPrice: 5, currency: "USD", note: "Ordered directly from NMAA Merchandise. Shipping to be added." },
  { id: "judge-patch", section: "Patches", item: "Judge Patches", instructorPrice: 5, currency: "USD", note: "Ordered directly from NMAA Merchandise. Shipping to be added." },
  { id: "nxt-patches", section: "Patches", item: "NXT Patches and collars", currency: "USD", specialOrder: true, note: "Must be ordered directly from NMAA Instruction Department. Shipping to be added." },
  { id: "back-color-belts", section: "Back of Uniform", item: "Color belts", instructorPrice: 250, studentPrice: 300, currency: "ZAR" },
  { id: "back-black-belts", section: "Back of Uniform", item: "Black belts", instructorPrice: 500, studentPrice: 600, currency: "ZAR" },
  { id: "belt-white-red", section: "Belts", item: "White - Red (excl. camo)", instructorPrice: 50, currency: "ZAR" },
  { id: "belt-camo", section: "Belts", item: "Camo", instructorPrice: 70, currency: "ZAR" },
  { id: "belt-recommended-red", section: "Belts", item: "Recommended Red", instructorPrice: 70, currency: "ZAR" },
  { id: "custom-black-belt", section: "Belts", item: "Custom Black Belt", instructorPrice: 650, studentPrice: 800, currency: "ZAR", note: "Subject to change depending on order and exchange rate." },
];

export function money(value: number | undefined, currency: OrderCurrency) {
  if (value === undefined) return "Special order";
  if (currency === "USD") return `$${value.toFixed(2)}`;
  return `R${value.toFixed(2)}`;
}
