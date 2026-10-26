import { Comment } from "applesauce-common/casts";
import { CommentPointer } from "applesauce-common/helpers";
import { castTimelineStream } from "applesauce-common/observable";
import { use$ } from "applesauce-react/hooks";
import { ExternalLink, Pencil, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { CommentThread } from "@/components/comments/comment-thread";
import CopyButton from "@/components/copy-button";
import { MyListButton } from "@/components/my-list-button";
import { ReviewCard } from "@/components/review-card";
import { ReviewDialog } from "@/components/review-dialog";
import { ServerBadges } from "@/components/server-badges";
import { ReportDialog } from "@/components/report-dialog";
import { ServerReports } from "@/components/server-reports";
import { ServerFavicon } from "@/components/server-favicon";
import { ServerStatus } from "@/components/server-status";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import UserAvatar from "@/components/user/user-avatar";
import UserName from "@/components/user/user-name";
import { COMMENT_KIND } from "@/const";
import { safeNormalizeServerUrl } from "@/helpers/server";
import { useActivePubkey } from "@/hooks/use-active-account";
import { serverSummary$, ServerSummary } from "@/models/directory";
import { serverDiscussionUpdates$ } from "@/services/discussion";
import { eventStore } from "@/services/nostr";

type Tab = "reports" | "reviews" | "discussion" | "users";

/** Rating distribution bars, five stars first */
function RatingBreakdown({ server }: { server: ServerSummary }) {
  const counts = [0, 0, 0, 0, 0];
  for (const review of server.reviews) {
    if (review.stars === null) continue;
    counts[Math.min(4, Math.max(0, Math.round(review.stars) - 1))]++;
  }
  const max = Math.max(1, ...counts);

  return (
    <div className="flex flex-col gap-1">
      {[5, 4, 3, 2, 1].map((stars) => (
        <div key={stars} className="flex items-center gap-2 text-xs">
          <span className="w-3 text-right tabular-nums text-muted-foreground">{stars}</span>
          <Star size={11} className="text-amber-500" fill="currentColor" />
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${(counts[stars - 1] / max) * 100}%` }}
            />
          </div>
          <span className="w-6 tabular-nums text-muted-foreground">{counts[stars - 1]}</span>
        </div>
      ))}
    </div>
  );
}

function UsersGrid({ server }: { server: ServerSummary }) {
  const [limit, setLimit] = useState(60);
  const users = useMemo(() => [...server.users], [server.users]);

  if (users.length === 0)
    return <p className="py-8 text-center text-muted-foreground">No one you follow lists this server.</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {users.length.toLocaleString()} people you follow list this server in their BUD-03 server list
        {server.defaults > 0 && `, ${server.defaults.toLocaleString()} use it as their default`}.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {users.slice(0, limit).map((pubkey) => (
          <div key={pubkey} className="flex min-w-0 items-center gap-2 rounded-lg border p-2">
            <UserAvatar pubkey={pubkey} className="h-8 w-8" />
            <UserName pubkey={pubkey} className="text-sm" />
          </div>
        ))}
      </div>
      {users.length > limit && (
        <Button variant="outline" className="self-center" onClick={() => setLimit((l) => l + 60)}>
          Show more
        </Button>
      )}
    </div>
  );
}

function Discussion({ url }: { url: string }) {
  // NIP-22 comments on the server URL itself (NIP-73 "web" identifier)
  const pointer = useMemo<CommentPointer>(() => ({ type: "external", kind: "web", identifier: url }), [url]);

  use$(() => serverDiscussionUpdates$(url), [url]);
  const comments = use$(
    () =>
      eventStore
        .timeline({ kinds: [COMMENT_KIND], "#K": ["web"], "#I": [url], "#k": ["web"], "#i": [url] })
        .pipe(castTimelineStream(Comment, eventStore)),
    [url],
  );

  return <CommentThread parent={pointer} comments={comments} placeholder="Ask a question or share your experience…" />;
}

function ServerPage({ url }: { url: string }) {
  const pubkey = useActivePubkey();
  const summary = use$(() => serverSummary$(url), [url]);
  const [tab, setTab] = useState<Tab>("reports");

  const server: ServerSummary = summary ?? {
    url,
    host: new URL(url).host,
    announcements: [],
    reports: [],
    contributors: new Set(),
    reviews: [],
    rating: null,
    users: new Set(),
    defaults: 0,
    updated: 0,
  };
  const myReview = server.reviews.find((r) => r.event.pubkey === pubkey);
  // Show the active user's review first
  const reviews = useMemo(
    () => [...server.reviews].sort((a, b) => Number(b.event.pubkey === pubkey) - Number(a.event.pubkey === pubkey)),
    [server.reviews, pubkey],
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
              <ServerFavicon url={url} className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{server.host}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="select-all">{url}</span>
                  <CopyButton data={url} variant="ghost" className="h-7 w-7" title="Copy URL" aria-label="Copy URL" />
                </span>
                <ServerStatus url={url} showLabel />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Open <ExternalLink size={14} />
              </a>
            </Button>
            <MyListButton url={url} />
          </div>
        </div>

        <ServerBadges server={server} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => setTab("reports")}
          >
            {server.contributors.size} report contributors · View sources
          </button>
          <ReportDialog url={url}>
            <Button variant="outline" size="sm">
              <Pencil size={14} /> {server.contributors.has(pubkey ?? "") ? "Edit my report" : "Contribute a report"}
            </Button>
          </ReportDialog>
        </div>
      </section>

      <section className={`grid gap-4 ${pubkey ? "sm:grid-cols-3" : ""}`}>
        <div className={`flex items-center gap-4 rounded-xl border bg-card p-4 ${pubkey ? "sm:col-span-2" : ""}`}>
          <div className="flex flex-col items-center px-2">
            <div className="text-4xl font-bold tabular-nums">
              {server.rating !== null ? (server.rating * 5).toFixed(1) : "–"}
            </div>
            <StarRating value={(server.rating ?? 0) * 5} size={14} />
            <div className="mt-1 text-xs text-muted-foreground">{server.reviews.length} reviews</div>
          </div>
          <div className="flex-1">
            <RatingBreakdown server={server} />
          </div>
        </div>
        {pubkey && (
          <div className="flex flex-col justify-center rounded-xl border bg-card p-4">
            <div className="text-4xl font-bold tabular-nums">{server.users.size.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">people you follow list this server</div>
            {server.defaults > 0 && (
              <div className="text-xs text-muted-foreground">{server.defaults} as their default</div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Tabs
              value={!pubkey && tab === "users" ? "reviews" : tab}
              onChange={setTab}
              tabs={[
                { id: "reports", label: `Reports (${server.reports.length})` },
                { id: "reviews", label: `Reviews (${server.reviews.length})` },
                { id: "discussion", label: "Discussion" },
                ...(pubkey
                  ? [{ id: "users" as const, label: `Following (${server.users.size.toLocaleString()})` }]
                  : []),
              ]}
            />
          </div>
        </div>

        {(tab === "reviews" || (!pubkey && tab === "users")) && (
          <div className="flex flex-col gap-4">
            {!myReview && (
              <ReviewDialog server={url}>
                <Button className="self-start">
                  <Star size={16} /> Write a review
                </Button>
              </ReviewDialog>
            )}
            {reviews.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No reviews yet, be the first to write one.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {reviews.map((review) => (
                  <ReviewCard key={review.uid} review={review} />
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "reports" && <ServerReports server={server} />}
        {tab === "discussion" && <Discussion url={url} />}
        {pubkey && tab === "users" && <UsersGrid server={server} />}
      </section>
    </div>
  );
}

export default function ServerView() {
  const params = useParams();
  const url = safeNormalizeServerUrl(params.server);
  if (!url) return <Navigate to="/" replace />;

  return <ServerPage key={url} url={url} />;
}
