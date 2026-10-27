import {
  combineLatest,
  defer,
  finalize,
  ignoreElements,
  merge,
  of,
  switchMap,
  tap,
  catchError,
  takeUntil,
  timer,
  map,
  distinctUntilChanged,
} from "rxjs";
import { accounts } from "./accounts";
import { eventStore, hydrateFromCache, pool } from "./nostr";
import { accountRelays$, appRelays$, eventRelays, localLookupRelays$, normalizeRelays } from "./settings";

/** Subscribe once at the application root. Account changes cancel all previous list discovery. */
export const relayPolicy$ = accounts.active$.pipe(
  switchMap((account) =>
    defer(() => {
      accountRelays$.next({ pubkey: account?.pubkey, loading: !!account });
      if (!account) return of(undefined);
      const pubkey = account.pubkey;
      const filter = { kinds: [10002, 10086], authors: [pubkey] };
      const lists = combineLatest([
        eventStore.replaceable({ kind: 10086, pubkey }),
        eventStore.replaceable({ kind: 10002, pubkey }),
      ]).pipe(
        tap(([lookup, mailboxes]) => accountRelays$.next({ ...accountRelays$.value, pubkey, lookup, mailboxes })),
      );
      const bootstrapRelays = combineLatest([
        appRelays$,
        localLookupRelays$,
        eventStore.replaceable({ kind: 10002, pubkey }),
      ]).pipe(
        map(([app, lookup, mailboxes]) =>
          normalizeRelays([...app, ...lookup, ...eventRelays(mailboxes, "read"), ...eventRelays(mailboxes, "write")]),
        ),
        distinctUntilChanged((a, b) => a.join("\n") === b.join("\n")),
      );
      const discovery = defer(() => hydrateFromCache([filter])).pipe(
        switchMap(() => bootstrapRelays.pipe(switchMap((relays) => pool.request(relays, filter)))),
        tap((event) => eventStore.add(event)),
        takeUntil(timer(8000)),
        catchError(() => of(undefined)),
        finalize(() => {
          if (accountRelays$.value.pubkey === pubkey) accountRelays$.next({ ...accountRelays$.value, loading: false });
        }),
        ignoreElements(),
      );
      return merge(lists, discovery);
    }),
  ),
);
