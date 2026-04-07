import { Recipe, RecipeSearchGroup } from "./types";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

export function getStableRecipeId(recipe: Recipe) {
  const title = slugify(recipe.title) || "recipe";
  const fingerprintSource = [
    recipe.title,
    recipe.description,
    recipe.cookTime,
    recipe.difficulty,
    ...recipe.ingredients,
    ...recipe.instructions,
  ].join("||");

  return `${title}-${hashString(fingerprintSource)}`;
}

export function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    id: getStableRecipeId(recipe),
  };
}

export function normalizeRecipes(recipes: Recipe[]) {
  return recipes.map(normalizeRecipe);
}

export function normalizeSearchGroup(group: RecipeSearchGroup): RecipeSearchGroup {
  return {
    ...group,
    recipes: normalizeRecipes(group.recipes),
  };
}
