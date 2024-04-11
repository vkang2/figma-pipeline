import { readFileSync, writeFileSync } from "fs";
import { convertFigmaVariablesToCss } from "./convert-figma-variables";
const { writeFile } = require("node:fs/promises")


async function main() {
  const file = readFileSync('./figma.json', 'utf-8');

  const conversion = convertFigmaVariablesToCss(JSON.parse(file));
  writeFile('./figma.scss', conversion);

}

main();