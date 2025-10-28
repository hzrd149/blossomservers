import { NostrEvent } from "applesauce-core/helpers";
import { Star } from "lucide-react";
import Rating from "react-rating";

import UserAvatar from "@/components/user/user-avatar";
import UserName from "@/components/user/user-name";
import getReviewRating from "@/helpers/review";

export default function Review({ review }: { review: NostrEvent }) {
  const rating = getReviewRating(review);

  return (
    <div className="flex gap-2 flex-col p-2 border rounded-lg border-gray-300">
      <div className="flex gap-2 items-center">
        <UserAvatar pubkey={review.pubkey} />
        <UserName pubkey={review.pubkey} />

        {rating !== null && (
          // @ts-expect-error
          <Rating
            initialRating={rating * 5}
            fullSymbol={<Star size="1.2em" fill="currentColor" />}
            emptySymbol={<Star size="1.2em" />}
            start={0}
            stop={5}
            fractions={5}
            readonly
          />
        )}
      </div>

      <div>{review.content}</div>
    </div>
  );
}
