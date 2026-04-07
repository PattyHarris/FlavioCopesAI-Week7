import { Recipe } from "../lib/types";

type RecipeCardProps = {
  recipe: Recipe;
  onOpen: (recipe: Recipe) => void;
  onToggleBookmark: (recipe: Recipe) => void;
  isBookmarked: boolean;
  imageState?: "idle" | "loading" | "ready" | "failed";
};

export function RecipeCard({
  recipe,
  onOpen,
  onToggleBookmark,
  isBookmarked,
  imageState = recipe.imageUrl ? "ready" : "idle",
}: RecipeCardProps) {
  return (
    <article className="group overflow-hidden rounded-[28px] border border-stone-300/70 bg-cream-50 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-card">
      <button
        className="w-full bg-transparent p-0"
        type="button"
        onClick={() => onOpen(recipe)}
      >
        {recipe.imageUrl ? (
          <img
            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            src={recipe.imageUrl}
            alt={recipe.title}
            loading="lazy"
          />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center bg-linear-to-br from-terracotta-500/20 to-sage-500/20 px-6 text-center text-sm font-medium text-sage-700">
            <div>
              <p className="font-semibold">
                {imageState === "loading"
                  ? "Generating image..."
                  : imageState === "failed"
                    ? "Image unavailable"
                    : "Image pending"}
              </p>
              <p className="mt-2 text-xs text-sage-700/80">
                {imageState === "loading"
                  ? "Recipe details are ready now. The photo will appear shortly."
                  : imageState === "failed"
                    ? "This recipe can still be viewed and bookmarked without a photo."
                    : "Photo placeholder"}
              </p>
            </div>
          </div>
        )}
      </button>

      <div className="grid gap-3.5 p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center rounded-full bg-terracotta-500/14 px-3 py-1.5 text-sm font-bold text-terracotta-500">
            {recipe.difficulty}
          </span>
          <span className="text-sm text-muted-600">{recipe.cookTime}</span>
        </div>

        <button
          className="bg-transparent p-0 text-left"
          type="button"
          onClick={() => onOpen(recipe)}
        >
          <h2 className="font-display text-[1.75rem] leading-tight text-ink-900">
            {recipe.title}
          </h2>
        </button>

        <p className="text-sm leading-6 text-muted-600">{recipe.description}</p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            className="rounded-full border border-stone-300/80 bg-white px-4 py-2.5 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5"
            type="button"
            onClick={() => onOpen(recipe)}
          >
            View details
          </button>
          <button
            className="rounded-full bg-sage-500/12 px-4 py-2.5 text-sm font-medium text-sage-700 transition hover:-translate-y-0.5"
            type="button"
            onClick={() => onToggleBookmark(recipe)}
            aria-pressed={isBookmarked}
          >
            {isBookmarked ? "Bookmarked" : "Bookmark"}
          </button>
        </div>
      </div>
    </article>
  );
}
