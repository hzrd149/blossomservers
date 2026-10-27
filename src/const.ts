import { relaySet } from "applesauce-core/helpers";

export const SERVER_ADVERTIZEMENT_KIND = 36363;
// Experimental application protocol; see docs/server-reports.md (not an assigned NIP kind).
export const SERVER_REPORT_KIND = 36364;
export const SERVER_REVIEW_KIND = 31963;
export const SERVER_LIST_KIND = 10063;
export const COMMENT_KIND = 1111;
export const REACTION_KIND = 7;
export const DELETE_KIND = 5;

// Default relays to publish to and read from
export const DEFAULT_RELAYS = relaySet([
  "wss://relay.primal.net/",
  "wss://nos.lol/",
  "wss://relay.damus.io/",
  "wss://relay.ditto.pub/",
  "wss://relay.nostr.net/",
]);

// Relays the directory is synced from, announcements and reviews are spread thinly across many relays
export const DIRECTORY_RELAYS = relaySet(DEFAULT_RELAYS, [
  "wss://nostr.wine/",
  "wss://nostr.mom/",
  "wss://theforest.nostr1.com/",
]);

// Default relays to lookup user metadata
export const DEFAULT_LOOKUP_RELAYS = relaySet(["wss://purplepag.es/", "wss://index.hzrd149.com/"]);

// Relays used for NIP-46 nostr connect sessions started from a QR code
export const NOSTR_CONNECT_RELAYS = relaySet(["wss://bucket.coracle.social/", "wss://relay.nsec.app/"]);
