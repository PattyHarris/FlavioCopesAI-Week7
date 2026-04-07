import { FormEvent, KeyboardEvent, useState } from "react";

type IngredientInputProps = {
  ingredients: string[];
  onAddIngredient: (value: string) => void;
  onRemoveIngredient: (value: string) => void;
  onSuggestRecipes: () => void;
  isLoading: boolean;
};

const starterIngredients = [
  "Tomatoes",
  "Chickpeas",
  "Spinach",
  "Lemon",
  "Garlic",
  "Rice",
];

export function IngredientInput({
  ingredients,
  onAddIngredient,
  onRemoveIngredient,
  onSuggestRecipes,
  isLoading,
}: IngredientInputProps) {
  const [draft, setDraft] = useState("");

  const submitIngredient = (event?: FormEvent) => {
    event?.preventDefault();
    const nextValue = draft.trim();

    if (!nextValue) {
      return;
    }

    onAddIngredient(nextValue);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      submitIngredient();
    }
  };

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/70 p-7 shadow-card backdrop-blur-md"
      aria-labelledby="pantry-title"
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-terracotta-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-sage-500/12 blur-2xl" />

      <div className="relative">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
          Pantry Chef
        </p>
        <h1
          id="pantry-title"
          className="max-w-sm font-display text-4xl leading-tight text-ink-900"
        >
          Cook from what you already have
        </h1>
        <p className="mt-4 max-w-md leading-7 text-muted-600">
          Add ingredients one at a time, then let us build four recipe ideas
          tailored to your pantry.
        </p>
      </div>

      <form className="relative mt-7 grid gap-3" onSubmit={submitIngredient}>
        <label className="sr-only" htmlFor="ingredient-input">
          Add an ingredient
        </label>
        <input
          id="ingredient-input"
          className="w-full rounded-2xl border border-stone-300/80 bg-cream-50 px-4 py-4 text-ink-900 outline-none transition placeholder:text-muted-600/70 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/20"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Try chickpeas, spinach, lemon..."
        />
        <button
          className="rounded-full border border-stone-300/80 bg-white px-4 py-3 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
          type="submit"
        >
          Add ingredient
        </button>
      </form>

      <div className="mt-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-muted-600">
          Try A Few Starter Ingredients
        </p>
        <div className="mb-6 flex flex-wrap gap-2.5">
          {starterIngredients.map((ingredient) => (
            <button
              key={ingredient}
              type="button"
              className="rounded-full border border-stone-300/70 bg-white/80 px-3.5 py-2 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
              onClick={() => onAddIngredient(ingredient)}
            >
              + {ingredient}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex min-h-16 flex-wrap gap-2.5" aria-live="polite">
        {ingredients.length === 0 ? (
          <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-muted-600">
            Start with 3 to 5 ingredients for the best suggestions.
          </p>
        ) : (
          ingredients.map((ingredient) => (
            <button
              key={ingredient}
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-sage-500/15 px-3.5 py-2.5 text-sm font-medium text-sage-700 transition hover:-translate-y-0.5"
              onClick={() => onRemoveIngredient(ingredient)}
              aria-label={`Remove ${ingredient}`}
            >
              {ingredient}
              <span aria-hidden="true">x</span>
            </button>
          ))
        )}
      </div>

      <button
        className="w-full rounded-full bg-sage-700 px-5 py-3.5 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
        type="button"
        disabled={ingredients.length === 0 || isLoading}
        onClick={onSuggestRecipes}
      >
        {isLoading ? "Finding recipes..." : "Suggest Recipes"}
      </button>
    </section>
  );
}
