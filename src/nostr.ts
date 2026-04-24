import { EventFactory, EventStore } from "applesauce-core";
import { Filter, NostrEvent, persistEventsToCache } from "applesauce-core/helpers";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { RelayPool } from "applesauce-relay";
import { ExtensionSigner } from "applesauce-signers";
import { DEFAULT_LOOKUP_RELAYS, DEFAULT_RELAYS } from "./const";

export const eventStore = new EventStore();

// Create signer for creating events
export const signer = new ExtensionSigner();

// Create factory for creating events
export const eventFactory = new EventFactory({ signer });

// Create relay pool for connections
export const pool = new RelayPool();

// Persist all new events to cache
persistEventsToCache(eventStore, async (events) => {
  await Promise.allSettled(events.map((event) => window.nostrdb.add(event)));
});

// Load events from cache
export async function cacheRequest(filters: Filter[]): Promise<NostrEvent[]> {
  const result = window.nostrdb.query(filters);
  if (Array.isArray(result)) return result;
  return [];
}

export const eventLoader = createEventLoaderForStore(eventStore, pool, {
  cacheRequest,
  extraRelays: DEFAULT_RELAYS,
  lookupRelays: DEFAULT_LOOKUP_RELAYS,
});

// Export pubkey getter
export async function getPubkey(): Promise<string | undefined> {
  try {
    return await signer.getPublicKey();
  } catch {
    return undefined;
  }
}
