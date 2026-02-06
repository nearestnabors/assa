/**
 * Recipe Validation Tests
 *
 * Ensures Goose recipe YAML files are valid and match expected schema.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

// Path to recipes directory (relative to project root)
const RECIPES_DIR = join(import.meta.dir, "../../../recipes");

// Required fields per Goose recipe schema
const REQUIRED_FIELDS = ["title", "description"];
const CONTENT_FIELDS = ["instructions", "prompt"]; // At least one required

interface Recipe {
  title?: string;
  description?: string;
  instructions?: string;
  prompt?: string;
  activities?: string[];
  extensions?: unknown[];
  parameters?: unknown[];
  settings?: Record<string, unknown>;
}

/**
 * Get all YAML files in the recipes directory
 */
function getRecipeFiles(): string[] {
  try {
    const files = readdirSync(RECIPES_DIR);
    return files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch {
    return [];
  }
}

/**
 * Parse a recipe YAML file
 */
function parseRecipe(filename: string): Recipe {
  const filePath = join(RECIPES_DIR, filename);
  const content = readFileSync(filePath, "utf-8");
  return yaml.load(content) as Recipe;
}

describe("Goose Recipes", () => {
  const recipeFiles = getRecipeFiles();

  test("recipes directory exists and contains YAML files", () => {
    expect(recipeFiles.length).toBeGreaterThan(0);
  });

  describe("x-news-digest.yaml", () => {
    const recipe = parseRecipe("x-news-digest.yaml");

    test("has required title field", () => {
      expect(recipe.title).toBeDefined();
      expect(typeof recipe.title).toBe("string");
      expect(recipe.title!.length).toBeGreaterThan(0);
    });

    test("has required description field", () => {
      expect(recipe.description).toBeDefined();
      expect(typeof recipe.description).toBe("string");
      expect(recipe.description!.length).toBeGreaterThan(0);
    });

    test("has instructions or prompt", () => {
      const hasInstructions =
        recipe.instructions && recipe.instructions.length > 0;
      const hasPrompt = recipe.prompt && recipe.prompt.length > 0;
      expect(hasInstructions || hasPrompt).toBe(true);
    });

    test("instructions mention x_timeline_digest tool", () => {
      expect(recipe.instructions).toContain("x_timeline_digest");
    });

    test("instructions include content filtering rules", () => {
      const instructions = recipe.instructions?.toLowerCase() || "";
      expect(instructions).toContain("skip");
      expect(instructions).toContain("ads");
    });

    test("has activities array", () => {
      expect(Array.isArray(recipe.activities)).toBe(true);
      expect(recipe.activities!.length).toBeGreaterThan(0);
    });
  });

  describe("x-conversations.yaml", () => {
    const recipe = parseRecipe("x-conversations.yaml");

    test("has required title field", () => {
      expect(recipe.title).toBeDefined();
      expect(typeof recipe.title).toBe("string");
      expect(recipe.title!.length).toBeGreaterThan(0);
    });

    test("has required description field", () => {
      expect(recipe.description).toBeDefined();
      expect(typeof recipe.description).toBe("string");
      expect(recipe.description!.length).toBeGreaterThan(0);
    });

    test("has instructions or prompt", () => {
      const hasInstructions =
        recipe.instructions && recipe.instructions.length > 0;
      const hasPrompt = recipe.prompt && recipe.prompt.length > 0;
      expect(hasInstructions || hasPrompt).toBe(true);
    });

    test("instructions mention x_conversations tool", () => {
      expect(recipe.instructions).toContain("x_conversations");
    });

    test("has activities array", () => {
      expect(Array.isArray(recipe.activities)).toBe(true);
      expect(recipe.activities!.length).toBeGreaterThan(0);
    });
  });

  // Generic validation for all recipe files
  describe("all recipes", () => {
    for (const filename of recipeFiles) {
      describe(filename, () => {
        test("is valid YAML", () => {
          expect(() => parseRecipe(filename)).not.toThrow();
        });

        test("has required fields", () => {
          const recipe = parseRecipe(filename);

          for (const field of REQUIRED_FIELDS) {
            expect(recipe[field as keyof Recipe]).toBeDefined();
          }

          // Must have at least instructions or prompt
          const hasContent = CONTENT_FIELDS.some(
            (field) =>
              recipe[field as keyof Recipe] !== undefined &&
              (recipe[field as keyof Recipe] as string).length > 0
          );
          expect(hasContent).toBe(true);
        });
      });
    }
  });
});
