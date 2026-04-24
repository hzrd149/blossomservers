import { getEventUID } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { use$, useEventModel } from "applesauce-react/hooks";
import { useEffect } from "react";

import Header from "@/components/layout/header";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_RELAYS, SERVER_REVIEW_KIND } from "@/const";
import { cacheRequest, eventStore, pool } from "../../nostr";
import ReviewRow from "./components/review-row";

export default function ReviewsView() {
  const reviews = useEventModel(TimelineModel, [{ kinds: [SERVER_REVIEW_KIND] }]);

  // Start the subscription
  use$(() => pool.subscription(DEFAULT_RELAYS, { kinds: [SERVER_REVIEW_KIND] }, { eventStore }), []);

  // Load events from cache
  useEffect(() => {
    cacheRequest([{ kinds: [SERVER_REVIEW_KIND] }]).then((events) => {
      for (const event of events) eventStore.add(event);
    });
  }, []);

  return (
    <>
      <Header />

      <Table>
        <TableCaption>Recent server reviews</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Author</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Server</TableHead>
            <TableHead>Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews?.map((review) => (
            <ReviewRow key={getEventUID(review)} review={review} />
          ))}
        </TableBody>
      </Table>
    </>
  );
}
