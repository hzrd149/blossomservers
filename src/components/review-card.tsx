import { use$ } from "applesauce-react/hooks";
import { MessageSquare, Pencil } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";

import { ServerReview } from "@/casts/review";
import { Button } from "@/components/ui/button";
import { COMMENT_KIND } from "@/const";
import { getServerPath } from "@/helpers/server";
import { useActivePubkey } from "@/hooks/use-active-account";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/utils";
import { eventStore } from "@/services/nostr";
import { CommentThread } from "./comments/comment-thread";
import { HelpfulButton } from "./reaction-button";
import { ReviewDialog } from "./review-dialog";
import { ServerFavicon } from "./server-favicon";
import { StarRating } from "./star-rating";
import UserAvatar from "./user/user-avatar";
import UserName from "./user/user-name";

/** Counts every comment in a review's thread, including nested replies */
function useThreadSize(review: ServerReview) {
  const comments = use$(
    () => eventStore.timeline({ kinds: [COMMENT_KIND], "#A": [review.coordinate!] }),
    [review.coordinate],
  );
  return comments?.length ?? 0;
}

export const ReviewCard = memo(function ReviewCard({
  review,
  showServer = false,
}: {
  review: ServerReview;
  showServer?: boolean;
}) {
  const pubkey = useActivePubkey();
  const isMine = pubkey === review.event.pubkey;
  const threadSize = useThreadSize(review);
  const [showComments, setShowComments] = useState(false);
  const comments = use$(() => (showComments ? review.comments$ : undefined), [review, showComments]);

  return (
    <article className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", isMine && "border-primary/50")}>
      <header className="flex items-start gap-3">
        <UserAvatar pubkey={review.event.pubkey} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <UserName pubkey={review.event.pubkey} />
            {isMine && <span className="text-xs text-muted-foreground">(you)</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {review.stars !== null && <StarRating value={review.stars} size={13} />}
            <time title={review.createdAt.toLocaleString()}>{formatRelative(review.event.created_at)}</time>
          </div>
        </div>
        {isMine && (
          <ReviewDialog server={review.server} review={review}>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit review">
              <Pencil size={15} />
            </Button>
          </ReviewDialog>
        )}
      </header>

      {showServer && (
        <Link
          to={getServerPath(review.server)}
          className="flex items-center gap-2 self-start rounded-md bg-muted px-2 py-1 text-sm hover:underline"
        >
          <ServerFavicon url={review.server} className="h-4 w-4" />
          {review.host}
        </Link>
      )}

      {review.text ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{review.text}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">No written review</p>
      )}

      <footer className="-mx-2 -mb-2 flex items-center gap-1">
        <HelpfulButton review={review} />
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 gap-1.5 px-2 text-muted-foreground", showComments && "text-foreground")}
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageSquare size={15} />
          <span className="tabular-nums">{threadSize > 0 ? threadSize : "Comment"}</span>
        </Button>
      </footer>

      {showComments && (
        <div className="border-t pt-4">
          <CommentThread parent={review.event} comments={comments} placeholder="Reply to this review…" />
        </div>
      )}
    </article>
  );
});
