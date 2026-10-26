import { castTimelineStream } from "applesauce-common/observable";
import { use$ } from "applesauce-react/hooks";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { throttleTime } from "rxjs";

import { ServerReview } from "@/casts/review";
import { PageHeader } from "@/components/page-header";
import { ReviewCard } from "@/components/review-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SERVER_REVIEW_KIND } from "@/const";
import { eventStore } from "@/services/nostr";

const PAGE_SIZE = 30;

export default function ReviewsView() {
  const reviews = use$(
    () =>
      eventStore
        .timeline({ kinds: [SERVER_REVIEW_KIND] })
        .pipe(throttleTime(500, undefined, { leading: true, trailing: true }), castTimelineStream(ServerReview, eventStore)),
    [],
  );
  const [query, setQuery] = useState("");
  const [minStars, setMinStars] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (reviews ?? []).filter(
      (review) =>
        (!minStars || (review.stars ?? 0) >= minStars) &&
        (!search || review.host.includes(search) || review.text.toLowerCase().includes(search)),
    );
  }, [reviews, query, minStars]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Recent reviews" description="What people are saying about the servers they use." />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search reviews or servers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={minStars} onChange={(e) => setMinStars(Number(e.target.value))} aria-label="Minimum rating">
          <option value={0}>Any rating</option>
          {[5, 4, 3, 2].map((n) => (
            <option key={n} value={n}>
              {n}+ stars
            </option>
          ))}
        </Select>
      </div>

      {!reviews ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border bg-muted/50" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No reviews found.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {results.slice(0, limit).map((review) => (
            <ReviewCard key={review.uid} review={review} showServer />
          ))}
          {results.length > limit && (
            <Button variant="outline" className="self-center" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Show more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
