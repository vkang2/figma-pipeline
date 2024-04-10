import { readFileSync, writeFileSync } from "fs";

async function main() {
  const file = readFileSync('fetch-api-data-action/figma.json', 'utf-8');

  writeFileSync('fetch-api-data-action/figma_copy.json', JSON.stringify(file, null, 2))

  console.log("Hello, world!");
  console.log(file)
}

main();