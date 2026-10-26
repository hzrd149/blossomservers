import { Star } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type StarRatingProps = {
  /** The rating out of five */
  value: number;
  size?: number;
  className?: string;
};

/** A read only star rating that supports partial stars */
export function StarRating({ value, size = 16, className }: StarRatingProps) {
  return (
    <span className={cn("inline-flex items-center text-amber-500", className)} aria-label={`${value.toFixed(1)} of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, value - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-muted-foreground/40" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** An interactive star picker for whole star ratings */
export function StarInput({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)} role="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          className="rounded-sm text-amber-500 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => setHover(star)}
          onClick={() => onChange(star)}
        >
          <Star size={size} fill={star <= shown ? "currentColor" : "none"} className={star <= shown ? "" : "text-muted-foreground/50"} />
        </button>
      ))}
    </div>
  );
}
