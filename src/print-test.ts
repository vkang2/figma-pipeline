import { readFileSync, writeFileSync } from "fs";

async function main() {
  const file = readFileSync('fetch-api-data-action/figma.json', 'utf-8');

  writeFileSync('fetch-api-data-action/figma_copy.json', 'utf-8');

  console.log("Hello, world!");
  console.log(file)
}

main();