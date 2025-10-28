import { relaySet } from "applesauce-core/helpers";

export const SERVER_ADVERTIZEMENT_KIND = 36363;
export const SERVER_REVIEW_KIND = 31963;
export const MOBILE_BREAKPOINT = 950;

// Default relays to connect to
export const DEFAULT_RELAYS = relaySet([
  "wss://nostrue.com/",
  "wss://relay.primal.net/",
  "wss://nos.lol/",
  "wss://relay.damus.io/",
]);

// Default relays to lookup user metadata
export const DEFAULT_LOOKUP_RELAYS = relaySet(["wss://purplepag.es/", "wss://index.hzrd149.com/"]);
