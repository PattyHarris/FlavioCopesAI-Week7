import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  attachCurrentUser,
  clearAuthCookies,
  isSupabaseAuthEnabled,
  requireAuthenticatedUser,
  setAuthCookies,
  type AuthenticatedRequest,
} from "./auth.js";
import { generateRecipes } from "./openai.js";
import {
  clearBookmarksPersistence,
  clearSearchHistoryPersistence,
  createBookmark,
  deleteBookmark,
  getAppStateForUser,
  getRecipeCacheEntry,
  getRecipeImageUrl,
  getUsageSnapshot,
  isPersistenceEnabled,
  recordSearchHistoryGroup,
  storeRecipeCache,
  updateSearchHistoryGroup,
} from "./persistence.js";
import {
  cancelSubscriptionAtPeriodEnd,
  createCheckoutSession,
  getSubscriptionStatus,
} from "./polar.js";
import type { RecipeResponse } from "./types.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env.api.key", override: true });

const app = express();
const port = Number(process.env.PORT || 8787);
const isHostedRuntime = Boolean(process.env.RENDER || process.env.PORT);
const host = process.env.HOST || (isHostedRuntime ? "0.0.0.0" : "127.0.0.1");
const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDirectory, "..");
const frontendDistDirectory = path.resolve(projectRoot, "dist");
const frontendIndexFile = path.resolve(frontendDistDirectory, "index.html");

const recipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  cookTime: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  ingredients: z.array(z.string().min(1)),
  instructions: z.array(z.string().min(1)),
  imageUrl: z.string().optional(),
});

const requestSchema = z.object({
  ingredients: z.array(z.string().min(1)).min(1),
});

const imageRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const sessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
});

const bookmarkCreateSchema = z.object({
  recipe: recipeSchema,
});

const searchHistoryGroupSchema = z.object({
  group: z.object({
    id: z.string().min(1),
    ingredients: z.array(z.string().min(1)),
    cached: z.boolean(),
    recipes: z.array(recipeSchema),
    createdAt: z.number(),
  }),
});

app.use(
  cors({
    credentials: true,
    origin: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(attachCurrentUser as express.RequestHandler);

function getRequestOrigin(request: express.Request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string" ? forwardedProto : request.protocol || "http";

  return `${protocol}://${request.get("host")}`;
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    persistenceEnabled: isPersistenceEnabled(),
    authEnabled: isSupabaseAuthEnabled(),
  });
});

app.get("/api/state", async (request, response) => {
  const authRequest = request as AuthenticatedRequest;

  try {
    const state = await getAppStateForUser(
      authRequest.currentUser,
      authRequest.authTokens?.accessToken || null,
    );
    response.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load app state.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/auth/session", (request, response) => {
  const parsed = sessionSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send accessToken and refreshToken." });
    return;
  }

  setAuthCookies(response, parsed.data);
  response.json({ ok: true });
});

app.post("/api/auth/sign-out", (_request, response) => {
  clearAuthCookies(response);
  response.json({ ok: true });
});

app.post("/api/recipes/suggest", async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send a non-empty ingredients array." });
    return;
  }

  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    const subscription = await getSubscriptionStatus(auth.user);
    const usage = await getUsageSnapshot(auth.accessToken);

    if (!subscription.pro && usage.usedSearches >= usage.freeLimit) {
      response.status(402).json({
        error: "You have reached your free recipe limit.",
        code: "subscription_required",
        usage,
        subscription,
      });
      return;
    }

    const cached = await getRecipeCacheEntry(parsed.data.ingredients);
    let recipePayload: RecipeResponse;

    if (cached) {
      recipePayload = cached;
    } else {
      const recipes = await generateRecipes(parsed.data.ingredients);
      recipePayload = {
        ingredients: parsed.data.ingredients,
        recipes,
        cached: false,
      };
      await storeRecipeCache(recipePayload);
    }

    const historyGroup = await recordSearchHistoryGroup(auth.accessToken, auth.user.id, {
      ingredients: recipePayload.ingredients,
      cached: recipePayload.cached,
      recipes: recipePayload.recipes,
      createdAt: Date.now(),
    });

    response.json({
      ...recipePayload,
      historyGroup,
      usage: {
        freeLimit: usage.freeLimit,
        usedSearches: usage.usedSearches + 1,
      },
      subscription,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate recipes.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/recipes/image", async (request, response) => {
  const parsed = imageRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send a recipe title and description." });
    return;
  }

  try {
    const imageUrl = await getRecipeImageUrl(parsed.data);
    response.json({ imageUrl: imageUrl ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate recipe image.";
    response.status(500).json({ error: message });
  }
});

app.get("/api/bookmarks", async (request, response) => {
  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    const state = await getAppStateForUser(auth.user, auth.accessToken);
    response.json({ bookmarks: state.bookmarks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load bookmarks.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/bookmarks", async (request, response) => {
  const parsed = bookmarkCreateSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send a valid recipe." });
    return;
  }

  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    await createBookmark(auth.accessToken, auth.user.id, parsed.data.recipe);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save bookmark.";
    response.status(500).json({ error: message });
  }
});

app.delete("/api/bookmarks/:recipeId", async (request, response) => {
  const auth = requireAuthenticatedUser(
    request as unknown as AuthenticatedRequest,
    response,
  );
  if (!auth) {
    return;
  }

  try {
    await deleteBookmark(auth.accessToken, request.params.recipeId);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete bookmark.";
    response.status(500).json({ error: message });
  }
});

app.delete("/api/bookmarks", async (request, response) => {
  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    await clearBookmarksPersistence(auth.accessToken);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to clear bookmarks.";
    response.status(500).json({ error: message });
  }
});

app.get("/api/history", async (request, response) => {
  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    const state = await getAppStateForUser(auth.user, auth.accessToken);
    response.json({ searchHistory: state.searchHistory, usage: state.usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load search history.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/history", async (request, response) => {
  const parsed = searchHistoryGroupSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send a valid search history group." });
    return;
  }

  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    await updateSearchHistoryGroup(auth.accessToken, auth.user.id, parsed.data.group);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update search history.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/history/clear", async (request, response) => {
  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    await clearSearchHistoryPersistence(auth.accessToken);
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to clear search history.";
    response.status(500).json({ error: message });
  }
});

app.get("/api/subscription", async (request, response) => {
  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    const subscription = await getSubscriptionStatus(auth.user);
    const usage = await getUsageSnapshot(auth.accessToken);
    response.json({ subscription, usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load subscription status.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/checkout", async (request, response) => {
  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    const checkout = await createCheckoutSession(auth.user, getRequestOrigin(request));
    response.json(checkout);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create checkout session.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/subscription/cancel", async (request, response) => {
  const auth = requireAuthenticatedUser(request as AuthenticatedRequest, response);
  if (!auth) {
    return;
  }

  try {
    const subscription = await getSubscriptionStatus(auth.user);

    if (!subscription.subscriptionId) {
      response.status(400).json({ error: "No active subscription found." });
      return;
    }

    await cancelSubscriptionAtPeriodEnd(subscription.subscriptionId);
    response.json({
      ok: true,
      subscription: {
        ...subscription,
        cancelAtPeriodEnd: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to schedule cancellation.";
    response.status(500).json({ error: message });
  }
});

app.use(express.static(frontendDistDirectory));

app.get(/^\/(?!api).*/, (_request, response) => {
  response.sendFile(frontendIndexFile);
});

app.listen(port, host, () => {
  console.log(`Pantry Chef server listening on http://${host}:${port}`);
});
