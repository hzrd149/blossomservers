import { getTagValue } from "applesauce-core/helpers";
import { NostrEvent } from "nostr-tools";

export function isServerWhitelist(server: NostrEvent): string | boolean {
  return server.tags.some((t) => t[0] === "whitelist") && (getTagValue(server, "whitelist") || true);
}
export function isServerPaid(server: NostrEvent): string | boolean {
  return server.tags.some((t) => t[0] === "paid") && (getTagValue(server, "paid") || true);
}
