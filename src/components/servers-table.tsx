import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getEventUID, getTagValue, NostrEvent } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { useEventModel } from "applesauce-react/hooks";
import { SquareArrowOutUpRight, Star } from "lucide-react";

import { SERVER_REVIEW_KIND } from "@/const";
import useCheckMobile from "@/hooks/use-check-mobile";

import Rating from "react-rating";
import { AddReview } from "./add-review";
import CopyButton from "./copy-button";
import { Button } from "./ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { isServerPaid, isServerWhitelist } from "../helpers/server";
import { Badge } from "./ui/badge";

function ServersTable({ servers }: { servers?: NostrEvent[] }) {
  const isMobile = useCheckMobile();

  if (isMobile)
    return (
      <div className="flex flex-col gap-2">
        {servers?.map((server) => <MobileServerRow key={getEventUID(server)} server={server} />)}
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
            <DesktopServerRow key={getEventUID(server)} server={server} odd={index % 2 === 0} />
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

function DesktopServerRow({ server, odd }: { server: NostrEvent; odd?: boolean }) {
  const url = useMemo(() => new URL(getTagValue(server, "d")!), []);
  const reviews = useServerReviews(url);
  const paid = isServerPaid(server);
  const whitelist = isServerWhitelist(server);

  const average = useServerAverage(reviews);

  return (
    <TableRow className={odd ? "bg-neutral-100" : ""}>
      {/* Name */}
      <TableCell className="font-medium">
        <div className="flex flex-col items-start">
          <Link to={`/server/${url.host}`} className="hover:underline">
            {getTagValue(server, "name")}
          </Link>
          {paid && <Badge className="mr-2">Paid</Badge>}
          {whitelist && <Badge className="mr-2">Whitelist</Badge>}
        </div>
      </TableCell>
      {/* Rating */}
      <TableCell>
        <div className="flex items-center gap-2">
          <ServerRating average={average} />
          <span className="">({reviews?.length})</span>
        </div>
      </TableCell>
      {/* Domain */}
      <TableCell className="flex items-center">
        <a href={url.toString()} target="_blank">
          {url.host}
        </a>
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

function MobileServerRow({ server }: { server: NostrEvent }) {
  const url = useMemo(() => new URL(getTagValue(server, "d")!), []);
  const reviews = useServerReviews(url);
  const paid = isServerPaid(server);
  const whitelist = isServerWhitelist(server);

  const average = useServerAverage(reviews);

  return (
    <div className="p-2 flex flex-col border-b-gray-500 border-b-2 ">
      <div className="flex gap-2 mb-2 justify-between items-start">
        <div>
          <Link to={`/server/${url.host}`} className="hover:underline font-bold text-lg">
            {getTagValue(server, "name")}
          </Link>
          <div className="text-gray-500">{url.host}</div>
        </div>

        <OpenServerButton url={url} />
      </div>
      {(paid || whitelist) && (
        <div className="flex gap-2">
          {paid && <Badge className="mr-2">Paid</Badge>}
          {whitelist && <Badge className="mr-2">Whitelist</Badge>}
        </div>
      )}

      <p>{server.content}</p>

      <div className="flex gap-2 justify-between items-center">
        <ServerRating average={average} size={24} />

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
