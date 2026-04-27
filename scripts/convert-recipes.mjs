import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SOURCE = "/mnt/c/Users/yoshi/Dropbox/Personal/Food/txt";
const sourceDir = process.argv[2] || DEFAULT_SOURCE;
const outputPath = path.resolve("public/data/recipes.json");

const KNOWN_HEADINGS = new Set([
  "ingredients",
  "add after baking",
  "steps",
  "notes",
  "burger patties",
  "parmesan dressing",
  "for serving",
  "spices",
  "sauce",
  "optional extras"
]);

const METRIC_REPLACEMENTS = new Map([
  ["3 cups rolled oats (200g)", "200 g rolled oats"],
  ["1/2 cup almonds, roughly chopped (40 g)", "40 g almonds, roughly chopped"],
  ["1 cup pumpkin seeds (100g)", "100 g pumpkin seeds"],
  ["1/2 cup shredded coconut (30 g)", "30 g shredded coconut"],
  ["2 tbsp neutral oil (or olive oil)", "30 ml neutral oil (or olive oil)"],
  ["2–3 tbsp honey (or mix with a little maple syrup) (50g)", "50 g honey (or mix with a little maple syrup)"],
  ["1/4 tsp salt", "1 ml salt"],
  ["1/2 cup dried cranberries (40 g)", "40 g dried cranberries"],
  ["1–2 tbsp sesame seeds (20 g)", "20 g sesame seeds"],
  ["1 tbsp olive oil", "15 ml olive oil"],
  ["2 tbsp olive oil", "30 ml olive oil"],
  ["1 lb ground beef", "450 g ground beef"],
  ["2 tbsp all-purpose flour", "15 g all-purpose flour"],
  ["1 tbsp chili powder", "15 ml chili powder"],
  ["1/2 tsp smoked paprika", "2.5 ml smoked paprika"],
  ["1/2 tsp garlic powder", "2.5 ml garlic powder"],
  ["1/2 tsp dried oregano", "2.5 ml dried oregano"],
  ["1 can (8 oz) tomato sauce", "225 g tomato sauce"],
  ["3 cups beef broth", "7 dl beef broth"],
  ["2 cups uncooked macaroni (about 1/2 lb)", "225 g uncooked macaroni"],
  ["1 cup shredded cheddar cheese", "100 g shredded cheddar cheese"],
  ["1 cup uncooked long-grain white rice", "185 g uncooked long-grain white rice"],
  ["1 can (15 oz) diced tomatoes (with juices)", "1 can (400 g) diced tomatoes (with juices)"],
  ["1 can (15 oz) quartered artichoke hearts, drained", "1 can (400 g) quartered artichoke hearts, drained"],
  ["1 can (15 oz) chickpeas, drained and rinsed", "1 can (400 g) chickpeas, drained and rinsed"],
  ["1.5 cups vegetable broth", "3.5 dl vegetable broth"],
  ["1/2 tsp salt (or to taste)", "2.5 ml salt (or to taste)"],
  ["1/2 tbsp smoked paprika", "7.5 ml smoked paprika"],
  ["1 tsp ground cumin", "5 ml ground cumin"],
  ["1/2 tsp dried oregano", "2.5 ml dried oregano"],
  ["1/4 tsp cayenne pepper", "1 ml cayenne pepper"],
  ["2–3 tbsp tomato paste", "30–45 ml tomato paste"],
  ["1/2–1 cup reserved pasta water", "1–2.5 dl reserved pasta water"],
  ["Before draining, reserve about 1 cup of pasta water.", "Before draining, reserve about 2.5 dl of pasta water."],
  ["1/2 tbsp basil", "7.5 ml basil"],
  ["1/2 tbsp oregano", "7.5 ml oregano"],
  ["1/3 tbsp red pepper flakes (optional)", "5 ml red pepper flakes (optional)"]
]);

const RECIPE_SOURCES = {
  "paprika-pasta": {
    label: "Budget Bytes",
    url: "https://www.budgetbytes.com/pasta-with-sausage-and-peppers/"
  }
};

