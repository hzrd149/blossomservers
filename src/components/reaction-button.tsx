import { ReactionFactory } from "applesauce-common/factories";
import { DeleteFactory } from "applesauce-core/factories";
import { NostrEvent } from "applesauce-core/helpers";
import { use$ } from "applesauce-react/hooks";
import { ThumbsUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ServerReview } from "@/casts/review";
import { useActivePubkey } from "@/hooks/use-active-account";
import { cn } from "@/lib/utils";
import { signAndPublish } from "@/services/publish";
import { openLogin } from "./login-dialog";

/** Likes count as "helpful", every other emoji is shown next to it */
const isLike = (content: string) => content === "+" || content === "" || content === "👍";

/** A "helpful" toggle for a review that publishes or deletes a NIP-25 reaction */
export function HelpfulButton({ review }: { review: ServerReview }) {
  const pubkey = useActivePubkey();
  const reactions = use$(review.reactions$);
  const [busy, setBusy] = useState(false);

  const likes = reactions?.filter((r) => isLike(r.content)) ?? [];
  const mine = likes.find((r) => r.event.pubkey === pubkey);
  const others = new Map<string, number>();
  for (const reaction of reactions ?? []) {
    if (isLike(reaction.content) || reaction.content === "-" || reaction.emoji) continue;
    others.set(reaction.content, (others.get(reaction.content) ?? 0) + 1);
  }

  const toggle = async () => {
    if (!pubkey) return openLogin();
    setBusy(true);
    try {
      if (mine) await signAndPublish(DeleteFactory.fromEvents([mine.event as NostrEvent], "Removed reaction"));
      else await signAndPublish(ReactionFactory.like(review.event));
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-8 gap-1.5 px-2 text-muted-foreground", mine && "text-foreground")}
        onClick={toggle}
        disabled={busy}
        title={mine ? "Remove your helpful vote" : "Mark this review as helpful"}
      >
        <ThumbsUp size={15} fill={mine ? "currentColor" : "none"} />
        <span className="tabular-nums">{likes.length > 0 ? likes.length : "Helpful"}</span>
      </Button>
      {[...others].map(([emoji, count]) => (
        <span key={emoji} className="rounded-full border px-2 py-0.5 text-xs tabular-nums">
          {emoji} {count}
        </span>
      ))}
    </div>
  );
}
