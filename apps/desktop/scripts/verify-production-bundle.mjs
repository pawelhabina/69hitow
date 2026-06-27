import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const rendererAssets = join(process.cwd(), "out", "renderer", "assets");
const files = await readdir(rendererAssets);
const bundles = files.filter((file) => file.endsWith(".js"));

if (bundles.length === 0) {
  throw new Error("Nie znaleziono produkcyjnego bundle'a renderera.");
}

const sources = await Promise.all(
  bundles.map(async (file) => ({ file, source: await readFile(join(rendererAssets, file), "utf8") }))
);

for (const { file, source } of sources) {
  if (source.includes("http://localhost:6969")) {
    throw new Error(`Bundle ${file} nadal zawiera lokalny adres API.`);
  }
}

if (!sources.some(({ source }) => source.includes("http://admin.hity.mionix.pl"))) {
  throw new Error("Bundle nie zawiera produkcyjnego adresu API.");
}

console.log("Zweryfikowano produkcyjny adres API: http://admin.hity.mionix.pl");
