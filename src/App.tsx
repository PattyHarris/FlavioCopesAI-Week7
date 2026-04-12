import { useEffect, useMemo, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { IngredientInput } from "./components/IngredientInput";
import { LoginModal } from "./components/LoginModal";
import { RecipeModal } from "./components/RecipeModal";
import { SearchResultsRow } from "./components/SearchResultsRow";
import { normalizeRecipe, normalizeRecipes, normalizeSearchGroup } from "./lib/recipeIdentity";
import { getSupabaseBrowserClient } from "./lib/supabase";
import type {
  AppStateResponse,
  Recipe,
  RecipeResponse,
  RecipeSearchGroup,
  SubscriptionState,
  UsageSnapshot,
} from "./lib/types";

type View = "discover" | "bookmarks";
type ImageState = "idle" | "loading" | "ready" | "failed";

const emptySubscription: SubscriptionState = {
  enabled: false,
  pro: false,
  productId: null,
  subscriptionId: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  managementEnabled: false,
};

const emptyUsage: UsageSnapshot = {
  freeLimit: 3,
  usedSearches: 0,
};

export default function App() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [searchGroups, setSearchGroups] = useState<RecipeSearchGroup[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [bookmarks, setBookmarks] = useState<Recipe[]>([]);
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeView, setActiveView] = useState<View>("discover");
  const [lastFetchSummary, setLastFetchSummary] = useState("");
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginStatusMessage, setLoginStatusMessage] = useState("");
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState>(emptySubscription);
  const [usage, setUsage] = useState<UsageSnapshot>(emptyUsage);
  const [authEnabled, setAuthEnabled] = useState(false);

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.id)),
    [bookmarks],
  );

  const shownRecipes = activeView === "discover" ? [] : bookmarks;
  const isAuthenticated = Boolean(userId);
  const hasFreeSearchesLeft = subscription.pro || usage.usedSearches < usage.freeLimit;
  const usageLabel = subscription.pro
    ? "Pro ∞"
    : `${Math.min(usage.usedSearches, usage.freeLimit)} of ${usage.freeLimit} free searches`;

  useEffect(() => {
    let isMounted = true;

    const clearAuthParamsFromUrl = () => {
      const url = new URL(window.location.href);
      [
        "code",
        "token_hash",
        "type",
        "next",
        "error",
        "error_code",
        "error_description",
      ].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    };

    const syncSessionToServer = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return;
      }

      const sessionResult = await supabase.auth.getSession();
      const session = sessionResult.data.session;

      if (!session?.access_token) {
        return;
      }

      await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        }),
      });
    };

    const loadState = async () => {
      const response = await fetch("/api/state", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to load app state.");
      }

      const data = (await response.json()) as AppStateResponse;
      if (!isMounted) {
        return;
      }

      setAuthEnabled(data.authEnabled);
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
      setSubscription(data.subscription);
      setUsage(data.usage);

      const normalizedBookmarks = normalizeRecipes(data.bookmarks);
      const normalizedHistory = data.searchHistory.map(normalizeSearchGroup);

      setBookmarks(normalizedBookmarks);
      setSearchGroups(normalizedHistory);
      setImageStates(() => {
        const next: Record<string, ImageState> = {};
        for (const group of normalizedHistory) {
          for (const recipe of group.recipes) {
            next[`${group.id}:${recipe.id}`] = recipe.imageUrl ? "ready" : "idle";
          }
        }
        return next;
      });
    };

    const handleAuthRedirect = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        return;
      }

      const url = new URL(window.location.href);
      const authCode = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const authError = url.searchParams.get("error_description");

      if (authError) {
        setLoginStatusMessage(decodeURIComponent(authError));
        clearAuthParamsFromUrl();
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          setLoginStatusMessage(error.message);
        } else {
          setLoginStatusMessage("Signed in successfully.");
          setIsLoginModalOpen(false);
        }
        clearAuthParamsFromUrl();
        return;
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        });

        if (error) {
          setLoginStatusMessage(error.message);
        } else {
          setLoginStatusMessage("Signed in successfully.");
          setIsLoginModalOpen(false);
        }

        clearAuthParamsFromUrl();
      }
    };

    const bootstrap = async () => {
      const supabase = getSupabaseBrowserClient();

      if (supabase) {
        await handleAuthRedirect();
        await syncSessionToServer();

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!session?.access_token) {
            void fetch("/api/auth/sign-out", {
              method: "POST",
              credentials: "include",
            }).then(() => {
              if (!isMounted) {
                return;
              }
              setUserId(null);
              setUserEmail(null);
              setBookmarks([]);
              setSearchGroups([]);
              setUsage(emptyUsage);
              setSubscription(emptySubscription);
            });
            return;
          }

          void fetch("/api/auth/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
            }),
          }).then(() => loadState().catch(() => undefined));
        });

        try {
          await loadState();
        } catch {
          await syncSessionToServer();
          await loadState();
        }

        return () => {
          data.subscription.unsubscribe();
        };
      }

      await loadState();
      return undefined;
    };

    let unsubscribe: (() => void) | undefined;
    void bootstrap().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

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

  const refreshSubscription = async () => {
    const response = await fetch("/api/subscription", {
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as {
      subscription: SubscriptionState;
      usage: UsageSnapshot;
    };

    setSubscription(data.subscription);
    setUsage(data.usage);
  };

  const handleRequestSignIn = () => {
    setLoginStatusMessage("");
    setIsLoginModalOpen(true);
  };

  const handleRequestOtp = async (email: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoginStatusMessage("Supabase browser auth is not configured yet.");
      return;
    }

    setIsSendingMagicLink(true);
    setLoginStatusMessage("");

    const result = await supabase.auth.signInWithOtp({
      email,
    });

    if (result.error) {
      setLoginStatusMessage(result.error.message);
      setIsSendingMagicLink(false);
      return;
    }

    setLoginStatusMessage("Code sent. Check your email and enter the code here.");
    setIsSendingMagicLink(false);
  };

  const handleVerifyOtp = async (email: string, code: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoginStatusMessage("Supabase browser auth is not configured yet.");
      return;
    }

    setIsSendingMagicLink(true);
    setLoginStatusMessage("");

    const result = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (result.error) {
      setLoginStatusMessage(result.error.message);
      setIsSendingMagicLink(false);
      return;
    }

    await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        accessToken: result.data.session?.access_token,
        refreshToken: result.data.session?.refresh_token,
      }),
    });

    setLoginStatusMessage("Signed in successfully.");
    setIsLoginModalOpen(false);
    setIsSendingMagicLink(false);
    window.location.reload();
  };

  const persistHistoryGroup = async (group: RecipeSearchGroup) => {
    await fetch("/api/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ group }),
    });
  };

  const handleToggleBookmark = async (recipe: Recipe) => {
    if (!isAuthenticated) {
      handleRequestSignIn();
      return;
    }

    const normalizedRecipe = normalizeRecipe(recipe);
    const wasBookmarked = bookmarks.some((bookmark) => bookmark.id === normalizedRecipe.id);

    if (wasBookmarked) {
      setBookmarks((current) =>
        current.filter((bookmark) => bookmark.id !== normalizedRecipe.id),
      );

      await fetch(`/api/bookmarks/${encodeURIComponent(normalizedRecipe.id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      return;
    }

    setBookmarks((current) => [normalizedRecipe, ...current]);

    await fetch("/api/bookmarks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ recipe: normalizedRecipe }),
    });

    if (!normalizedRecipe.imageUrl) {
      void loadBookmarkImage(normalizedRecipe);
    }
  };

  const handleClearBookmarks = async () => {
    setBookmarks([]);
    await fetch("/api/bookmarks", {
      method: "DELETE",
      credentials: "include",
    });
  };

  const handleClearSearchHistory = async () => {
    setSearchGroups([]);
    setImageStates({});
    setLastFetchSummary("");
    setSelectedRecipe(null);
    setIsClearHistoryModalOpen(false);
    await fetch("/api/history/clear", {
      method: "POST",
      credentials: "include",
    });
    setUsage((current) => ({ ...current, usedSearches: 0 }));
  };

  const loadBookmarkImage = async (recipe: Recipe) => {
    try {
      const response = await fetch("/api/recipes/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
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

        const updatedBookmark = next.find((bookmark) => bookmark.id === recipe.id);
        if (updatedBookmark) {
          void fetch("/api/bookmarks", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ recipe: updatedBookmark }),
          });
        }

        return next;
      });
    } catch {
      // Keeping the bookmark is more important than having an image.
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
      if (updatedGroup) {
        void persistHistoryGroup(updatedGroup);
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
            credentials: "include",
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

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      handleRequestSignIn();
      return;
    }

    const response = await fetch("/api/checkout", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setErrorMessage(errorPayload?.error || "Unable to start checkout right now.");
      return;
    }

    const data = (await response.json()) as { url: string };
    window.location.href = data.url;
  };

  const handleCancelSubscription = async () => {
    const response = await fetch("/api/subscription/cancel", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setErrorMessage(errorPayload?.error || "Unable to schedule cancellation.");
      return;
    }

    await refreshSubscription();
  };

  const fetchRecipes = async () => {
    if (!isAuthenticated) {
      handleRequestSignIn();
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/recipes/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ingredients }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | {
              error?: string;
              code?: string;
              usage?: UsageSnapshot;
              subscription?: SubscriptionState;
            }
          | null;

        if (errorPayload?.code === "auth_required") {
          handleRequestSignIn();
          return;
        }

        if (errorPayload?.code === "subscription_required") {
          setUsage(errorPayload.usage || emptyUsage);
          setSubscription(errorPayload.subscription || emptySubscription);
        }

        throw new Error(errorPayload?.error || "Unable to fetch recipes right now.");
      }

      const data = (await response.json()) as RecipeResponse;
      const normalizedGroup = normalizeSearchGroup({
        ...data.historyGroup,
        recipes: normalizeRecipes(data.historyGroup.recipes),
      });
      const ingredientKey = getIngredientKey(data.ingredients);
      const existingGroup = searchGroups.find(
        (group) => getIngredientKey(group.ingredients) === ingredientKey,
      );

      setUsage(data.usage);
      setSubscription(data.subscription);

      if (existingGroup) {
        const refreshedGroup: RecipeSearchGroup = {
          ...normalizedGroup,
          id: existingGroup.id,
        };

        setSearchGroups((current) => [
          refreshedGroup,
          ...current.filter((group) => group.id !== existingGroup.id),
        ]);
        setActiveView("discover");
        setLastFetchSummary(`Updated results for ${data.ingredients.join(", ")}.`);
        focusSearchGroup(existingGroup.id);
        void loadImagesForGroup(refreshedGroup);
        return;
      }

      setImageStates((current) => {
        const next = { ...current };
        for (const recipe of normalizedGroup.recipes) {
          next[`${normalizedGroup.id}:${recipe.id}`] = "idle";
        }
        return next;
      });
      setSearchGroups((current) => [normalizedGroup, ...current]);
      setActiveView("discover");
      setLastFetchSummary(
        `${data.cached ? "Loaded from cache" : "Fresh AI suggestions"} for ${data.ingredients.join(", ")}.`,
      );
      focusSearchGroup(normalizedGroup.id);
      void loadImagesForGroup(normalizedGroup);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      void refreshSubscription();
      params.delete("checkout");
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <header className="mx-auto mb-8 flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-terracotta-500">
              Pantry Chef
            </p>
            {subscription.pro ? (
              <span className="rounded-full bg-sage-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">
                Pro
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted-600">
            Editorial pantry cooking, guided by AI.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-3" aria-label="Primary">
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
          {isAuthenticated ? (
            <>
              <span className="rounded-full border border-stone-300/80 bg-white/65 px-4 py-3 text-sm text-ink-900">
                {userEmail}
              </span>
              {subscription.managementEnabled && !subscription.cancelAtPeriodEnd ? (
                <button
                  className="rounded-full border border-stone-300/80 bg-white px-4 py-3 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
                  type="button"
                  onClick={handleCancelSubscription}
                >
                  Cancel subscription
                </button>
              ) : null}
              <button
                className="rounded-full border border-stone-300/80 bg-white px-4 py-3 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
                type="button"
                onClick={async () => {
                  const supabase = getSupabaseBrowserClient();
                  await supabase?.auth.signOut();
                  await fetch("/api/auth/sign-out", {
                    method: "POST",
                    credentials: "include",
                  });
                  setUserId(null);
                  setUserEmail(null);
                  setBookmarks([]);
                  setSearchGroups([]);
                  setSubscription(emptySubscription);
                  setUsage(emptyUsage);
                }}
              >
                Sign out
              </button>
            </>
          ) : authEnabled ? (
            <button
              className="rounded-full border border-stone-300/80 bg-white px-5 py-3 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
              type="button"
              onClick={handleRequestSignIn}
            >
              Sign in
            </button>
          ) : null}
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
                    Input your ingredients and let Pantry Chef suggest four thoughtful
                    recipes that fit your pantry and your plan.
                  </p>
                </div>

                <div className="mx-auto max-w-2xl">
                  <IngredientInput
                    ingredients={ingredients}
                    onAddIngredient={addIngredient}
                    onRemoveIngredient={removeIngredient}
                    onSuggestRecipes={fetchRecipes}
                    isLoading={isLoading}
                    usageLabel={usageLabel}
                    canSearch={hasFreeSearchesLeft}
                    onUpgrade={handleUpgrade}
                  />
                </div>

                {!isAuthenticated ? (
                  <div className="mx-auto mt-6 max-w-2xl rounded-[28px] border border-dashed border-stone-300/80 bg-white/50 p-5 text-sm leading-6 text-muted-600">
                    Sign in with a magic link before your first search so your bookmarks,
                    history, and subscription stay tied to your account.
                  </div>
                ) : null}

                {!subscription.pro && !hasFreeSearchesLeft ? (
                  <div className="mx-auto mt-6 max-w-2xl rounded-[28px] border border-terracotta-500/25 bg-[#fff4ee] p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
                      Upgrade Required
                    </p>
                    <h2 className="mt-2 font-display text-3xl text-ink-900">
                      You&apos;ve used all {usage.freeLimit} free searches
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-600">
                      Upgrade to Pantry Chef Pro for unlimited recipe searches, synced
                      history, and server-backed image caching.
                    </p>
                    <button
                      className="mt-5 rounded-full bg-sage-700 px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5"
                      type="button"
                      onClick={handleUpgrade}
                    >
                      Start Pro checkout
                    </button>
                  </div>
                ) : null}
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

              {subscription.cancelAtPeriodEnd ? (
                <p className="mb-4 rounded-2xl bg-sage-500/10 px-4 py-4 text-sm text-sage-700">
                  Your Pro plan will stay active until{" "}
                  {subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : "the end of the current billing period"}
                  .
                </p>
              ) : null}

              {errorMessage ? (
                <p className="mb-4 rounded-2xl bg-terracotta-500/10 px-4 py-4 text-sm text-[#8b381a]">
                  {errorMessage}
                </p>
              ) : null}

              {searchGroups.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-stone-300/80 bg-white/45 p-6">
                  <h3 className="font-display text-2xl text-ink-900">No recipes yet</h3>
                  <p className="mt-2 max-w-xl text-muted-600">
                    Add a few ingredients, press Suggest Recipes, and Pantry Chef will
                    generate four recipe cards you can open and save.
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
          <section className="rounded-[32px] border border-white/60 bg-white/65 p-6 shadow-card backdrop-blur-md">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
                  Saved Recipes
                </p>
                <h2 className="font-display text-3xl text-ink-900">Your bookmarks</h2>
              </div>
              {bookmarks.length > 0 ? (
                <button
                  className="rounded-full border border-stone-300/80 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
                  type="button"
                  onClick={handleClearBookmarks}
                >
                  Clear Bookmarks
                </button>
              ) : null}
            </div>

            {shownRecipes.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-stone-300/80 bg-white/45 p-6">
                <h3 className="font-display text-2xl text-ink-900">No bookmarks yet</h3>
                <p className="mt-2 max-w-xl text-muted-600">
                  Save a recipe card and it will show up here for quick access.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {shownRecipes.map((recipe) => (
                  <div key={recipe.id}>
                    <SearchResultsRow
                      group={{
                        id: `bookmark-${recipe.id}`,
                        ingredients: recipe.ingredients.slice(0, 3),
                        cached: true,
                        recipes: [recipe],
                        createdAt: Date.now(),
                      }}
                      onOpen={setSelectedRecipe}
                      onToggleBookmark={handleToggleBookmark}
                      bookmarkedIds={bookmarkedIds}
                      imageStates={{
                        [`bookmark-${recipe.id}:${recipe.id}`]: recipe.imageUrl
                          ? "ready"
                          : "idle",
                      }}
                    />
                  </div>
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

      <LoginModal
        isOpen={isLoginModalOpen}
        isSubmitting={isSendingMagicLink}
        statusMessage={loginStatusMessage}
        onClose={() => setIsLoginModalOpen(false)}
        onRequestCode={handleRequestOtp}
        onVerifyCode={handleVerifyOtp}
      />

      {isClearHistoryModalOpen ? (
        <div
          className="fixed inset-0 z-20 grid place-items-center bg-stone-950/55 p-4"
          role="presentation"
          onClick={() => setIsClearHistoryModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[32px] bg-[#fffaf3] p-6 shadow-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-3xl text-ink-900">Clear search history?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-600">
              This removes your synced search history and resets your free-search counter.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-full border border-stone-300/80 bg-white px-4 py-2.5 text-sm font-medium text-ink-900"
                type="button"
                onClick={() => setIsClearHistoryModalOpen(false)}
              >
                Keep history
              </button>
              <button
                className="rounded-full bg-sage-700 px-4 py-2.5 text-sm font-medium text-white"
                type="button"
                onClick={() => void handleClearSearchHistory()}
              >
                Clear history
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
