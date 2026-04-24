import { getEventUID, getTagValue, NostrEvent } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { useEventModel, useObservableState } from "applesauce-react/hooks";
import { ExternalLink } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";

import { AddReview } from "@/components/add-review";
import { AddServer } from "@/components/add-server";
import { EditServer } from "@/components/edit-server";
import CopyButton from "@/components/copy-button";
import Header from "@/components/layout/header";
import { ServerFavicon } from "@/components/server-favicon";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/user/user-avatar";
import UserName from "@/components/user/user-name";
import { useUser } from "@/contexts/user-context";
import { DEFAULT_RELAYS, SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND } from "@/const";
import { isServerPaid, isServerWhitelist, normalizeServerUrl } from "../../helpers/server";
import { eventStore, pool } from "../../nostr";
import Review from "./components/review";

function ServerDetailsPage({ url, server, isPlaceholder }: { url: URL; server: NostrEvent; isPlaceholder?: boolean }) {
  const { pubkey: userPubkey, isLoggedIn } = useUser();
  const reviews = useEventModel(TimelineModel, [{ "#d": [url.toString()], kinds: [SERVER_REVIEW_KIND] }]);

  const names = server && getTagValue(server, "name");
  const paid = isServerPaid(server);
  const whitelist = isServerWhitelist(server);
  const isOwner = userPubkey === server.pubkey;
  const userReview = reviews?.find((review) => review.pubkey === userPubkey);

  const sortedReviews = reviews?.sort((a, b) => {
    if (a.pubkey === userPubkey) return -1;
    if (b.pubkey === userPubkey) return 1;
    return 0;
  });

  const handleDeleteServer = () => {
    window.location.href = "/";
  };

  return (
    <>
      <Header />

      <div className="flex flex-col gap-4 p-4 border rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <ServerFavicon url={url} className="h-8 w-8" />
              <h2 className="text-3xl font-bold truncate">{names || "Server Not Found"}</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground select-all">{url.toString()}</span>
              <CopyButton data={url.toString()} variant="ghost" className="h-6 w-6 p-0" />
            </div>
          </div>
          <Button variant="outline" onClick={() => window.open(url, "_blank")}>
            Open <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {!isPlaceholder && (
          <div className="flex items-center gap-3 pt-2 border-t">
            <UserAvatar pubkey={server.pubkey} />
            <div>
              <p className="text-sm text-muted-foreground">Published by</p>
              <UserName pubkey={server.pubkey} />
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-foreground">{server?.content}</p>
        </div>

        {paid && (
          <div className="pt-2 border-t">
            <h3 className="text-lg font-semibold">Requires payment</h3>
            {typeof paid === "string" && <p className="text-muted-foreground">{paid}</p>}
          </div>
        )}
        {whitelist && (
          <div className="pt-2 border-t">
            <h3 className="text-lg font-semibold">Whitelist</h3>
            {typeof whitelist === "string" && <p className="text-muted-foreground">{whitelist}</p>}
          </div>
        )}
        {isOwner && isLoggedIn && (
          <div className="pt-2 border-t">
            <EditServer server={server} onDelete={handleDeleteServer} />
          </div>
        )}
        {isPlaceholder && isLoggedIn && (
          <div className="pt-2 border-t">
            <AddServer initialUrl={url.toString()} buttonLabel="Claim Server" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <h3 className="text-xl font-semibold">Reviews ({reviews?.length})</h3>
        {isLoggedIn && !userReview && <AddReview server={url} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        {sortedReviews?.map((review) => (
          <Review key={getEventUID(review)} review={review} />
        ))}
      </div>
    </>
  );
}

export default function ServerDetailsView() {
  const params = useParams();
  if (!params.server) return <Navigate to="/" />;

  const url = new URL(
    normalizeServerUrl(params.server.startsWith("http") ? params.server : `https://${params.server}`),
  );

  // load events
  useObservableState(() =>
    pool.subscription(
      DEFAULT_RELAYS,
      {
        "#d": [url.toString()],
        kinds: [SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND],
      },
      { eventStore },
    ),
  );

  // TODO: handle multiple server events
  const server = useEventModel(TimelineModel, [{ "#d": [url.toString()], kinds: [SERVER_ADVERTIZEMENT_KIND] }])?.[0];

  const placeholderServer: NostrEvent = {
    kind: SERVER_ADVERTIZEMENT_KIND,
    pubkey: "0000000000000000000000000000000000000000000000000000000000000000",
    created_at: 0,
    content: "This server has not been registered yet. It may not exist or the advertisement event could not be found.",
    tags: [["d", url.toString()]],
    id: "",
    sig: "",
  };

  const actualServer = server || placeholderServer;

  return <ServerDetailsPage url={url} server={actualServer} isPlaceholder={!server} />;
}
