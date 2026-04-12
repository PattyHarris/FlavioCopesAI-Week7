import type { User } from "@supabase/supabase-js";
import { getCacheKey, normalizeIngredients } from "./cache.js";
import {
  createUserSupabaseClient,
  getSupabaseAdminClient,
  isSupabaseAuthEnabled,
} from "./auth.js";
import {
  getFreeSearchLimit,
  getSubscriptionStatus,
  type SubscriptionStatus,
} from "./polar.js";
import { generateRecipeImageBuffer, getImageCacheKey } from "./openai.js";
import type { Recipe, RecipeResponse } from "./types.js";

export type SearchHistoryRow = {
  id: string;
  ingredients: string[];
  cached: boolean;
  recipes: Recipe[];
  createdAt: number;
};

export type UsageSnapshot = {
  freeLimit: number;
  usedSearches: number;
};

export type AppStateResponse = {
  authEnabled: boolean;
  user: { id: string; email: string | null } | null;
  bookmarks: Recipe[];
  searchHistory: SearchHistoryRow[];
  subscription: SubscriptionStatus;
  usage: UsageSnapshot;
};

type SearchHistoryRecord = {
  id: string;
  ingredient_key: string;
  ingredients: string[];
  cached: boolean;
  recipes: Recipe[];
  created_at: string;
  updated_at: string;
  search_count: number;
};

function toSearchHistoryRow(row: SearchHistoryRecord): SearchHistoryRow {
  return {
    id: row.id,
    ingredients: row.ingredients,
    cached: row.cached,
    recipes: row.recipes,
    createdAt: new Date(row.updated_at || row.created_at).getTime(),
  };
}

export function isPersistenceEnabled() {
  return isSupabaseAuthEnabled();
}

export async function getRecipeCacheEntry(ingredients: string[]) {
  if (!isPersistenceEnabled()) {
    return null;
  }

  const ingredientKey = getCacheKey(ingredients);
  const { data, error } = await getSupabaseAdminClient()
    .from("recipe_cache")
    .select("ingredient_key, ingredients, recipes")
    .eq("ingredient_key", ingredientKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ingredients: data.ingredients as string[],
    recipes: data.recipes as Recipe[],
    cached: true,
  } satisfies RecipeResponse;
}

