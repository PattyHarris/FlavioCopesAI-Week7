import { expect, test } from "@playwright/test";

type StateOverrides = {
  authEnabled?: boolean;
  user?: { id: string; email: string | null } | null;
  bookmarks?: unknown[];
  searchHistory?: unknown[];
  subscription?: {
    enabled: boolean;
    pro: boolean;
    productId: string | null;
    subscriptionId: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    managementEnabled: boolean;
  };
  usage?: {
    freeLimit: number;
    usedSearches: number;
  };
};

async function mockAppApis(page: Parameters<typeof test>[0]["page"], overrides?: StateOverrides) {
  const state = {
    authEnabled: true,
    user: null,
    bookmarks: [],
    searchHistory: [],
    subscription: {
      enabled: true,
      pro: false,
      productId: "prod_123",
      subscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      managementEnabled: false,
    },
    usage: {
      freeLimit: 3,
      usedSearches: 0,
    },
    ...overrides,
  };

  await page.route("**/api/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state),
    });
  });

  await page.route("**/api/recipes/suggest", async (route) => {
    const body = route.request().postDataJSON() as { ingredients: string[] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ingredients: body.ingredients,
        recipes: [
          {
            id: "recipe-1",
            title: "Tomato Rice Bowl",
            description: "A quick pantry dinner.",
            cookTime: "25 min",
            difficulty: "Easy",
            ingredients: body.ingredients,
            instructions: ["Cook the rice", "Warm the sauce", "Serve"],
          },
          {
            id: "recipe-2",
            title: "Garlic Chickpea Skillet",
            description: "Fast and hearty.",
            cookTime: "20 min",
            difficulty: "Easy",
            ingredients: body.ingredients,
            instructions: ["Toast the garlic", "Add chickpeas", "Finish and serve"],
          },
          {
            id: "recipe-3",
            title: "Lemon Spinach Pilaf",
            description: "Bright and comforting.",
            cookTime: "30 min",
            difficulty: "Medium",
            ingredients: body.ingredients,
            instructions: ["Saute aromatics", "Simmer rice", "Fold in spinach"],
          },
          {
            id: "recipe-4",
            title: "Roasted Pantry Bake",
            description: "A flexible oven dinner.",
            cookTime: "40 min",
            difficulty: "Medium",
            ingredients: body.ingredients,
            instructions: ["Prep ingredients", "Roast", "Finish with herbs"],
          },
        ],
        cached: false,
        historyGroup: {
          id: "group-1",
          ingredients: body.ingredients,
          cached: false,
          recipes: [
            {
              id: "recipe-1",
              title: "Tomato Rice Bowl",
              description: "A quick pantry dinner.",
              cookTime: "25 min",
              difficulty: "Easy",
              ingredients: body.ingredients,
              instructions: ["Cook the rice", "Warm the sauce", "Serve"],
            },
            {
              id: "recipe-2",
              title: "Garlic Chickpea Skillet",
              description: "Fast and hearty.",
              cookTime: "20 min",
              difficulty: "Easy",
              ingredients: body.ingredients,
              instructions: ["Toast the garlic", "Add chickpeas", "Finish and serve"],
            },
            {
              id: "recipe-3",
              title: "Lemon Spinach Pilaf",
              description: "Bright and comforting.",
              cookTime: "30 min",
              difficulty: "Medium",
              ingredients: body.ingredients,
              instructions: ["Saute aromatics", "Simmer rice", "Fold in spinach"],
            },
            {
              id: "recipe-4",
              title: "Roasted Pantry Bake",
              description: "A flexible oven dinner.",
              cookTime: "40 min",
              difficulty: "Medium",
              ingredients: body.ingredients,
              instructions: ["Prep ingredients", "Roast", "Finish with herbs"],
            },
          ],
          createdAt: Date.now(),
        },
        usage: {
          freeLimit: 3,
          usedSearches: 1,
        },
        subscription: state.subscription,
      }),
    });
  });

  await page.route("**/api/recipes/image", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ imageUrl: null }),
    });
  });

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/subscription", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subscription: state.subscription,
        usage: state.usage,
      }),
    });
  });

  await page.route("**/api/subscription/cancel", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        subscription: {
          ...state.subscription,
          pro: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: "2026-05-13T00:00:00.000Z",
          managementEnabled: true,
        },
      }),
    });
  });

  await page.route("**/api/bookmarks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, bookmarks: state.bookmarks }),
    });
  });

  await page.route("**/api/bookmarks/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, searchHistory: state.searchHistory }),
    });
  });

  await page.route("**/api/history/clear", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

test("shows the signed-out home shell and opens the OTP dialog", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /what's in your kitchen today/i })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("dialog")).toContainText("one-time code");
});

test("runs a search for an authenticated free user and updates the usage copy", async ({
  page,
}) => {
  await mockAppApis(page, {
    user: { id: "user-1", email: "chef@example.com" },
  });
  await page.goto("/");

  await page.getByPlaceholder("Try chickpeas, spinach, lemon...").fill("Tomatoes");
  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByRole("button", { name: "Suggest Recipes" }).click();

  await expect(page.getByText("Tomato Rice Bowl")).toBeVisible();
  await expect(page.getByText("1 of 3 free searches")).toBeVisible();
});

test("shows the Pro cancellation banner for a cancelling subscriber", async ({ page }) => {
  await mockAppApis(page, {
    user: { id: "user-2", email: "pro@example.com" },
    subscription: {
      enabled: true,
      pro: true,
      productId: "prod_123",
      subscriptionId: "sub_123",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-05-13T00:00:00.000Z",
      managementEnabled: true,
    },
    usage: {
      freeLimit: 3,
      usedSearches: 3,
    },
  });
  await page.goto("/");

  await expect(page.getByText(/your pro plan remains active until/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel subscription" })).toHaveCount(0);
});
