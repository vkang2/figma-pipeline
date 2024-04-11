import { GetLocalVariablesResponse, LocalVariable } from "@figma/rest-api-spec";
import { RGB, RGBA } from "@figma/rest-api-spec";

/**
 * This file defines what design tokens and design token files look like in the codebase.
 *
 * Tokens are distinct from variables, in that a [token](https://tr.designtokens.org/format/#design-token)
 * is a name/value pair (with other properties), while a variable in Figma stores multiple values,
 * one for each mode.
 */

import { VariableCodeSyntax, VariableScope } from "@figma/rest-api-spec";

export interface Token {
  /**
   * The [type](https://tr.designtokens.org/format/#type-0) of the token.
   *
   * We allow `string` and `boolean` types in addition to the draft W3C spec's `color` and `number` types
   * to align with the resolved types for Figma variables.
   */
  $type: "color" | "number" | "string" | "boolean";
  $value: string | number | boolean;
  $description?: string;
  $extensions?: {
    /**
     * The `com.figma` namespace sto`res Figma-specific variable properties
     */
    "com.figma"?: {
      hiddenFromPublishing?: boolean;
      scopes?: VariableScope[];
      codeSyntax?: VariableCodeSyntax;
    };
  };
}

export type TokenOrTokenGroup =
  | Token
  | ({
      [tokenName: string]: Token;
    } & { $type?: never; $value?: never });

/**
 * Defines what we expect a Design Tokens file to look like in the codebase.
 *
 * This format mostly adheres to the [draft W3C spec for Design Tokens](https://tr.designtokens.org/format/)
 * as of its most recent 24 July 2023 revision except for the $type property, for which
 * we allow `string` and `boolean` values in addition to the spec's `color` and `number` values.
 * We need to support `string` and `boolean` types to align with the resolved types for Figma variables.
 *
 * Additionally, we expect each tokens file to define tokens for a single variable collection and mode.
 * There currently isn't a way to represent modes or themes in the W3C community group design token specification.
 * Once the spec resolves how it wants to treat/handle modes, this code will be updated to reflect the new standard.
 *
 * Follow this discussion for updates: https://github.com/design-tokens/community-group/issues/210
 */
export type TokensFile = {
  [key: string]: TokenOrTokenGroup;
};

/**
 * Compares two colors for approximate equality since converting between Figma RGBA objects (from 0 -> 1) and
 * hex colors can result in slight differences.
 */
export function colorApproximatelyEqual(
  colorA: RGB | RGBA,
  colorB: RGB | RGBA
) {
  return rgbToHex(colorA) === rgbToHex(colorB);
}

export function parseColor(color: string): RGB | RGBA {
  color = color.trim();
  const hexRegex = /^#([A-Fa-f0-9]{6})([A-Fa-f0-9]{2}){0,1}$/;
  const hexShorthandRegex = /^#([A-Fa-f0-9]{3})([A-Fa-f0-9]){0,1}$/;

  if (hexRegex.test(color) || hexShorthandRegex.test(color)) {
    const hexValue = color.substring(1);
    const expandedHex =
      hexValue.length === 3 || hexValue.length === 4
        ? hexValue
            .split("")
            .map((char) => char + char)
            .join("")
        : hexValue;

    const alphaValue =
      expandedHex.length === 8 ? expandedHex.slice(6, 8) : undefined;

    return {
      r: parseInt(expandedHex.slice(0, 2), 16) / 255,
      g: parseInt(expandedHex.slice(2, 4), 16) / 255,
      b: parseInt(expandedHex.slice(4, 6), 16) / 255,
      ...(alphaValue ? { a: parseInt(alphaValue, 16) / 255 } : {}),
    };
  } else {
    throw new Error("Invalid color format");
  }
}

export function rgbToHex({ r, g, b, ...rest }: RGB | RGBA) {
  const a = "a" in rest ? rest.a : 1;

  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}` + (a !== 1 ? toHex(a) : "");
}

function tokenTypeFromVariable(variable: LocalVariable) {
  switch (variable.resolvedType) {
    case "BOOLEAN":
      return "boolean";
    case "COLOR":
      return "color";
    case "FLOAT":
      return "number";
    case "STRING":
      return "string";
  }
}

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

function getValueFromVariable(
  variable: LocalVariable,
  mode: {
    modeId: string;
    name: string;
  },
  localVariables: { [id: string]: LocalVariable },
  variableValues: { [key: string]: any },
) {
  const value = variable.valuesByMode[mode.modeId];
  if (typeof value === "object") {
    if ("type" in value && value.type === "VARIABLE_ALIAS") {
      console.log(mode)

      const aliasVariable = localVariables[value.id];
      const aliasVariableName = getCSSVariableName(aliasVariable, mode);
      
      console.log(aliasVariableName)
      const aliasedVariableValue = variableValues[aliasVariableName];
      return aliasedVariableValue;
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
  const variables: string[] = [];
  const variableValues: { [key: string]: any } = {};

  Object.values(localVariables).forEach((variable) => {
    const collection = localVariableCollections[variable.variableCollectionId];

    collection.modes.forEach((mode) => {
      let variableName = getCSSVariableName(variable, mode);

      variableValues[variableName] = getValueFromVariable(
        variable,
        mode,
        localVariables,
        variableValues
      );

      variables.push(variableName);
    });
  });

  return `// Generated SCSS variables from Figma Variables // \n\n${variables
    .map((variable) => `$${variable}: ${variableValues[variable]};`)
    .join("\n")}\n`;
}
