import { Star, Users } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import { getServerPath } from "@/helpers/server";
import { ServerSummary } from "@/models/directory";
import { useActivePubkey } from "@/hooks/use-active-account";
import { MyListButton } from "./my-list-button";
import { ServerBadges } from "./server-badges";
import { ServerFavicon } from "./server-favicon";
import { ServerStatus } from "./server-status";
import { StarRating } from "./star-rating";

/** A card summarizing a server in the directory */
export const ServerCard = memo(function ServerCard({ server }: { server: ServerSummary }) {
  const pubkey = useActivePubkey();
  const name = server.host;

  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <ServerFavicon url={server.url} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight">
            {/* The link covers the whole card */}
            <Link to={getServerPath(server.url)} className="after:absolute after:inset-0 after:rounded-xl" title={name}>
              {name}
            </Link>
          </h3>
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{server.host}</span>
            <ServerStatus url={server.url} showLabel className="shrink-0" />
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {server.contributors.size
          ? `${server.contributors.size} report contributors · View attributed details`
          : server.announcements.length
            ? "Legacy descriptions available · No capability reports"
            : "Discovered through community references"}
      </p>

      <ServerBadges server={server} />

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex items-center gap-3 text-sm">
          {server.rating !== null ? (
            <span className="flex items-center gap-1" title={`${(server.rating * 5).toFixed(1)} average rating`}>
              <StarRating value={server.rating * 5} size={14} />
              <span className="text-muted-foreground">({server.reviews.length})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground" title="No reviews yet">
              <Star size={14} /> 0
            </span>
          )}
          {pubkey && (
            <span
              className="flex items-center gap-1 text-muted-foreground"
              title={`${server.users.size} people you follow list this server`}
            >
              <Users size={14} /> {server.users.size}
            </span>
          )}
        </div>
        {/* Sits above the card link so it stays clickable */}
        <MyListButton url={server.url} className="relative z-10" />
      </div>
    </article>
  );
});
