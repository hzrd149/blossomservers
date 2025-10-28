import { getEventUID, getTagValue, NostrEvent } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { useEventModel, useObservable, useObservableState } from "applesauce-react/hooks";
import { ExternalLink } from "lucide-react";
import { Navigate, useParams } from "react-router-dom";

import { AddReview } from "@/components/add-review";
import CopyButton from "@/components/copy-button";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { DEFAULT_RELAYS, SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND } from "@/const";
import { isServerPaid, isServerWhitelist } from "../../helpers/server";
import { eventStore, pool } from "../../nostr";
import Review from "./components/review";

function ServerDetailsPage({ url, server }: { url: URL; server: NostrEvent }) {
  const reviews = useEventModel(TimelineModel, [{ "#d": [url.toString()], kinds: [SERVER_REVIEW_KIND] }]);

  const names = server && getTagValue(server, "name");
  const paid = isServerPaid(server);
  const whitelist = isServerWhitelist(server);

  return (
    <>
      <Header />

      <div className="flex gap-2">
        <div>
          <h2 className="text-4xl">{names}</h2>
          <span className="text-gray-500 select-all">{url.toString()}</span>
        </div>
        <CopyButton data={url.toString()} variant="ghost" />
        <Button variant="outline" onClick={() => window.open(url, "_blank")} className="ms-auto">
          Open <ExternalLink size="1.2em" />
        </Button>
      </div>

      <p className="py-2">{server?.content}</p>

      {paid && (
        <>
          <h3 className="text-xl">Requires payment</h3>
          {typeof paid === "string" && <p className="pb-2">{paid}</p>}
        </>
      )}
      {whitelist && (
        <>
          <h3 className="text-xl">Whitelist</h3>
          {typeof whitelist === "string" && <p className="pb-2">{whitelist}</p>}
        </>
      )}

      <div className="flex gap-2 pt-2">
        <h3 className="text-2xl">Reviews ({reviews?.length})</h3>
        <AddReview server={url} />
      </div>

      <div className="flex flex-col gap-2">
        {reviews?.map((review) => <Review key={getEventUID(review)} review={review} />)}
      </div>
    </>
  );
}

export default function ServerDetailsView() {
  const params = useParams();
  if (!params.server) return <Navigate to="/" />;

  const url = new URL("https://" + params.server);

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

  if (server) return <ServerDetailsPage url={url} server={server} />;
  else return <p>Loading...</p>;
}
