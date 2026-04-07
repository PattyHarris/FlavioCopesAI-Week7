import { Recipe } from "./types";

const BOOKMARK_KEY = "recipe-finder-bookmarks";

export function getBookmarks(): Recipe[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(BOOKMARK_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Recipe[];
  } catch {
    return [];
  }
}

export function saveBookmarks(recipes: Recipe[]) {
  window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(recipes));
}

export function clearBookmarks() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BOOKMARK_KEY);
}

export function hasStoredBookmarks() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(BOOKMARK_KEY) !== null;
}

export function toggleBookmark(recipe: Recipe): Recipe[] {
  const bookmarks = getBookmarks();
  const exists = bookmarks.some((entry) => entry.id === recipe.id);
  const next = exists
    ? bookmarks.filter((entry) => entry.id !== recipe.id)
    : [recipe, ...bookmarks];

  saveBookmarks(next);
  return next;
}
