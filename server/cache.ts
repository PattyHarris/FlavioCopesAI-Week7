import { RecipeResponse } from "./types.js";

const recipeCache = new Map<string, RecipeResponse>();

export function normalizeIngredients(ingredients: string[]) {
  return [...new Set(ingredients.map((item) => item.trim().toLowerCase()))]
    .filter(Boolean)
    .sort();
}

export function getCacheKey(ingredients: string[]) {
  return normalizeIngredients(ingredients).join("|");
}

export function readRecipeCache(ingredients: string[]) {
  return recipeCache.get(getCacheKey(ingredients));
}

export function writeRecipeCache(response: RecipeResponse) {
  recipeCache.set(getCacheKey(response.ingredients), response);
}
