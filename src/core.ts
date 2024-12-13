import { createRxNostr, nip07Signer } from "rx-nostr";
import { verifier } from "rx-nostr-crypto";
import { EventStore, QueryStore } from "applesauce-core";
import { EventFactory } from "applesauce-factory";
import { isFromCache } from "applesauce-core/helpers";
import cache from "./cache";

export const eventStore = new EventStore();
export const queryStore = new QueryStore(eventStore);

export const signer = nip07Signer();
export const factory = new EventFactory({ signer });

export const rxNostr = createRxNostr({
  verifier,
  signer,
  connectionStrategy: "lazy-keep",
});

// send all events to eventStore
rxNostr.createAllEventObservable().subscribe((message) => {
  const event = eventStore.add(message.event, message.from);

  // save the event to cache
  if (!isFromCache(event)) cache.publish(event);
});

// set default relays
rxNostr.setDefaultRelays(["wss://nostrue.com/", "wss://relay.primal.net/", "wss://nos.lol/", "wss://relay.damus.io/"]);

if (import.meta.env.DEV) {
  // @ts-expect-error
  window.eventStore = eventStore;
  // @ts-expect-error
  window.queryStore = queryStore;
  // @ts-expect-error
  window.rxNostr = rxNostr;
}