function metricizeLine(line) {
  const match = line.match(/^(\s*(?:[-*]\s+|\d+\.\s+)?)(.*)$/);
  if (!match) return line;

  const [, prefix, content] = match;
  return `${prefix}${METRIC_REPLACEMENTS.get(content.trim()) || content}`;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value) {
  const smallWords = new Set(["and", "or", "with", "the", "a", "an", "to", "of", "in"]);
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanTitle(rawTitle, fallback) {
  const fixedJoin = rawTitle.trim().split(/(?<=[a-zåäö])(?=[A-ZÅÄÖ]{2,})/u).pop() || rawTitle;
  const title = fixedJoin.replace(/\s+/g, " ").trim();
  if (!title) return titleCase(fallback.replace(/[-_]+/g, " "));
  if (title === title.toUpperCase()) return titleCase(title);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function normalizeLine(line) {
  return line.replace(/\t/g, "  ").replace(/\s+$/g, "");
}

function isKnownHeading(line) {
  return KNOWN_HEADINGS.has(line.trim().toLowerCase());
}

function stripListMarker(line) {
  return line
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function parseStepItems(stepLines) {
  const items = [];
  const hasNestedBullets = stepLines.some((line) => /^\s+[-*]\s+/.test(line));

  for (const line of stepLines) {
    if (!line.trim()) continue;

    const trimmed = line.trim();
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered && hasNestedBullets) {
      items.push({ type: "phase", text: numbered[1].trim() });
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      items.push({ type: "instruction", text: bullet[1].trim() });
      continue;
    }

    const previous = items[items.length - 1];
    if (previous?.type === "instruction" && /^\s+/.test(line)) {
      previous.text = `${previous.text} ${trimmed}`;
      continue;
    }

    items.push({ type: "instruction", text: stripListMarker(line) });
  }

  return items.filter((item) => item.text);
}

function extractServings(lines) {
  const servingLine = lines.find((line) => /^serves\s+\d+/i.test(line.trim()));
  return servingLine ? servingLine.trim() : "";
}

function inferTags(title, sections) {
  const text = `${title}\n${sections.flatMap((section) => section.lines).join("\n")}`.toLowerCase();
  const tags = new Set();

  if (/\b(pasta|macaroni|penne|casserole)\b/.test(text)) tags.add("pasta");
  if (/\b(granola|oats|kefir)\b/.test(text)) tags.add("breakfast");
  if (/\b(burger|burgers|bun|buns|patties|patty)\b/.test(text)) tags.add("burgers");
  if (/\b(chickpea|chickpeas|artichoke|artichokes|vegetable|veggie)\b/.test(text)) tags.add("vegetarian");
  if (/\b(beef|sausage|sausages|bacon|ham|chorizo|kabanoss)\b/.test(text)) tags.add("meat");
  if (/one-pot|one pot|large pot|deep skillet/.test(text)) tags.add("one-pot");
  if (/oven|bake|baking|casserole/.test(text)) tags.add("oven");

  return [...tags].sort();
}

function parseRecipe(fileName, rawText) {
  const stem = path.basename(fileName, path.extname(fileName));
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(normalizeLine);

  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  const rawTitle = firstContentIndex >= 0 ? lines[firstContentIndex] : stem;
  const title = cleanTitle(rawTitle, stem);
  const bodyLines = lines.slice(firstContentIndex + 1).filter((line) => !/^serves\s+\d+/i.test(line.trim()));
  const sections = [];
  let current = { name: "Overview", lines: [] };

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.lines.length > 0 && current.lines[current.lines.length - 1] !== "") {
        current.lines.push("");
      }
      continue;
    }

    if (isKnownHeading(trimmed)) {
      if (current.lines.some((item) => item.trim())) sections.push(current);
      current = { name: titleCase(trimmed), lines: [] };
      continue;
    }

    current.lines.push(metricizeLine(line));
  }

  if (current.lines.some((item) => item.trim())) sections.push(current);

  const cleanedSections = sections.map((section) => ({
    name: section.name,
    lines: section.lines
      .join("\n")
      .split(/\n{3,}/)
      .join("\n\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line, index, all) => line.trim() || (all[index - 1]?.trim() && all[index + 1]?.trim()))
  }));

  const stepSection = cleanedSections.find((section) => section.name.toLowerCase() === "steps");
  const stepItems = stepSection ? parseStepItems(stepSection.lines) : [];
  const steps = stepSection
    ? stepItems.filter((item) => item.type === "instruction").map((item) => item.text)
    : [];

  return {
    id: slugify(stem),
    title,
    sourceFile: fileName,
    sourcePath: path.join(sourceDir, fileName),
    source: RECIPE_SOURCES[slugify(stem)] || { label: "Unknown", url: "" },
    servings: extractServings(lines),
    tags: inferTags(title, cleanedSections),
    sections: cleanedSections,
    stepItems,
    steps
  };
}

async function main() {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const txtFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "sv"));

  const recipes = [];
  for (const fileName of txtFiles) {
    const filePath = path.join(sourceDir, fileName);
    const rawText = await readFile(filePath, "utf8");
    recipes.push(parseRecipe(fileName, rawText));
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceDir, recipes }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Converted ${recipes.length} recipes from ${sourceDir}`);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
