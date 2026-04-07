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

export type RecipeResponse = {
  ingredients: string[];
  recipes: Recipe[];
  cached: boolean;
};

export type RecipeSearchGroup = RecipeResponse & {
  id: string;
  createdAt: number;
};

export type PersistenceStateResponse = {
  enabled: boolean;
  bookmarks: Recipe[];
  searchHistory: RecipeSearchGroup[];
};
