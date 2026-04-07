import { useEffect, useMemo, useState } from "react";
import { IngredientInput } from "./components/IngredientInput";
import { RecipeCard } from "./components/RecipeCard";
import { RecipeModal } from "./components/RecipeModal";
import { SearchResultsRow } from "./components/SearchResultsRow";
import { normalizeRecipe, normalizeRecipes, normalizeSearchGroup } from "./lib/recipeIdentity";
import {
  clearBookmarks,
  getBookmarks,
  hasStoredBookmarks,
  saveBookmarks,
  toggleBookmark,
} from "./lib/storage";
import {
  PersistenceStateResponse,
  Recipe,
  RecipeResponse,
  RecipeSearchGroup,
} from "./lib/types";

type View = "discover" | "bookmarks";

export default function App() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [searchGroups, setSearchGroups] = useState<RecipeSearchGroup[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [bookmarks, setBookmarks] = useState<Recipe[]>([]);
  const [imageStates, setImageStates] = useState<
    Record<string, "idle" | "loading" | "ready" | "failed">
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeView, setActiveView] = useState<View>("discover");
  const [lastFetchSummary, setLastFetchSummary] = useState("");
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const localBookmarks = getBookmarks();
      if (isMounted) {
        setBookmarks(normalizeRecipes(localBookmarks));
      }

      try {
        const response = await fetch("/api/state");
        if (!response.ok) {
          throw new Error("Unable to load app state.");
        }

        const data = (await response.json()) as PersistenceStateResponse;
        if (!isMounted) {
          return;
        }

        setPersistenceEnabled(data.enabled);

        if (data.enabled) {
          const normalizedBookmarks = normalizeRecipes(data.bookmarks);
          const normalizedHistory = data.searchHistory.map(normalizeSearchGroup);

          setBookmarks(normalizedBookmarks);
          saveBookmarks(normalizedBookmarks);
          setSearchGroups(normalizedHistory);
          setImageStates(() => {
            const next: Record<string, "idle" | "loading" | "ready" | "failed"> = {};
            for (const group of normalizedHistory) {
              for (const recipe of group.recipes) {
                next[`${group.id}:${recipe.id}`] = recipe.imageUrl ? "ready" : "idle";
              }
            }
            return next;
          });
        }
      } catch {
        if (isMounted) {
          setPersistenceEnabled(false);
          if (!hasStoredBookmarks()) {
            setBookmarks(localBookmarks);
          }
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.id)),
    [bookmarks],
  );

  const shownRecipes = activeView === "discover" ? [] : bookmarks;

  const getIngredientKey = (items: string[]) =>
    [...new Set(items.map((item) => item.trim().toLowerCase()))]
      .filter(Boolean)
      .sort()
      .join("|");

  const focusSearchGroup = (groupId: string) => {
    setHighlightedGroupId(groupId);

    window.setTimeout(() => {
      document
        .getElementById(`search-group-${groupId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);

    window.setTimeout(() => {
      setHighlightedGroupId((current) => (current === groupId ? null : current));
    }, 2200);
  };

  const addIngredient = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    setIngredients((current) => {
      if (current.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        return current;
      }

      return [...current, normalized];
    });
  };

  const removeIngredient = (value: string) => {
    setIngredients((current) => current.filter((item) => item !== value));
  };

  const handleToggleBookmark = (recipe: Recipe) => {
    const normalizedRecipe = normalizeRecipe(recipe);
    const wasBookmarked = bookmarks.some(
      (bookmark) => bookmark.id === normalizedRecipe.id,
    );
    const next = toggleBookmark(normalizedRecipe);
    setBookmarks(next);
    if (persistenceEnabled) {
      void persistBookmarks(next);
    }
    if (!wasBookmarked && !normalizedRecipe.imageUrl) {
      void loadBookmarkImage(normalizedRecipe);
    }
  };

  const handleClearBookmarks = () => {
    clearBookmarks();
    setBookmarks([]);
    if (persistenceEnabled) {
      void fetch("/api/bookmarks", { method: "DELETE" });
    }
  };

  const handleClearSearchHistory = () => {
    setSearchGroups([]);
    setImageStates({});
    setLastFetchSummary("");
    setSelectedRecipe(null);
    setIsClearHistoryModalOpen(false);
    if (persistenceEnabled) {
      void fetch("/api/search-history", { method: "DELETE" });
    }
  };

  const persistBookmarks = async (nextBookmarks: Recipe[]) => {
    await fetch("/api/bookmarks", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bookmarks: nextBookmarks }),
    });
  };

  const persistSearchGroup = async (group: RecipeSearchGroup) => {
    await fetch("/api/search-history", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ group }),
    });
  };

  const loadBookmarkImage = async (recipe: Recipe) => {
    try {
      const response = await fetch("/api/recipes/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: recipe.title,
          description: recipe.description,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate bookmark image.");
      }

      const data = (await response.json()) as { imageUrl: string | null };
      if (!data.imageUrl) {
        return;
      }
      const imageUrl = data.imageUrl;

      setBookmarks((current) => {
        const next = current.map((bookmark) =>
          bookmark.id === recipe.id ? { ...bookmark, imageUrl } : bookmark,
        );

        saveBookmarks(next);
        if (persistenceEnabled) {
          void persistBookmarks(next);
        }

        return next;
      });
    } catch {
      // A missing bookmark image should not break the rest of the app flow.
    }
  };

  const updateRecipeImageInGroups = (
    groupId: string,
    recipeId: string,
    imageUrl: string,
  ) => {
    setSelectedRecipe((current) =>
      current && current.id === recipeId ? { ...current, imageUrl } : current,
    );

    setSearchGroups((current) => {
      const nextGroups = current.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              recipes: group.recipes.map((recipe) =>
                recipe.id !== recipeId ? recipe : { ...recipe, imageUrl },
              ),
            },
      );

      const updatedGroup = nextGroups.find((group) => group.id === groupId);
      if (updatedGroup && persistenceEnabled) {
        void persistSearchGroup(updatedGroup);
      }

      return nextGroups;
    });
  };

  const loadImagesForGroup = async (group: RecipeSearchGroup) => {
    await Promise.all(
      group.recipes.map(async (recipe) => {
        const stateKey = `${group.id}:${recipe.id}`;

        setImageStates((current) => ({ ...current, [stateKey]: "loading" }));

        try {
          const response = await fetch("/api/recipes/image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: recipe.title,
              description: recipe.description,
            }),
          });

          if (!response.ok) {
            throw new Error("Unable to generate image.");
          }

          const data = (await response.json()) as { imageUrl: string | null };

          if (data.imageUrl) {
            updateRecipeImageInGroups(group.id, recipe.id, data.imageUrl);
            setImageStates((current) => ({ ...current, [stateKey]: "ready" }));
          } else {
            setImageStates((current) => ({ ...current, [stateKey]: "failed" }));
          }
        } catch {
          setImageStates((current) => ({ ...current, [stateKey]: "failed" }));
        }
      }),
    );
  };

  const fetchRecipes = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/recipes/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ingredients }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errorPayload?.error || "Unable to fetch recipes right now.");
      }

      const data = (await response.json()) as RecipeResponse;
      const ingredientKey = getIngredientKey(data.ingredients);
      const existingGroup = searchGroups.find(
        (group) => getIngredientKey(group.ingredients) === ingredientKey,
      );

      if (existingGroup) {
        const refreshedGroup: RecipeSearchGroup = {
          ...existingGroup,
          cached: data.cached,
          createdAt: Date.now(),
        };

        setSearchGroups((current) => [
          refreshedGroup,
          ...current.filter((group) => group.id !== existingGroup.id),
        ]);
        if (persistenceEnabled) {
          void persistSearchGroup(refreshedGroup);
        }
        setActiveView("discover");
        setLastFetchSummary(
          `Showing previous results for ${data.ingredients.join(", ")}.`,
        );
        focusSearchGroup(existingGroup.id);
        return;
      }

      const nextGroup: RecipeSearchGroup = {
        ...data,
        recipes: normalizeRecipes(data.recipes),
        id: `${Date.now()}-${data.ingredients.join("-")}`,
        createdAt: Date.now(),
      };

      setImageStates((current) => {
        const next = { ...current };
        for (const recipe of nextGroup.recipes) {
          next[`${nextGroup.id}:${recipe.id}`] = "idle";
        }
        return next;
      });
      setSearchGroups((current) => [nextGroup, ...current]);
      if (persistenceEnabled) {
        void persistSearchGroup(nextGroup);
      }
      setActiveView("discover");
      setLastFetchSummary(
        `${data.cached ? "Loaded from cache" : "Fresh AI suggestions"} for ${data.ingredients.join(", ")}.`,
      );
      focusSearchGroup(nextGroup.id);
      void loadImagesForGroup(nextGroup);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <header className="mx-auto mb-8 flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-terracotta-500">
            Pantry Chef
          </p>
          <p className="mt-2 text-sm text-muted-600">
            Editorial pantry cooking, guided by AI.
          </p>
        </div>

        <nav className="flex flex-wrap gap-3" aria-label="Primary">
          <button
            className={
              activeView === "discover"
                ? "rounded-full bg-sage-700 px-5 py-3 text-sm font-medium text-white shadow-card transition hover:-translate-y-0.5"
                : "rounded-full border border-stone-300/80 bg-white/40 px-5 py-3 text-sm font-medium text-muted-600 transition hover:-translate-y-0.5"
            }
            type="button"
            onClick={() => setActiveView("discover")}
          >
            Home
          </button>
          <button
            className={
              activeView === "bookmarks"
                ? "rounded-full bg-sage-700 px-5 py-3 text-sm font-medium text-white shadow-card transition hover:-translate-y-0.5"
                : "rounded-full border border-stone-300/80 bg-white/40 px-5 py-3 text-sm font-medium text-muted-600 transition hover:-translate-y-0.5"
            }
            type="button"
            onClick={() => setActiveView("bookmarks")}
          >
            My Bookmarks
          </button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6">
        {activeView === "discover" ? (
          <>
            <section className="rounded-[36px] border border-white/60 bg-white/50 px-6 py-8 shadow-card backdrop-blur-md sm:px-8 lg:px-10">
              <div className="mx-auto max-w-4xl">
                <div className="mb-10 text-center">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.32em] text-terracotta-500">
                    Pantry Chef
                  </p>
                  <h1 className="mx-auto max-w-4xl font-display text-5xl leading-[1.02] text-ink-900 sm:text-6xl lg:text-7xl">
                    What&apos;s in your
                    <br />
                    Kitchen Today?
                  </h1>
                  <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-600 sm:text-xl">
                    Input your ingredients and let our editorial curators
                    suggest suggest a seasonal masterpiece crafted for your
                    palate
                  </p>
                </div>

                <div className="mx-auto max-w-2xl">
                  <IngredientInput
                    ingredients={ingredients}
                    onAddIngredient={addIngredient}
                    onRemoveIngredient={removeIngredient}
                    onSuggestRecipes={fetchRecipes}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            </section>

            <section
              className="rounded-[32px] border border-white/60 bg-white/65 p-6 shadow-card backdrop-blur-md"
              aria-live="polite"
            >
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
                    Pantry Chef Suggestions
                  </p>
                  <h2 className="font-display text-3xl text-ink-900">
                    Thoughtful ideas for tonight
                  </h2>
                </div>
                {lastFetchSummary ? (
                  <p className="text-sm text-muted-600">{lastFetchSummary}</p>
                ) : (
                  <p className="text-sm text-muted-600">
                    Your next set of recipe cards will appear here.
                  </p>
                )}
              </div>

              {errorMessage ? (
                <p className="mb-4 rounded-2xl bg-terracotta-500/10 px-4 py-4 text-sm text-[#8b381a]">
                  {errorMessage}
                </p>
              ) : null}

              {searchGroups.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-stone-300/80 bg-white/45 p-6">
                  <h3 className="font-display text-2xl text-ink-900">
                    No recipes yet
                  </h3>
                  <p className="mt-2 max-w-xl text-muted-600">
                    Add a few ingredients, press Suggest Recipes, and we will
                    generate four recipe cards with details you can open and
                    save.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-5">
                    {searchGroups.map((group) => (
                      <SearchResultsRow
                        key={group.id}
                        group={group}
                      onOpen={setSelectedRecipe}
                      onToggleBookmark={handleToggleBookmark}
                      bookmarkedIds={bookmarkedIds}
                      imageStates={imageStates}
                      highlighted={highlightedGroupId === group.id}
                    />
                  ))}
                </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      className="rounded-full border border-stone-300/80 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
                      type="button"
                      onClick={() => setIsClearHistoryModalOpen(true)}
                    >
                      Clear Search History
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        ) : (
          <section
            className="rounded-[32px] border border-white/60 bg-white/65 p-6 shadow-card backdrop-blur-md"
            aria-live="polite"
          >
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
                  Pantry Chef Bookmarks
                </p>
                <h2 className="font-display text-3xl text-ink-900">
                  Your bookmarked dishes
                </h2>
              </div>
              <button
                className="rounded-full border border-stone-300/80 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleClearBookmarks}
                disabled={bookmarks.length === 0}
              >
                Remove Bookmarks
              </button>
            </div>

            {shownRecipes.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-stone-300/80 bg-white/45 p-6">
                <h3 className="font-display text-2xl text-ink-900">
                  No bookmarks yet
                </h3>
                <p className="mt-2 text-muted-600">
                  Save any recipe you like from the home screen and it will
                  appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shownRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onOpen={setSelectedRecipe}
                    onToggleBookmark={handleToggleBookmark}
                    isBookmarked={bookmarkedIds.has(recipe.id)}
                    imageState={recipe.imageUrl ? "ready" : "idle"}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <RecipeModal
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onToggleBookmark={handleToggleBookmark}
        isBookmarked={selectedRecipe ? bookmarkedIds.has(selectedRecipe.id) : false}
      />

      {isClearHistoryModalOpen ? (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-stone-950/55 p-4"
          role="presentation"
          onClick={() => setIsClearHistoryModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] bg-[#fffaf3] p-6 shadow-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
              Confirm Action
            </p>
            <h2
              id="clear-history-title"
              className="font-display text-3xl text-ink-900"
            >
              Clear all search history?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-600">
              This will remove every grouped search result currently shown on
              the home screen. It will not delete your saved bookmarks.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-full border border-stone-300/80 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
                type="button"
                onClick={() => setIsClearHistoryModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-sage-700 px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5"
                type="button"
                onClick={handleClearSearchHistory}
              >
                Clear Search History
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
