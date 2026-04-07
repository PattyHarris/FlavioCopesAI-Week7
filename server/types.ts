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
