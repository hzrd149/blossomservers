import { EventStore, OptimisticEventVerifier } from "applesauce-core";
import { Filter, NostrEvent, persistEventsToCache, verifyEvent } from "applesauce-core/helpers";
import { createEventLoaderForStore, createReactionsLoader, createSyncLoader } from "applesauce-loaders/loaders";
import { RelayLiveness, RelayPool } from "applesauce-relay";
import "window.nostrdb.js";

import { DEFAULT_LOOKUP_RELAYS, DEFAULT_RELAYS } from "../const";

// Verify synchronously in JS until WASM is ready; initialization failure must never bypass verification.
let checkSignature: (event: NostrEvent) => boolean = verifyEvent;
export const signatureVerifierReady = import("nostr-wasm")
  .then(({ initNostrWasm }) => initNostrWasm())
  .then((wasm) => {
    checkSignature = (event) => {
      try {
        // nostr-wasm throws on invalid signatures and returns void on success.
        wasm.verifyEvent(event);
        return true;
      } catch {
        return false;
      }
    };
  })
  .catch((error) => console.warn("WASM verification unavailable; using JS verification", error));

export const eventVerifier = new OptimisticEventVerifier({
  storage: {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  },
  verifyEvent: (event) => checkSignature(event),
});

// All ingestion paths (cache, loaders, live events and local publishing) use this verifier.
export const eventStore = new EventStore({ verifyEvent: eventVerifier.verifyEvent });

// Track relay health locally so dead relays are skipped by every request
export const liveness = new RelayLiveness();

// Relay pool for all connections
export const pool = new RelayPool({ liveness });

// Persist all new events to the local cache
persistEventsToCache(eventStore, (events) => Promise.allSettled(events.map((event) => window.nostrdb.add(event))));

/** Load events from the local cache */
export async function cacheRequest(filters: Filter[]): Promise<NostrEvent[]> {
  try {
    return await window.nostrdb.query(filters);
  } catch {
    return [];
  }
}

/** Load events from the local cache directly into the event store */
export async function hydrateFromCache(filters: Filter[]) {
  const events = await cacheRequest(filters);
  for (const event of events) eventStore.add(event);
  return events.length;
}

// Lazily load profiles, relay lists and any other missing events
createEventLoaderForStore(eventStore, pool, {
  cacheRequest,
  extraRelays: DEFAULT_RELAYS,
  lookupRelays: DEFAULT_LOOKUP_RELAYS,
});

// NIP-77 negentropy sync with a paginated REQ fallback for relays that don't support it
export const syncLoader = createSyncLoader({ eventStore, pool, liveness });

// Batched loader for reactions on a single event
export const reactionsLoader = createReactionsLoader(pool, { eventStore, cacheRequest, extraRelays: DEFAULT_RELAYS });
