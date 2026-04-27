import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const expectedVersion = "1.0.0";

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }

  return result.stdout.trim();
}

async function main() {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  if (packageJson.version !== expectedVersion) {
    throw new Error(`Expected package version ${expectedVersion}, found ${packageJson.version}`);
  }

  JSON.parse(await readFile("public/data/recipes.json", "utf8"));

  run("node", ["--check", "public/app.js"]);
  run("node", ["--check", "scripts/serve.mjs"]);
  run("node", ["--check", "scripts/convert-recipes.mjs"]);

  const status = run("git", ["status", "--short"]);
  if (status) {
    throw new Error(`Working tree is not clean:\n${status}`);
  }

  console.log(`Recipe Shelf ${expectedVersion} release checks passed.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