export async function storeRecipeCache(response: RecipeResponse) {
  if (!isPersistenceEnabled()) {
    return;
  }

  const normalizedIngredients = normalizeIngredients(response.ingredients);
  const { error } = await getSupabaseAdminClient().from("recipe_cache").upsert(
    {
      ingredient_key: getCacheKey(normalizedIngredients),
      ingredients: normalizedIngredients,
      recipes: response.recipes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ingredient_key" },
  );

  if (error) {
    throw error;
  }
}

async function listBookmarks(accessToken: string) {
  const client = createUserSupabaseClient(accessToken);
  const result = await client
    .from("bookmarks")
    .select("recipe, updated_at")
    .order("updated_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data.map((row) => row.recipe as Recipe);
}

async function listSearchHistory(accessToken: string) {
  const client = createUserSupabaseClient(accessToken);
  const result = await client
    .from("search_history")
    .select("id, ingredient_key, ingredients, cached, recipes, created_at, updated_at, search_count")
    .order("updated_at", { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return result.data.map((row) => toSearchHistoryRow(row as SearchHistoryRecord));
}

async function getUsedSearchCount(accessToken: string) {
  const client = createUserSupabaseClient(accessToken);
  const result = await client.from("search_history").select("search_count");

  if (result.error) {
    throw result.error;
  }

  return result.data.reduce(
    (total, row) => total + Number((row as { search_count: number }).search_count || 0),
    0,
  );
}

export async function getAppStateForUser(
  user: User | null,
  accessToken: string | null,
): Promise<AppStateResponse> {
  if (!user || !accessToken || !isPersistenceEnabled()) {
    return {
      authEnabled: isSupabaseAuthEnabled(),
      user: user ? { id: user.id, email: user.email ?? null } : null,
      bookmarks: [],
      searchHistory: [],
      subscription: {
        enabled: false,
        pro: false,
        productId: null,
        subscriptionId: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        managementEnabled: false,
      },
      usage: {
        freeLimit: getFreeSearchLimit(),
        usedSearches: 0,
      },
    };
  }

  const [bookmarks, searchHistory, usedSearches, subscription] = await Promise.all([
    listBookmarks(accessToken),
    listSearchHistory(accessToken),
    getUsedSearchCount(accessToken),
    getSubscriptionStatus(user),
  ]);

  return {
    authEnabled: true,
    user: { id: user.id, email: user.email ?? null },
    bookmarks,
    searchHistory,
    subscription,
    usage: {
      freeLimit: getFreeSearchLimit(),
      usedSearches,
    },
  };
}

export async function createBookmark(accessToken: string, userId: string, recipe: Recipe) {
  const client = createUserSupabaseClient(accessToken);
  const { error } = await client.from("bookmarks").upsert(
    {
      user_id: userId,
      recipe_id: recipe.id,
      recipe,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,recipe_id" },
  );

  if (error) {
    throw error;
  }
}

export async function deleteBookmark(accessToken: string, recipeId: string) {
  const client = createUserSupabaseClient(accessToken);
  const { error } = await client.from("bookmarks").delete().eq("recipe_id", recipeId);

  if (error) {
    throw error;
  }
}

export async function clearBookmarksPersistence(accessToken: string) {
  const client = createUserSupabaseClient(accessToken);
  const { error } = await client.from("bookmarks").delete().neq("recipe_id", "");

  if (error) {
    throw error;
  }
}

export async function updateSearchHistoryGroup(
  accessToken: string,
  userId: string,
  group: SearchHistoryRow,
) {
  const client = createUserSupabaseClient(accessToken);
  const ingredientKey = getCacheKey(group.ingredients);
  const now = new Date().toISOString();
  const { error } = await client
    .from("search_history")
    .update({
      user_id: userId,
      ingredient_key: ingredientKey,
      ingredients: normalizeIngredients(group.ingredients),
      cached: group.cached,
      recipes: group.recipes,
      updated_at: now,
    })
    .eq("id", group.id);

  if (error) {
    throw error;
  }
}

export async function clearSearchHistoryPersistence(accessToken: string) {
  const client = createUserSupabaseClient(accessToken);
  const { error } = await client.from("search_history").delete().neq("id", "");

  if (error) {
    throw error;
  }
}

export async function recordSearchHistoryGroup(
  accessToken: string,
  userId: string,
  group: Omit<SearchHistoryRow, "id" | "createdAt"> & { createdAt?: number },
) {
  const client = createUserSupabaseClient(accessToken);
  const ingredientKey = getCacheKey(group.ingredients);
  const existingResult = await client
    .from("search_history")
    .select("id, ingredient_key, ingredients, cached, recipes, created_at, updated_at, search_count")
    .eq("ingredient_key", ingredientKey)
    .maybeSingle();

  if (existingResult.error) {
    throw existingResult.error;
  }

  const normalizedIngredients = normalizeIngredients(group.ingredients);
  const now = new Date().toISOString();

  if (existingResult.data) {
    const current = existingResult.data as SearchHistoryRecord;
    const updatedResult = await client
      .from("search_history")
      .update({
        ingredients: normalizedIngredients,
        cached: group.cached,
        recipes: group.recipes,
        updated_at: now,
        search_count: current.search_count + 1,
      })
      .eq("id", current.id)
      .select("id, ingredient_key, ingredients, cached, recipes, created_at, updated_at, search_count")
      .single();

    if (updatedResult.error) {
      throw updatedResult.error;
    }

    return toSearchHistoryRow(updatedResult.data as SearchHistoryRecord);
  }

  const insertResult = await client
    .from("search_history")
    .insert({
      user_id: userId,
      ingredient_key: ingredientKey,
      ingredients: normalizedIngredients,
      cached: group.cached,
      recipes: group.recipes,
      created_at: group.createdAt ? new Date(group.createdAt).toISOString() : now,
      updated_at: now,
      search_count: 1,
    })
    .select("id, ingredient_key, ingredients, cached, recipes, created_at, updated_at, search_count")
    .single();

  if (insertResult.error) {
    throw insertResult.error;
  }

  return toSearchHistoryRow(insertResult.data as SearchHistoryRecord);
}

export async function getUsageSnapshot(accessToken: string) {
  return {
    freeLimit: getFreeSearchLimit(),
    usedSearches: await getUsedSearchCount(accessToken),
  };
}

export async function getRecipeImageUrl(recipe: Pick<Recipe, "title" | "description">) {
  if (!isPersistenceEnabled()) {
    return null;
  }

  const imageKey = getImageCacheKey(recipe);
  const adminClient = getSupabaseAdminClient();

  const existingImage = await adminClient
    .from("recipe_images")
    .select("storage_path")
    .eq("image_key", imageKey)
    .maybeSingle();

  if (existingImage.error) {
    throw existingImage.error;
  }

  if (existingImage.data?.storage_path) {
    const publicUrl = adminClient.storage
      .from("recipe-images")
      .getPublicUrl(existingImage.data.storage_path).data.publicUrl;

    return publicUrl || null;
  }

  const imageBuffer = await generateRecipeImageBuffer(recipe);
  if (!imageBuffer) {
    return null;
  }

  const storagePath = `${imageKey.replace(/[^a-z0-9|]/g, "-").replace(/\|+/g, "-")}.webp`;
  const uploadResult = await adminClient.storage
    .from("recipe-images")
    .upload(storagePath, imageBuffer, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const saveResult = await adminClient.from("recipe_images").upsert(
    {
      image_key: imageKey,
      storage_path: storagePath,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "image_key" },
  );

  if (saveResult.error) {
    throw saveResult.error;
  }

  return adminClient.storage.from("recipe-images").getPublicUrl(storagePath).data.publicUrl;
}
