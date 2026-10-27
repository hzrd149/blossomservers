import { mapEventsToStore } from "applesauce-core";
import { Filter } from "applesauce-core/helpers";
import { catchError, defer, EMPTY, from, ignoreElements, switchMap } from "rxjs";

import { COMMENT_KIND } from "../const";
import { readRelays$ } from "./settings";
import { eventStore, hydrateFromCache, pool } from "./nostr";

/** Load a selected server's discussion only while its tab is open; never use comments for discovery. */
export function serverDiscussionUpdates$(url: string) {
  return defer(() => {
    // Bound the initial history per relay/cache query while continuing to receive live replies.
    const filter: Filter = { kinds: [COMMENT_KIND], "#K": ["web"], "#I": [url], limit: 50 };
    return from(hydrateFromCache([filter])).pipe(
      switchMap(() => readRelays$.pipe(switchMap((relays) => pool.subscription(relays, filter)))),
      mapEventsToStore(eventStore),
      // The UI reads the store, not individual network events.
      ignoreElements(),
      catchError((error) => {
        console.warn("Server discussion sync failed", error);
        return EMPTY;
      }),
    );
  });
}
