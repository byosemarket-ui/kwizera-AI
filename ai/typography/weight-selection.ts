/**
 * STEP 3 — font weight selection mapped onto verified installed fonts.
 * OS TTF discovery often exposes regular/bold only — map closest safe weight.
 */
import type { FontWeightName, HierarchyLevel, TextRole, VerifiedFont } from "./types.js";

export function preferredWeightName(input: {
  hierarchyLevel: HierarchyLevel;
  role: TextRole;
}): FontWeightName {
  if (input.role === "previousPrice" || input.role === "website" || input.role === "phone") {
    return "regular";
  }
  if (input.hierarchyLevel === "CRITICAL_ACTION") return "bold";
  if (input.role === "price" || input.role === "discount") return "extrabold";
  if (input.hierarchyLevel === "PRIMARY") return "bold";
  if (input.hierarchyLevel === "SECONDARY") return "semibold";
  if (input.hierarchyLevel === "SUPPORTING") return "medium";
  return "regular";
}

export function mapWeightToInstalled(
  preferred: FontWeightName,
  font: VerifiedFont,
  fonts: VerifiedFont[],
): { font: VerifiedFont; weightName: FontWeightName; weight: 400 | 700 | "unknown" } {
  const familyFonts = fonts.filter((item) => item.family.toLowerCase() === font.family.toLowerCase());
  const pool = familyFonts.length ? familyFonts : [font];
  const wantsBold = preferred === "semibold" || preferred === "bold" || preferred === "extrabold";
  if (wantsBold) {
    const bold = pool.find((item) => item.bold || item.weight === 700 || /bold|black|heavy/i.test(item.style));
    if (bold) {
      return {
        font: bold,
        weightName: preferred === "extrabold" && bold.bold ? "extrabold" : preferred === "semibold" ? "semibold" : "bold",
        weight: 700,
      };
    }
    return { font, weightName: "regular", weight: font.weight === 700 ? 700 : 400 };
  }
  const regular = pool.find((item) => !item.bold && item.weight !== 700) ?? font;
  return {
    font: regular,
    weightName: preferred === "thin" || preferred === "light" || preferred === "medium" ? preferred : "regular",
    weight: regular.weight === 700 ? 700 : 400,
  };
}
