export type Difficulty = "Easy" | "Medium" | "Hard";

export type Recipe = {
  id: string;
  title: string;
  description: string;
  cookTime: string;
  difficulty: Difficulty;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
};

export type RecipeSearchGroup = {
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

export type SubscriptionState = {
  enabled: boolean;
  pro: boolean;
  productId: string | null;
  subscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  managementEnabled: boolean;
};

export type AppUser = {
  id: string;
  email: string | null;
};

export type AppStateResponse = {
  authEnabled: boolean;
  user: AppUser | null;
  bookmarks: Recipe[];
  searchHistory: RecipeSearchGroup[];
  subscription: SubscriptionState;
  usage: UsageSnapshot;
};

export type RecipeResponse = {
  ingredients: string[];
  recipes: Recipe[];
  cached: boolean;
  historyGroup: RecipeSearchGroup;
  usage: UsageSnapshot;
  subscription: SubscriptionState;
};
