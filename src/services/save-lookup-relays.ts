import { unixNow } from "applesauce-core/helpers";
import { accounts } from "./accounts";
import { publishEvent } from "./publish";
import { accountRelays$, eventRelays, localLookupRelays$, normalizeRelays } from "./settings";

export async function saveLookupRelays(values: string[], expectedPubkey?: string) {
  const relays = normalizeRelays(values);
  if (!relays.length) throw new Error("Add at least one lookup relay.");
  const account = accounts.active;
  const state = accountRelays$.value;
  if (account?.pubkey !== expectedPubkey || state.pubkey !== expectedPubkey)
    throw new Error("The active account changed. Please reopen settings.");
  if (state.loading) throw new Error("Please wait for your relay lists to finish loading.");
  if (!state.lookup) {
    localLookupRelays$.next(relays);
    return;
  }
  if (!account) throw new Error("Sign in first.");
  const existing = state.lookup;
  const signed = await account.signEvent({
    kind: 10086,
    created_at: Math.max(unixNow(), existing.created_at + 1),
    content: existing.content,
    tags: [...existing.tags.filter((tag) => tag[0] !== "relay"), ...relays.map((url) => ["relay", url])],
  });
  if (accounts.active !== account || accountRelays$.value.lookup?.id !== existing.id)
    throw new Error("Your account or lookup list changed. Review the latest list and try again.");
  await publishEvent(signed, [...eventRelays(existing), ...relays]);
}
