import { markFromCache } from "applesauce-core/helpers";
import { CacheRelay, openDB } from "nostr-idb";
import { Filter, NostrEvent } from "nostr-tools";
import { Observable } from "rxjs";

const db = await openDB();
const cache = new CacheRelay(db);
cache.connect();

export function cacheRequest(filters: Filter[]): Observable<NostrEvent> {
  return new Observable((observer) => {
    const sub = cache.subscribe(filters, {
      onevent: (event) => {
        markFromCache(event);
        observer.next(event);
      },
      oneose: () => {
        sub.close();
        observer.complete();
      },
      onclose: () => {
        sub.close();
        observer.complete();
      },
    });
  });
}

if (import.meta.env.DEV) {
  // @ts-ignore
  window.localRelay = cache;
}

export default cache;
