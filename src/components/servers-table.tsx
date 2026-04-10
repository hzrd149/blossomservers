import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getEventUID, getTagValue, NostrEvent } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { useEventModel } from "applesauce-react/hooks";
import { SquareArrowOutUpRight, Star } from "lucide-react";

import { SERVER_REVIEW_KIND } from "@/const";
import useCheckMobile from "@/hooks/use-check-mobile";
import { normalizeServerUrl } from "@/helpers/server";

import Rating from "react-rating";
import { AddReview } from "./add-review";
import CopyButton from "./copy-button";
import { Button } from "./ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { isServerPaid, isServerWhitelist } from "../helpers/server";
import { Badge } from "./ui/badge";
import UserAvatar from "./user/user-avatar";
import UserName from "./user/user-name";
import { ServerStatusDot } from "./server-status-dot";

function ServersTable({
  servers,
  serverListCounts,
}: {
  servers?: NostrEvent[];
  serverListCounts?: Map<string, number>;
}) {
  const isMobile = useCheckMobile();

  if (isMobile)
    return (
      <div className="flex flex-col gap-2">
        {servers?.map((server) => (
          <MobileServerRow key={getEventUID(server)} server={server} serverListCounts={serverListCounts} />
        ))}
      </div>
    );
  else
    return (
      <Table>
        <TableCaption>A list blossom servers</TableCaption>
        {!isMobile && (
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>URL</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {servers?.map((server, index) => (
            <DesktopServerRow
              key={getEventUID(server)}
              server={server}
              odd={index % 2 === 0}
              serverListCounts={serverListCounts}
            />
          ))}
        </TableBody>
      </Table>
    );
}

function useServerReviews(url: URL) {
  return useEventModel(TimelineModel, [{ kinds: [SERVER_REVIEW_KIND], "#d": [url.toString()] }]);
}
function useServerAverage(reviews: NostrEvent[] | undefined) {
  return useMemo(() => {
    if (!reviews) return 0;

    let total = 0;
    let count = 0;

    for (const review of reviews) {
      const ratingTag = review.tags.find((t) => t[0] === "rating" && t[1] && !t[2]);
      if (ratingTag) {
        const value = parseFloat(ratingTag[1]);
        if (!Number.isFinite(value)) continue;

        count++;
        total += value;
      }
    }

    return total / count;
  }, [reviews]);
}

function DesktopServerRow({
  server,
  odd,
  serverListCounts,
}: {
  server: NostrEvent;
  odd?: boolean;
  serverListCounts?: Map<string, number>;
}) {
  const url = useMemo(() => new URL(normalizeServerUrl(getTagValue(server, "d")!)), []);
  const reviews = useServerReviews(url);
  const paid = isServerPaid(server);
  const whitelist = isServerWhitelist(server);

  const average = useServerAverage(reviews);
  const listCount = serverListCounts?.get(url.toString()) || 0;

  return (
    <TableRow className={odd ? "bg-muted/50" : ""}>
      {/* Name */}
      <TableCell className="font-medium">
        <div className="flex flex-col items-start">
          <Link
            to={`/server/${url.host}`}
            className="hover:underline truncate max-w-64"
            title={getTagValue(server, "name")}
          >
            {getTagValue(server, "name")}
          </Link>
          {paid && <Badge className="mr-2">Paid</Badge>}
          {whitelist && <Badge className="mr-2">Whitelist</Badge>}
        </div>
      </TableCell>
      {/* Rating */}
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <ServerRating average={average} />
            <span>({reviews?.length})</span>
          </div>
          <span className="text-xs text-muted-foreground">Users: {listCount}</span>
        </div>
      </TableCell>
      {/* Domain */}
      <TableCell className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <ServerStatusDot url={url.toString()} />
          <a href={url.toString()} target="_blank" className="truncate max-w-48">
            {url.host}
          </a>
        </div>
        <CopyButton data={url.toString()} variant="ghost" className="ms-2" title="Copy URL" aria-label="Copy URL" />
      </TableCell>
      {/* Description */}
      <TableCell className="truncate max-w-96">{server.content}</TableCell>
      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <OpenServerButton url={url} />
          <AddReview server={url} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function MobileServerRow({ server, serverListCounts }: { server: NostrEvent; serverListCounts?: Map<string, number> }) {
  const url = useMemo(() => new URL(normalizeServerUrl(getTagValue(server, "d")!)), []);
  const reviews = useServerReviews(url);
  const paid = isServerPaid(server);
  const whitelist = isServerWhitelist(server);

  const average = useServerAverage(reviews);
  const listCount = serverListCounts?.get(url.toString()) || 0;

  return (
    <div
      className="p-2 flex flex-col border-b-2 border-b-muted bg-background"
      style={{ borderBottomColor: "var(--color-border)" }}
    >
      <div className="flex gap-2 mb-2 justify-between items-start">
        <div className="flex-1 min-w-0">
          <Link to={`/server/${url.host}`} className="hover:underline font-bold text-lg truncate">
            {getTagValue(server, "name")}
          </Link>
          <div className="flex items-center gap-1 text-gray-500">
            <ServerStatusDot url={url.toString()} />
            <span className="truncate">{url.host}</span>
          </div>
        </div>

        <OpenServerButton url={url} />
      </div>
      {(paid || whitelist) && (
        <div className="flex gap-2">
          {paid && <Badge className="mr-2">Paid</Badge>}
          {whitelist && <Badge className="mr-2">Whitelist</Badge>}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <UserAvatar pubkey={server.pubkey} />
        <UserName pubkey={server.pubkey} />
      </div>

      <p>{server.content}</p>

      <div className="flex gap-2 justify-between items-center mt-2">
        <div className="flex flex-col items-start">
          <ServerRating average={average} size={24} />
          <span className="text-xs text-muted-foreground">👥 {listCount}</span>
        </div>

        <div className="flex gap-2">
          <AddReview server={url} />
        </div>
      </div>
    </div>
  );
}

function ServerRating({ average, size }: { average: number; size?: number }) {
  return (
    /* @ts-expect-error */
    <Rating
      initialRating={average * 5}
      fullSymbol={<Star fill="currentColor" size={size || 18} />}
      emptySymbol={<Star size={size || 18} />}
      start={0}
      stop={5}
      fractions={5}
      readonly
    />
  );
}

function OpenServerButton({ url }: { url: URL | string }) {
  return (
    <Button variant="link" onClick={() => window.open(url, "_blank")} className="self-end">
      Open <SquareArrowOutUpRight size={16} />
    </Button>
  );
}

export default ServersTable;
