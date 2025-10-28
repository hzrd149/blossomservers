import { TimelineModel } from "applesauce-core/models";
import { useEventModel, useObservableState } from "applesauce-react/hooks";
import { useEffect } from "react";

import Header from "@/components/layout/header";
import { DEFAULT_RELAYS, SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND } from "@/const";

import ServersTable from "../../components/servers-table";
import { cacheRequest, eventStore, pool } from "../../nostr";

export default function HomeView() {
  useObservableState(() =>
    pool.subscription(DEFAULT_RELAYS, { kinds: [SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND] }, { eventStore }),
  );

  // Load events from cache
  useEffect(() => {
    cacheRequest([{ kinds: [SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND] }]).then((events) => {
      for (const event of events) eventStore.add(event);
    });
  }, []);

  const servers = useEventModel(TimelineModel, [{ kinds: [SERVER_ADVERTIZEMENT_KIND] }]);

  return (
    <>
      <Header />

      <ServersTable servers={servers} />
    </>
  );
}
