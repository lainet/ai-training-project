import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

// ─── StarRating ───
// Display-only: shows filled/half/empty stars for an average rating.
// Interactive: renders a hidden radio group styled as clickable stars.

interface StarDisplayProps {
  rating: number | null;
  ratingCount?: number;
  className?: string;
}

export function StarDisplay({ rating, ratingCount, className }: StarDisplayProps) {
  if (rating === null) {
    return (
      <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <span className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-3.5 text-muted-foreground/40" />
          ))}
        </span>
        <span>No ratings yet</span>
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-1 text-xs", className)}>
      <span className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i < Math.round(rating)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        ))}
      </span>
      <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
      {ratingCount !== undefined && (
        <span className="text-muted-foreground">({ratingCount})</span>
      )}
    </span>
  );
}

interface StarPickerProps {
  name?: string;
  defaultValue?: number | null;
  className?: string;
}

export function StarPicker({
  name = "rating",
  defaultValue,
  className,
}: StarPickerProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(defaultValue ?? null);

  const active = hovered ?? selected;

  return (
    <fieldset
      className={cn("flex gap-0.5", className)}
      onMouseLeave={() => setHovered(null)}
    >
      <legend className="sr-only">Rating</legend>
      {[1, 2, 3, 4, 5].map((value) => (
        <label
          key={value}
          className="cursor-pointer"
          onMouseEnter={() => setHovered(value)}
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={selected === value}
            onChange={() => setSelected(value)}
            className="sr-only"
            required
          />
          <Star
            className={cn(
              "size-7 transition-colors",
              active !== null && value <= active
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        </label>
      ))}
    </fieldset>
  );
}
