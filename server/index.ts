import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { normalizeIngredients, readRecipeCache, writeRecipeCache } from "./cache.js";
import { generateRecipeImage, generateRecipes } from "./openai.js";
import {
  clearBookmarksPersistence,
  clearSearchHistoryPersistence,
  getPersistenceState,
  isPersistenceEnabled,
  replaceBookmarks,
  upsertSearchHistoryGroup,
} from "./persistence.js";
import { RecipeResponse } from "./types.js";

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

const requestSchema = z.object({
  ingredients: z.array(z.string().min(1)).min(1),
});

const imageRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const bookmarksSchema = z.object({
  bookmarks: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      cookTime: z.string().min(1),
      difficulty: z.enum(["Easy", "Medium", "Hard"]),
      ingredients: z.array(z.string().min(1)),
      instructions: z.array(z.string().min(1)),
      imageUrl: z.string().optional(),
    }),
  ),
});

const searchHistoryGroupSchema = z.object({
  group: z.object({
    id: z.string().min(1),
    ingredients: z.array(z.string().min(1)),
    cached: z.boolean(),
    recipes: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        cookTime: z.string().min(1),
        difficulty: z.enum(["Easy", "Medium", "Hard"]),
        ingredients: z.array(z.string().min(1)),
        instructions: z.array(z.string().min(1)),
        imageUrl: z.string().optional(),
      }),
    ),
    createdAt: z.number(),
  }),
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, persistenceEnabled: isPersistenceEnabled() });
});

app.get("/api/state", async (_request, response) => {
  try {
    const state = await getPersistenceState();
    response.json(state);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load persistence state.";
    response.status(500).json({ error: message });
  }
});

app.post("/api/recipes/suggest", async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send a non-empty ingredients array." });
    return;
  }

  const ingredients = normalizeIngredients(parsed.data.ingredients);
  const cached = readRecipeCache(ingredients);

  if (cached) {
    response.json({ ...cached, cached: true });
    return;
  }

  try {
    const recipes = await generateRecipes(ingredients);
    const payload: RecipeResponse = {
      ingredients,
      recipes,
      cached: false,
    };

    writeRecipeCache(payload);
    response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate recipes.";
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
    const imageUrl = await generateRecipeImage(parsed.data);
    response.json({ imageUrl: imageUrl ?? null });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate recipe image.";
    response.status(500).json({ error: message });
  }
});

app.put("/api/bookmarks", async (request, response) => {
  const parsed = bookmarksSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send a bookmarks array." });
    return;
  }

  try {
    const result = await replaceBookmarks(parsed.data.bookmarks);
    response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save bookmarks.";
    response.status(500).json({ error: message });
  }
});

app.delete("/api/bookmarks", async (_request, response) => {
  try {
    const result = await clearBookmarksPersistence();
    response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to clear bookmarks.";
    response.status(500).json({ error: message });
  }
});

app.put("/api/search-history", async (request, response) => {
  const parsed = searchHistoryGroupSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Please send a valid search history group." });
    return;
  }

  try {
    const result = await upsertSearchHistoryGroup(parsed.data.group);
    response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save search history.";
    response.status(500).json({ error: message });
  }
});

app.delete("/api/search-history", async (_request, response) => {
  try {
    const result = await clearSearchHistoryPersistence();
    response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to clear search history.";
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
