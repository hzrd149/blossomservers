import { getEventUID } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { useEventModel, useObservableState } from "applesauce-react/hooks";

import Header from "@/components/layout/header";
import { Table, TableBody, TableCaption, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_RELAYS, SERVER_REVIEW_KIND } from "@/const";
import ReviewRow from "./components/review-row";
import { eventStore, pool } from "../../nostr";

export default function ReviewsView() {
  const reviews = useEventModel(TimelineModel, [{ kinds: [SERVER_REVIEW_KIND] }]);

  useObservableState(() => pool.subscription(DEFAULT_RELAYS, { kinds: [SERVER_REVIEW_KIND] }, { eventStore }));

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
        <TableBody>{reviews?.map((review) => <ReviewRow key={getEventUID(review)} review={review} />)}</TableBody>
      </Table>
    </>
  );
}
