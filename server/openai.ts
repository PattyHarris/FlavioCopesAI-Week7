import OpenAI from "openai";
import { z } from "zod";
import { normalizeIngredients } from "./cache.js";
import { Recipe } from "./types.js";

const recipeSchema = z.object({
  recipes: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().min(1),
        cookTime: z.string().min(1),
        difficulty: z.enum(["Easy", "Medium", "Hard"]),
        ingredients: z.array(z.string().min(1)).min(1),
        instructions: z.array(z.string().min(1)).min(1),
      }),
    )
    .length(4),
});

const imageCache = new Map<string, string | undefined>();

let client: OpenAI | null = null;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or OPEN_AI_API_KEY environment variable.");
  }

  client ??= new OpenAI({ apiKey });
  return client;
}

function buildRecipePrompt(ingredients: string[]) {
  const normalizedIngredients = normalizeIngredients(ingredients);

  return [
    "You are a recipe generator for a cooking app.",
    "Return exactly four recipes as JSON matching the provided schema.",
    "Avoid markdown and avoid any text outside the JSON object.",
    "Recipes should be realistic, home-cook friendly, and use the user's ingredients prominently.",
    "Each recipe must include a concise description, a friendly cookTime string, one of Easy/Medium/Hard,",
    "an ingredients array, and an instructions array with clear steps.",
    `User ingredients: ${normalizedIngredients.join(", ")}.`,
  ].join(" ");
}

function getImageCacheKey(recipe: Pick<Recipe, "title" | "description">) {
  return `${recipe.title.trim().toLowerCase()}|${recipe.description.trim().toLowerCase()}`;
}

export async function generateRecipeImage(recipe: Pick<Recipe, "title" | "description">) {
  const cacheKey = getImageCacheKey(recipe);
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  try {
    const response = await getClient().images.generate({
      model: "dall-e-3",
      prompt: `A plated food photograph of ${recipe.title}. ${recipe.description}. Warm natural light, realistic editorial cooking style.`,
      n: 1,
      quality: "standard",
      size: "1024x1024",
    });

    const imageUrl = response.data?.[0]?.url;
    imageCache.set(cacheKey, imageUrl);
    return imageUrl;
  } catch {
    imageCache.set(cacheKey, undefined);
    return undefined;
  }
}

export async function generateRecipes(ingredients: string[]) {
  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "recipe_suggestions",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            recipes: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  cookTime: { type: "string" },
                  difficulty: {
                    type: "string",
                    enum: ["Easy", "Medium", "Hard"],
                  },
                  ingredients: {
                    type: "array",
                    items: { type: "string" },
                  },
                  instructions: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: [
                  "id",
                  "title",
                  "description",
                  "cookTime",
                  "difficulty",
                  "ingredients",
                  "instructions",
                ],
              },
            },
          },
          required: ["recipes"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You generate structured recipes for an ingredient-based cooking application.",
      },
      {
        role: "user",
        content: buildRecipePrompt(ingredients),
      },
    ],
  });

  const rawContent = completion.choices[0]?.message.content;
  if (!rawContent) {
    throw new Error("The recipe model returned an empty response.");
  }

  const parsed = recipeSchema.parse(JSON.parse(rawContent));
  return parsed.recipes;
}
