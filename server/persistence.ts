import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Recipe } from "./types.js";

type SearchHistoryRow = {
  id: string;
  ingredients: string[];
  cached: boolean;
  recipes: Recipe[];
  createdAt: number;
};

let supabaseClient: SupabaseClient | null = null;

function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    return null;
  }

  return { url, secretKey };
}

export function isPersistenceEnabled() {
  return Boolean(getSupabaseCredentials());
}

function getClient() {
  const credentials = getSupabaseCredentials();

  if (!credentials) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(credentials.url, credentials.secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export async function getPersistenceState() {
  const client = getClient();
  if (!client) {
    return {
      enabled: false,
      bookmarks: [] as Recipe[],
      searchHistory: [] as SearchHistoryRow[],
    };
  }

  const [bookmarksResult, searchHistoryResult] = await Promise.all([
    client
      .from("bookmarks")
      .select("recipe, updated_at")
      .order("updated_at", { ascending: false }),
    client
      .from("search_history")
      .select("id, ingredients, cached, recipes, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (bookmarksResult.error) {
    throw bookmarksResult.error;
  }

  if (searchHistoryResult.error) {
    throw searchHistoryResult.error;
  }

  return {
    enabled: true,
    bookmarks: bookmarksResult.data.map((row) => row.recipe as Recipe),
    searchHistory: searchHistoryResult.data.map((row) => ({
      id: row.id,
      ingredients: row.ingredients,
      cached: row.cached,
      recipes: row.recipes as Recipe[],
      createdAt: new Date(row.created_at).getTime(),
    })),
  };
}

export async function replaceBookmarks(bookmarks: Recipe[]) {
  const client = getClient();
  if (!client) {
    return { enabled: false };
  }

  const deleteResult = await client
    .from("bookmarks")
    .delete()
    .neq("recipe_id", "");

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (bookmarks.length > 0) {
    const insertResult = await client.from("bookmarks").insert(
      bookmarks.map((recipe) => ({
        recipe_id: recipe.id,
        recipe,
      })),
    );

    if (insertResult.error) {
      throw insertResult.error;
    }
  }

  return { enabled: true };
}

export async function clearBookmarksPersistence() {
  return replaceBookmarks([]);
}

export async function upsertSearchHistoryGroup(group: SearchHistoryRow) {
  const client = getClient();
  if (!client) {
    return { enabled: false };
  }

  const result = await client.from("search_history").upsert({
    id: group.id,
    ingredients: group.ingredients,
    cached: group.cached,
    recipes: group.recipes,
    created_at: new Date(group.createdAt).toISOString(),
  });

  if (result.error) {
    throw result.error;
  }

  return { enabled: true };
}

export async function clearSearchHistoryPersistence() {
  const client = getClient();
  if (!client) {
    return { enabled: false };
  }

  const result = await client
    .from("search_history")
    .delete()
    .neq("id", "");

  if (result.error) {
    throw result.error;
  }

  return { enabled: true };
}
