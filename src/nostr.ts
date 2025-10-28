import { EventStore } from "applesauce-core";
import { Filter, NostrEvent, persistEventsToCache } from "applesauce-core/helpers";
import { EventFactory } from "applesauce-factory";
import { createAddressLoader, createEventLoader } from "applesauce-loaders/loaders";
import { RelayPool } from "applesauce-relay";
import { ExtensionSigner } from "applesauce-signers";
import { DEFAULT_LOOKUP_RELAYS, DEFAULT_RELAYS } from "./const";

export const eventStore = new EventStore();

// Create signer for creating events
export const signer = new ExtensionSigner();

// Create factory for creating events
export const factory = new EventFactory({ signer });

// Create relay pool for connections
export const pool = new RelayPool();

// Persist all new events to cache
persistEventsToCache(eventStore, async (events) => {
  await Promise.allSettled(events.map((event) => window.nostrdb.add(event)));
});

// Load events from cache
export function cacheRequest(filters: Filter[]): Promise<NostrEvent[]> {
  return window.nostrdb.filters(filters);
}

// Create replaceable loader for addressable events
const replaceableLoader = createAddressLoader(pool, {
  eventStore,
  cacheRequest,
  extraRelays: DEFAULT_RELAYS,
  lookupRelays: DEFAULT_LOOKUP_RELAYS,
});

// Create event loader for single events
const eventLoader = createEventLoader(pool, {
  eventStore,
  cacheRequest,
  extraRelays: DEFAULT_RELAYS,
});

// Attach the loaders to the event store
eventStore.addressableLoader = replaceableLoader;
eventStore.replaceableLoader = replaceableLoader;
eventStore.eventLoader = eventLoader;
