import { EventStore } from "applesauce-core";
import { NostrEvent } from "applesauce-core/helpers";
import { BehaviorSubject, NEVER } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  subscription: vi.fn(),
  syncLoader: vi.fn(),
  hydrateFromCache: vi.fn(),
}));

vi.mock("../src/services/nostr", () => ({
  eventStore: new EventStore({ verifyEvent: () => true }),
  pool: { subscription: mocked.subscription },
  syncLoader: mocked.syncLoader,
  hydrateFromCache: mocked.hydrateFromCache,
}));
vi.mock("../src/services/accounts", () => ({
  accounts: { active$: new BehaviorSubject<{ pubkey: string } | undefined>(undefined) },
}));

import { accounts } from "../src/services/accounts";
import { eventStore } from "../src/services/nostr";
import { socialLists$ } from "../src/services/social";
import { SYNC_LAYERS } from "../src/services/sync";
import { SERVER_LIST_KIND } from "../src/const";

const alice = "a".repeat(64);
const bob = "b".repeat(64);
const stranger = "c".repeat(64);
const other = "d".repeat(64);
let timestamp = 1;
function event(pubkey: string, kind: number, tags: string[][]): NostrEvent {
  const created_at = timestamp++;
  return {
    id: created_at.toString(16).padStart(64, "0"),
    pubkey,
    kind,
    tags,
    created_at,
    content: "",
    sig: "0".repeat(128),
  };
}
function login(pubkey: string | undefined) {
  // AccountManager is deliberately replaced with a tiny reactive account source.
  (accounts.active$ as unknown as BehaviorSubject<{ pubkey: string } | undefined>).next(
    pubkey ? { pubkey } : undefined,
  );
}

describe("social list synchronization", () => {
  beforeEach(() => {
    login(undefined);
    eventStore.removeByFilters({});
    vi.clearAllMocks();
    mocked.subscription.mockReturnValue(NEVER);
    mocked.syncLoader.mockReturnValue({ status$: NEVER });
    mocked.hydrateFromCache.mockResolvedValue(0);
  });

  it("never includes Blossom lists in the global directory sync", () => {
    expect(SYNC_LAYERS.every((layer) => !layer.filter.kinds?.includes(SERVER_LIST_KIND))).toBe(true);
  });

  it("does not hydrate or request any lists while signed out", () => {
    eventStore.add(event(stranger, SERVER_LIST_KIND, [["server", "https://outside.example"]]));
    let lists: NostrEvent[] = [];
    const sub = socialLists$.subscribe((value) => {
      lists = value;
    });
    expect(lists).toEqual([]);
    expect(mocked.hydrateFromCache).not.toHaveBeenCalled();
    expect(mocked.subscription).not.toHaveBeenCalled();
    sub.unsubscribe();
  });

  it("never sends an empty authors filter for an account with no follows", () => {
    login(alice);
    const sub = socialLists$.subscribe();
    expect(mocked.hydrateFromCache).not.toHaveBeenCalled();
    sub.unsubscribe();
  });

  it("syncs only direct follows and excludes unrelated cached lists", async () => {
    eventStore.add(
      event(alice, 3, [
        ["p", bob],
        ["p", bob],
        ["p", "invalid"],
      ]),
    );
    eventStore.add(event(bob, SERVER_LIST_KIND, [["server", "https://friend.example"]]));
    eventStore.add(event(stranger, SERVER_LIST_KIND, [["server", "https://outside.example"]]));
    login(alice);
    let lists: NostrEvent[] = [];
    const sub = socialLists$.subscribe((value) => {
      lists = value;
    });
    await Promise.resolve();
    expect(lists.map((list) => list.pubkey)).toEqual([bob]);
    expect(mocked.hydrateFromCache).toHaveBeenCalledWith([{ kinds: [SERVER_LIST_KIND], authors: [bob] }]);
    expect(mocked.syncLoader.mock.calls[0][0].filter.authors).toEqual([bob]);
    expect(mocked.subscription.mock.calls[0][1][0].authors).toEqual([bob]);
    sub.unsubscribe();
  });

  it("clears counts and cancels old subscriptions on account switch and logout", async () => {
    const canceled = vi.fn();
    mocked.subscription.mockReturnValue(new (await import("rxjs")).Observable(() => canceled));
    eventStore.add(event(alice, 3, [["p", bob]]));
    eventStore.add(event(bob, SERVER_LIST_KIND, [["server", "https://friend.example"]]));
    login(alice);
    let lists: NostrEvent[] = [];
    const sub = socialLists$.subscribe((value) => {
      lists = value;
    });
    await Promise.resolve();
    expect(lists).toHaveLength(1);
    login(other);
    expect(lists).toEqual([]);
    expect(canceled).toHaveBeenCalledOnce();
    login(undefined);
    expect(lists).toEqual([]);
    sub.unsubscribe();
  });

  it("drops an unfollowed person's cached list immediately", async () => {
    eventStore.add(event(alice, 3, [["p", bob]]));
    eventStore.add(event(bob, SERVER_LIST_KIND, [["server", "https://friend.example"]]));
    login(alice);
    let lists: NostrEvent[] = [];
    const sub = socialLists$.subscribe((value) => {
      lists = value;
    });
    await Promise.resolve();
    expect(lists).toHaveLength(1);
    eventStore.add(event(alice, 3, []));
    expect(lists).toEqual([]);
    sub.unsubscribe();
  });
});
