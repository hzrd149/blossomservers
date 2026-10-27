import { ensureWebSocketURL, NostrEvent } from "applesauce-core/helpers";
import { BehaviorSubject, combineLatest, distinctUntilChanged, map } from "rxjs";
import { DEFAULT_LOOKUP_RELAYS, DIRECTORY_RELAYS } from "../const";

export function normalizeRelays(values: string[]): string[] {
  return [
    ...new Set(
      values.map((value) => {
        const url = new URL(ensureWebSocketURL(value.trim()));
        if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.hash)
          throw new Error(`Invalid relay URL: ${value}`);
        return url.toString();
      }),
    ),
  ];
}

export function eventRelays(event: NostrEvent | undefined, marker?: "read" | "write"): string[] {
  return [
    ...new Set(
      (event?.tags ?? []).flatMap((tag) => {
        if (tag[0] !== (marker ? "r" : "relay") || (marker && tag[2] && tag[2] !== marker)) return [];
        try {
          return normalizeRelays([tag[1]]);
        } catch {
          return [];
        }
      }),
    ),
  ];
}

function setting(key: string, fallback: string[]) {
  let initial = fallback;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Array.isArray(stored) && stored.length && stored.every((v) => typeof v === "string"))
      initial = normalizeRelays(stored);
  } catch {
    /* Use defaults when storage is unavailable or invalid. */
  }
  const subject = new BehaviorSubject(initial);
  subject.subscribe((value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  });
  return subject;
}

export const appRelays$ = setting("blossomservers.app-relays", DIRECTORY_RELAYS);
export const localLookupRelays$ = setting("blossomservers.lookup-relays", DEFAULT_LOOKUP_RELAYS);
export type AccountRelayState = { pubkey?: string; lookup?: NostrEvent; mailboxes?: NostrEvent; loading: boolean };
export const accountRelays$ = new BehaviorSubject<AccountRelayState>({ loading: false });
const same = (a: string[], b: string[]) => a.join("\n") === b.join("\n");
export const lookupRelays$ = combineLatest([localLookupRelays$, accountRelays$]).pipe(
  map(([local, account]) => (account.lookup ? eventRelays(account.lookup) : local)),
  distinctUntilChanged(same),
);
export const readRelays$ = combineLatest([appRelays$, accountRelays$]).pipe(
  map(([app, account]) => normalizeRelays([...app, ...eventRelays(account.mailboxes, "read")])),
  distinctUntilChanged(same),
);
