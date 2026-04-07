import { useEffect } from "react";
import { Recipe } from "../lib/types";

type RecipeModalProps = {
  recipe: Recipe | null;
  onClose: () => void;
  onToggleBookmark: (recipe: Recipe) => void;
  isBookmarked: boolean;
};

export function RecipeModal({
  recipe,
  onClose,
  onToggleBookmark,
  isBookmarked,
}: RecipeModalProps) {
  useEffect(() => {
    if (!recipe) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, recipe]);

  if (!recipe) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center bg-stone-950/55 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-5xl overflow-auto rounded-[32px] bg-[#fffaf3] p-6 shadow-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
              Recipe Detail
            </p>
            <h2
              id="recipe-modal-title"
              className="font-display text-3xl text-ink-900"
            >
              {recipe.title}
            </h2>
          </div>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300/80 bg-white text-lg text-ink-900 transition hover:-translate-y-0.5"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            x
          </button>
        </div>

        {recipe.imageUrl ? (
          <img
            className="mt-5 aspect-[16/8] w-full rounded-3xl object-cover"
            src={recipe.imageUrl}
            alt={recipe.title}
          />
        ) : null}

        <div className="my-5 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center rounded-full bg-terracotta-500/14 px-3 py-1.5 text-sm font-bold text-terracotta-500">
            {recipe.difficulty}
          </span>
          <span className="text-sm text-muted-600">{recipe.cookTime}</span>
          <button
            className="rounded-full bg-sage-500/12 px-4 py-2.5 text-sm font-medium text-sage-700 transition hover:-translate-y-0.5"
            type="button"
            onClick={() => onToggleBookmark(recipe)}
            aria-pressed={isBookmarked}
          >
            {isBookmarked ? "Remove bookmark" : "Save recipe"}
          </button>
        </div>

        <p className="text-base leading-7 text-muted-600">{recipe.description}</p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section>
            <h3 className="font-display text-2xl text-ink-900">Ingredients</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-600">
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="font-display text-2xl text-ink-900">Instructions</h3>
            <ol className="mt-3 list-decimal space-y-3 pl-5 leading-7 text-muted-600">
              {recipe.instructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
