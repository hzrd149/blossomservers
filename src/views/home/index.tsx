import { getTagValue, NostrEvent } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { useEventModel, useObservableState } from "applesauce-react/hooks";
import { useEffect, useMemo } from "react";

import Header from "@/components/layout/header";
import { DEFAULT_RELAYS, SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND, SERVER_LIST_KIND } from "@/const";
import { isValidServerUrl, normalizeServerUrl } from "@/helpers/server";

import ServersTable from "../../components/servers-table";
import { cacheRequest, eventStore, pool } from "../../nostr";

export default function HomeView() {
  useObservableState(() => pool.subscription(DEFAULT_RELAYS, { kinds: [SERVER_ADVERTIZEMENT_KIND] }, { eventStore }));

  useObservableState(() => pool.subscription(DEFAULT_RELAYS, { kinds: [SERVER_REVIEW_KIND] }, { eventStore }));

  useObservableState(() => pool.subscription(DEFAULT_RELAYS, { kinds: [SERVER_LIST_KIND] }, { eventStore }));

  // Load events from cache
  useEffect(() => {
    cacheRequest([{ kinds: [SERVER_ADVERTIZEMENT_KIND] }]).then((events) => {
      for (const event of events) eventStore.add(event);
    });
  }, []);

  useEffect(() => {
    cacheRequest([{ kinds: [SERVER_REVIEW_KIND] }]).then((events) => {
      for (const event of events) eventStore.add(event);
    });
  }, []);

  useEffect(() => {
    cacheRequest([{ kinds: [SERVER_LIST_KIND] }]).then((events) => {
      for (const event of events) eventStore.add(event);
    });
  }, []);

  const servers = useEventModel(TimelineModel, [{ kinds: [SERVER_ADVERTIZEMENT_KIND] }]);
  const lists = useEventModel(TimelineModel, [{ kinds: [SERVER_LIST_KIND] }]);

  const allServerUrls = useMemo(() => {
    const urlSet = new Set<string>();

    for (const server of servers || []) {
      const url = getTagValue(server, "d");
      if (url && isValidServerUrl(url)) urlSet.add(normalizeServerUrl(url));
    }

    for (const list of lists || []) {
      for (const tag of list.tags) {
        if (tag[0] === "server") {
          const url = tag[1];
          if (url && isValidServerUrl(url)) urlSet.add(normalizeServerUrl(url));
        }
      }
    }

    return Array.from(urlSet);
  }, [servers, lists]);

  const serversByUrl = useMemo(() => {
    const map = new Map<string, NostrEvent>();
    for (const server of servers || []) {
      const url = getTagValue(server, "d");
      if (url) {
        const normalized = normalizeServerUrl(url);
        map.set(normalized, server);
      }
    }
    return map;
  }, [servers]);

  const serverReviewCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const server of servers || []) {
      const url = getTagValue(server, "d");
      if (url && isValidServerUrl(url)) {
        const normalized = normalizeServerUrl(url);
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
    return counts;
  }, [servers]);

  const serverListCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const list of lists || []) {
      for (const tag of list.tags) {
        if (tag[0] === "server") {
          const url = tag[1];
          if (url && isValidServerUrl(url)) {
            const normalized = normalizeServerUrl(url);
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
          }
        }
      }
    }
    return counts;
  }, [lists]);

  const allServers = useMemo(() => {
    const serverList = allServerUrls.map((url) => {
      const existing = serversByUrl.get(url);
      if (existing) return existing;

      const parsedUrl = new URL(url);
      const dTag = url;
      const nameTag = parsedUrl.host;
      const fakeId = `list-${dTag}`;
      return {
        id: fakeId,
        pubkey: "0000000000000000000000000000000000000000000000000000000000000000",
        created_at: 0,
        kind: SERVER_ADVERTIZEMENT_KIND,
        tags: [
          ["d", dTag],
          ["name", nameTag],
        ],
        content: "—",
        sig: "0000000000000000000000000000000000000000000000000000000000000000",
      } as NostrEvent;
    });

    return serverList.sort((a, b) => {
      const urlA = normalizeServerUrl(getTagValue(a, "d")!);
      const urlB = normalizeServerUrl(getTagValue(b, "d")!);

      const reviewsA = serverReviewCounts.get(urlA) || 0;
      const reviewsB = serverReviewCounts.get(urlB) || 0;

      const listA = serverListCounts.get(urlA) || 0;
      const listB = serverListCounts.get(urlB) || 0;

      const scoreA = reviewsA * 5 + listA;
      const scoreB = reviewsB * 5 + listB;

      return scoreB - scoreA;
    });
  }, [allServerUrls, serversByUrl, serverReviewCounts, serverListCounts]);

  return (
    <>
      <Header />

      <ServersTable servers={allServers} serverListCounts={serverListCounts} />
    </>
  );
}
