import { Star } from "lucide-react";
import Rating from "react-rating";

type StarRatingProps = {
  value: number;
  size?: number | string;
  fractions?: number;
  readonly?: boolean;
  onChange?: (value: number) => void;
};

export function StarRating({ value, size, fractions, readonly = true, onChange }: StarRatingProps) {
  return (
    // @ts-expect-error react-rating's published React types are stale.
    <Rating
      className="whitespace-nowrap"
      initialRating={value}
      fullSymbol={<Star fill="currentColor" size={size} />}
      emptySymbol={<Star size={size} />}
      start={0}
      stop={5}
      fractions={fractions}
      readonly={readonly}
      onChange={onChange}
    />
  );
}
