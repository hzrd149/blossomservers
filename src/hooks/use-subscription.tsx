import { useEffect, useMemo } from "react";
import { Filter } from "nostr-tools";
import hash from "hash-sum";
import { createRxForwardReq } from "rx-nostr";
import { nanoid } from "nanoid";

import { eventStore, rxNostr } from "../nostr";
import { cacheRequest } from "../cache";

export default function useSubscription(id: string, filters: Filter | Filter[]) {
  id = id || useMemo(() => nanoid(), []);
  const rxReq = useMemo(() => createRxForwardReq(id), [id]);

  // load from cache
  useEffect(() => {
    const sub = cacheRequest(Array.isArray(filters) ? filters : [filters]).subscribe({
      next: (e) => eventStore.add(e),
      complete: () => sub.unsubscribe(),
    });
  }, [hash(filters)]);

  // attach to rxNostr
  const observable = useMemo(() => rxNostr.use(rxReq), [rxReq]);

  // subscribe
  // NOTE: have to subscribe before emitting filter
  useEffect(() => {
    const sub = observable.subscribe((_packet) => {});
    return () => sub.unsubscribe();
  }, [observable]);

  // update filters
  useEffect(() => rxReq.emit(filters), [rxReq, hash(filters)]);

  return observable;
}
