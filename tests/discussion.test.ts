import { EventStore } from "applesauce-core";
import { NostrEvent } from "applesauce-core/helpers";
import { NEVER, Observable, Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ subscription: vi.fn(), hydrateFromCache: vi.fn() }));
vi.mock("../src/services/nostr", () => ({
  eventStore: new EventStore({ verifyEvent: () => true }),
  pool: { subscription: mocked.subscription },
  hydrateFromCache: mocked.hydrateFromCache,
}));

import { COMMENT_KIND, DIRECTORY_RELAYS } from "../src/const";
import { serverDiscussionUpdates$ } from "../src/services/discussion";
import { eventStore } from "../src/services/nostr";

const url = "https://cdn.example.com/";
const filter = { kinds: [COMMENT_KIND], "#K": ["web"], "#I": [url], limit: 50 };

describe("on-demand server discussions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventStore.removeByFilters({});
    mocked.hydrateFromCache.mockResolvedValue(0);
    mocked.subscription.mockReturnValue(NEVER);
  });

  it("does no work until subscribed, then loads bounded history for the exact server URL", async () => {
    const updates = serverDiscussionUpdates$(url);
    expect(mocked.hydrateFromCache).not.toHaveBeenCalled();
    expect(mocked.subscription).not.toHaveBeenCalled();
    const sub = updates.subscribe();
    try {
      expect(mocked.hydrateFromCache).toHaveBeenCalledWith([filter]);
      await Promise.resolve();
      expect(mocked.subscription).toHaveBeenCalledExactlyOnceWith(DIRECTORY_RELAYS, filter);
    } finally {
      sub.unsubscribe();
    }
  });

  it("stores live replies without emitting redundant UI updates and closes on tab exit", async () => {
    const incoming = new Subject<NostrEvent>();
    const closed = vi.fn();
    mocked.subscription.mockReturnValue(
      new Observable<NostrEvent>((subscriber) => {
        const sub = incoming.subscribe(subscriber);
        return () => {
          sub.unsubscribe();
          closed();
        };
      }),
    );
    const next = vi.fn();
    const sub = serverDiscussionUpdates$(url).subscribe(next);
    await Promise.resolve();
    const reply: NostrEvent = {
      id: "1".repeat(64),
      pubkey: "a".repeat(64),
      sig: "0".repeat(128),
      kind: COMMENT_KIND,
      created_at: 100,
      content: "Reply",
      tags: [
        ["K", "web"],
        ["I", url],
        ["k", "1111"],
        ["e", "2".repeat(64)],
      ],
    };
    incoming.next(reply);
    expect(eventStore.getEvent(reply.id)).toBeDefined();
    expect(next).not.toHaveBeenCalled();
    sub.unsubscribe();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("does not start a relay subscription if the tab closes during cache loading", async () => {
    let finish!: (count: number) => void;
    mocked.hydrateFromCache.mockReturnValue(
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    const sub = serverDiscussionUpdates$(url).subscribe();
    sub.unsubscribe();
    finish(0);
    await Promise.resolve();
    expect(mocked.subscription).not.toHaveBeenCalled();
  });
});
