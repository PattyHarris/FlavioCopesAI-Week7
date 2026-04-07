import { useRef } from "react";
import { RecipeCard } from "./RecipeCard";
import { Recipe, RecipeSearchGroup } from "../lib/types";

type SearchResultsRowProps = {
  group: RecipeSearchGroup;
  onOpen: (recipe: Recipe) => void;
  onToggleBookmark: (recipe: Recipe) => void;
  bookmarkedIds: Set<string>;
  imageStates: Record<string, "idle" | "loading" | "ready" | "failed">;
  highlighted?: boolean;
};

export function SearchResultsRow({
  group,
  onOpen,
  onToggleBookmark,
  bookmarkedIds,
  imageStates,
  highlighted = false,
}: SearchResultsRowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const amount = Math.max(container.clientWidth * 0.85, 320);
    container.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section
      id={`search-group-${group.id}`}
      className={
        highlighted
          ? "rounded-[28px] border border-sage-700/60 bg-white/70 p-5 ring-2 ring-sage-700/25 transition"
          : "rounded-[28px] border border-stone-300/70 bg-white/55 p-5 transition"
      }
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-terracotta-500">
            {group.cached ? "Cached search" : "Fresh search"}
          </p>
          <h3 className="mt-1 font-display text-2xl text-ink-900">
            {group.ingredients.join(", ")}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300/80 bg-white text-lg text-ink-900 transition hover:-translate-y-0.5"
            type="button"
            onClick={() => scrollByAmount("left")}
            aria-label={`Scroll left for ${group.ingredients.join(", ")}`}
          >
            ←
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300/80 bg-white text-lg text-ink-900 transition hover:-translate-y-0.5"
            type="button"
            onClick={() => scrollByAmount("right")}
            aria-label={`Scroll right for ${group.ingredients.join(", ")}`}
          >
            →
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {group.recipes.map((recipe) => (
          <div key={`${group.id}-${recipe.id}`} className="min-w-[290px] flex-1 snap-start md:min-w-[330px]">
            <RecipeCard
              recipe={recipe}
              onOpen={onOpen}
              onToggleBookmark={onToggleBookmark}
              isBookmarked={bookmarkedIds.has(recipe.id)}
              imageState={imageStates[`${group.id}:${recipe.id}`] || "idle"}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
