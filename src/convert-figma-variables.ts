import { GetLocalVariablesResponse, LocalVariable } from "@figma/rest-api-spec";
import { RGB, RGBA } from "@figma/rest-api-spec";

export function rgbToHex({ r, g, b, ...rest }: RGB | RGBA) {
  const a = "a" in rest ? rest.a : 1;

  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}` + (a !== 1 ? toHex(a) : "");
}

/** Returns the name of a variable in CSS format */
function getCSSVariableName(
  variable: LocalVariable,
  mode: {
    modeId: string;
    name: string;
  }
) {
  const variableNameStructure = variable.name.split("/");
  let variableName = variable.name;
  if (variableNameStructure.length > 1) {
    variableName = variable.name.split("/")[1];
  } else if (variableNameStructure.length === 1) {
    variableName = variable.name.split("/")[0];
  } else {
    throw new Error(`Unexpected variable name structure: ${variable.name}`);
  }
  variableName = `${variableName}-${mode.name.replace(
    " ",
    "-"
  )}`.toLocaleLowerCase();
  return variableName;
}

/** Returns the value of a variable in a specific mode */
function getValueFromVariable(
  variable: LocalVariable,
  mode: {
    modeId: string;
    name: string;
  },
  valuesById: { [id: string]: string }
) {
  const value = variable.valuesByMode[mode.modeId];
  if (typeof value === "object") {
    if ("type" in value && value.type === "VARIABLE_ALIAS") {
      return `$${valuesById[value.id]}`;
    } else if ("r" in value) {
      return rgbToHex(value);
    }

    throw new Error(`Format of variable value is invalid: ${value}`);
  } else if (typeof value === "number") {
    return `${value}px`;
  } else {
    return value;
  }
}

export function convertFigmaVariablesToCss(
  figmaInput: GetLocalVariablesResponse
): any {
  const localVariableCollections = figmaInput.meta.variableCollections;
  const localVariables = figmaInput.meta.variables;
  const variablesByCollection: { [key: string]: string[] } = {};
  const valuesById: { [id: string]: string } = {};

  Object.values(localVariables).forEach((variable) => {
    const collection = localVariableCollections[variable.variableCollectionId];

    if (!collection) {
      throw new Error(`Collection not found for variable ${variable.name}`);
    }

    if (!variablesByCollection[collection.name]) {
      variablesByCollection[collection.name] = [];
    }

    collection.modes.forEach((mode) => {
      let variableName = getCSSVariableName(variable, mode);
      valuesById[variable.id] = variableName;

      const variableValue = getValueFromVariable(variable, mode, valuesById);

      variablesByCollection[collection.name].push(
        `$${variableName}: ${variableValue};\n`
      );
    });
  });

  let finalOutput = `// Generated SCSS variables from Figma Variables //\n\n`;

  for (const [collection, values] of Object.entries(variablesByCollection)) {
    finalOutput += `// ${collection} Collection\n`;
    values.forEach((variable) => {
      finalOutput += variable;
    });
    finalOutput += "\n";
  }

  return finalOutput;
}
