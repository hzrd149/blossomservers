import { mapEventsToStore } from "applesauce-core";
import { Filter, unixNow } from "applesauce-core/helpers";
import { SyncLoaderStatus } from "applesauce-loaders/loaders";
import {
  catchError,
  combineLatest,
  defer,
  from,
  ignoreElements,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import {
  COMMENT_KIND,
  DIRECTORY_RELAYS,
  DELETE_KIND,
  REACTION_KIND,
  SERVER_ADVERTIZEMENT_KIND,
  SERVER_REPORT_KIND,
  SERVER_REVIEW_KIND,
} from "../const";
import { eventStore, hydrateFromCache, pool, syncLoader } from "./nostr";

/** A layer of the directory that is synced from the default relays */
export type SyncLayer = { id: string; label: string; filter: Filter };

/** Every set of events the directory needs, each synced separately with NIP-77 */
export const SYNC_LAYERS: SyncLayer[] = [
  { id: "servers", label: "Legacy announcements", filter: { kinds: [SERVER_ADVERTIZEMENT_KIND] } },
  { id: "reports", label: "Server reports", filter: { kinds: [SERVER_REPORT_KIND] } },
  { id: "reviews", label: "Reviews", filter: { kinds: [SERVER_REVIEW_KIND] } },
  {
    id: "comments",
    label: "Review comments",
    filter: { kinds: [COMMENT_KIND], "#K": [String(SERVER_REVIEW_KIND)] },
  },
  {
    id: "reactions",
    label: "Review reactions",
    filter: { kinds: [REACTION_KIND], "#k": [String(SERVER_REVIEW_KIND)] },
  },
  {
    id: "deletes",
    label: "Deletions",
    filter: {
      kinds: [DELETE_KIND],
      "#k": [
        String(SERVER_ADVERTIZEMENT_KIND),
        String(SERVER_REPORT_KIND),
        String(SERVER_REVIEW_KIND),
        String(COMMENT_KIND),
      ],
    },
  },
];

export type LayerState = { layer: SyncLayer; status?: SyncLoaderStatus; error?: string };
export type DirectorySyncState = {
  /** Number of events loaded from the local cache before syncing */
  cached: number;
  /** Whether the cache has been loaded into the store */
  hydrated: boolean;
  layers: LayerState[];
  /** Whether every layer has finished syncing */
  done: boolean;
};

function syncLayer(layer: SyncLayer): Observable<LayerState> {
  return syncLoader({ relays: DIRECTORY_RELAYS, filter: layer.filter }).status$.pipe(
    map((status): LayerState => ({ layer, status })),
    startWith<LayerState>({ layer }),
    catchError((err) => of<LayerState>({ layer, error: err instanceof Error ? err.message : String(err) })),
  );
}

/** Keep the store up to date with events published after the sync started */
function liveUpdates(since: number) {
  return pool
    .subscription(
      DIRECTORY_RELAYS,
      SYNC_LAYERS.map((layer) => ({ ...layer.filter, since })),
    )
    .pipe(
      mapEventsToStore(eventStore),
      ignoreElements(),
      catchError(() => of()),
    );
}

/**
 * Loads the directory into the store: first from the local cache, then a negentropy sync of every layer
 * (which only downloads what the cache is missing), and finally a live subscription for new events
 */
export const directorySync$: Observable<DirectorySyncState> = defer(() => {
  const since = unixNow();

  return from(hydrateFromCache(SYNC_LAYERS.map((layer) => layer.filter))).pipe(
    // Once the cache is in the store, sync every layer in parallel and listen for new events
    switchMap((cached) =>
      merge(
        combineLatest(SYNC_LAYERS.map(syncLayer)).pipe(
          map((layers): DirectorySyncState => ({
            cached,
            hydrated: true,
            layers,
            done: layers.every((l) => l.error !== undefined || l.status?.done),
          })),
        ),
        liveUpdates(since),
      ),
    ),
    startWith<DirectorySyncState>({ cached: 0, hydrated: false, layers: [], done: false }),
  );
}).pipe(shareReplay(1));
