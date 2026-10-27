import { EventStore } from "applesauce-core";
import { BehaviorSubject, NEVER, Observable } from "rxjs";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn(), hydrate: vi.fn() }));
vi.mock("../src/services/accounts", () => ({
  accounts: { active$: new BehaviorSubject<{ pubkey: string } | undefined>(undefined) },
}));
vi.mock("../src/services/nostr", () => ({
  eventStore: new EventStore({ verifyEvent: () => true }),
  pool: { request: mocks.request },
  hydrateFromCache: mocks.hydrate,
}));
import { accounts } from "../src/services/accounts";
import { eventStore } from "../src/services/nostr";
import { relayPolicy$ } from "../src/services/relay-policy";
import { accountRelays$, readRelays$ } from "../src/services/settings";

const alice = "a".repeat(64);
const bob = "b".repeat(64);
function login(pubkey?: string) {
  (accounts.active$ as unknown as BehaviorSubject<{ pubkey: string } | undefined>).next(
    pubkey ? { pubkey } : undefined,
  );
}
beforeEach(() => {
  login();
  eventStore.removeByFilters({});
  mocks.hydrate.mockResolvedValue(0);
  mocks.request.mockReturnValue(NEVER);
});
it("clears account-derived relays and cancels discovery on account switch and logout", async () => {
  const canceled = vi.fn();
  mocks.request.mockReturnValue(new Observable(() => canceled));
  const sub = relayPolicy$.subscribe();
  login(alice);
  await Promise.resolve();
  eventStore.add({
    id: "1".repeat(64),
    pubkey: alice,
    kind: 10002,
    created_at: 1,
    content: "",
    sig: "0".repeat(128),
    tags: [["r", "wss://alice.example"]],
  });
  let reads: string[] = [];
  const readSub = readRelays$.subscribe((value) => {
    reads = value;
  });
  expect(reads).toContain("wss://alice.example/");
  login(bob);
  expect(accountRelays$.value).toMatchObject({ pubkey: bob, loading: true });
  expect(reads).not.toContain("wss://alice.example/");
  expect(canceled).toHaveBeenCalled();
  await Promise.resolve();
  login();
  expect(accountRelays$.value).toEqual({ pubkey: undefined, loading: false });
  readSub.unsubscribe();
  sub.unsubscribe();
});
