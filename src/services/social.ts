import { mapEventsToStore } from "applesauce-core";
import { Filter, NostrEvent, unixNow } from "applesauce-core/helpers";
import {
  distinctUntilChanged,
  from,
  ignoreElements,
  map,
  merge,
  of,
  shareReplay,
  startWith,
  switchMap,
  catchError,
  throttleTime,
} from "rxjs";

import { DIRECTORY_RELAYS, SERVER_LIST_KIND } from "../const";
import { accounts } from "./accounts";
import { eventStore, hydrateFromCache, pool, syncLoader } from "./nostr";

/** Only direct follows, never friends-of-friends or the global list population. */
export const socialAuthors$ = accounts.active$.pipe(
  switchMap((account) =>
    account
      ? eventStore.replaceable({ kind: 3, pubkey: account.pubkey }).pipe(
          map((contacts) =>
            [
              ...new Set(
                (contacts?.tags ?? [])
                  .filter((tag) => tag[0] === "p" && /^[0-9a-f]{64}$/.test(tag[1]))
                  .map((tag) => tag[1]),
              ),
            ].sort(),
          ),
          startWith<string[]>([]),
        )
      : of<string[]>([]),
  ),
  distinctUntilChanged((a, b) => a.length === b.length && a.every((key, i) => key === b[i])),
  shareReplay({ bufferSize: 1, refCount: true }),
);

/** Account/follow changes cancel the previous network's requests and immediately clear its counts. */
export const socialLists$ = socialAuthors$.pipe(
  switchMap((authors) => {
    // An empty authors filter can mean "all authors" to a relay. Never send one.
    if (authors.length === 0) return of<NostrEvent[]>([]);
    const filters: Filter[] = [];
    for (let i = 0; i < authors.length; i += 200) {
      filters.push({ kinds: [SERVER_LIST_KIND], authors: authors.slice(i, i + 200) });
    }
    const since = unixNow();
    const updates = from(hydrateFromCache(filters)).pipe(
      switchMap(() =>
        merge(
          ...filters.map((filter) => syncLoader({ relays: DIRECTORY_RELAYS, filter }).status$),
          pool
            .subscription(
              DIRECTORY_RELAYS,
              filters.map((filter) => ({ ...filter, since })),
            )
            .pipe(mapEventsToStore(eventStore)),
        ),
      ),
      ignoreElements(),
      catchError((error) => {
        console.warn("Social list sync failed", error);
        return of();
      }),
    );
    return merge(
      eventStore.timeline(filters).pipe(throttleTime(500, undefined, { leading: true, trailing: true })),
      updates,
    ).pipe(startWith<NostrEvent[]>([]));
  }),
  shareReplay({ bufferSize: 1, refCount: true }),
);
