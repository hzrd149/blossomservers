import { NostrEvent } from "applesauce-core/helpers";

export default function getReviewRating(review: NostrEvent, type?: string): number | null {
  const tag = review.tags.find((t) => t[0] === "rating" && t[1] && t[2] === type);
  if (!tag) return null;

  const rating = parseFloat(tag[1]);
  if (!Number.isFinite(rating) || rating > 1 || rating < 0) return null;

  return rating;
}
