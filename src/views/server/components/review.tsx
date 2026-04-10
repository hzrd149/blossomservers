import { getTagValue, NostrEvent } from "applesauce-core/helpers";
import { Star } from "lucide-react";
import Rating from "react-rating";

import { AddReview } from "@/components/add-review";
import UserAvatar from "@/components/user/user-avatar";
import UserName from "@/components/user/user-name";
import { useUser } from "@/contexts/user-context";
import getReviewRating from "@/helpers/review";
import { normalizeServerUrl } from "@/helpers/server";

export default function Review({ review }: { review: NostrEvent }) {
  const { pubkey: userPubkey } = useUser();
  const rating = getReviewRating(review);
  const date = new Date(review.created_at * 1000).toLocaleDateString();
  const isOwner = userPubkey === review.pubkey;

  return (
    <div className={`p-4 border rounded-lg ${isOwner ? "border-primary" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar pubkey={review.pubkey} />
          <div>
            <UserName pubkey={review.pubkey} />
            <p className="text-sm text-muted-foreground">{date}</p>
          </div>
        </div>

        {rating !== null && (
          // @ts-expect-error
          <Rating
            initialRating={rating * 5}
            fullSymbol={<Star size="1.5em" fill="currentColor" />}
            emptySymbol={<Star size="1.5em" />}
            start={0}
            stop={5}
            fractions={5}
            readonly
          />
        )}
      </div>

      <p className="mt-3 text-foreground">{review.content}</p>

      {isOwner && (
        <div className="mt-3">
          <AddReview
            server={new URL(normalizeServerUrl(getTagValue(review, "d")!))}
            review={review}
            onDelete={() => {}}
          />
        </div>
      )}
    </div>
  );
}
