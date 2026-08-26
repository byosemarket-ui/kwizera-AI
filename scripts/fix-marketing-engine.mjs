import fs from "node:fs";
const p = "desktop/marketing-input/marketing-engine.ts";
let s = fs.readFileSync(p, "utf8");
const bad = "  }`n`n  private afterFieldChange";
const good = "  }\n\n  private afterFieldChange";
if (!s.includes(bad)) {
  // try escaped variants
  console.log("bad pattern not found; snippet around continue end:");
  const i = s.indexOf("_transitioning = false");
  console.log(JSON.stringify(s.slice(i, i + 120)));
} else {
  s = s.replace(bad, good);
  fs.writeFileSync(p, s);
  console.log("fixed");
}
