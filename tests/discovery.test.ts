import { EventStore } from "applesauce-core";
import { NostrEvent } from "applesauce-core/helpers";
import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/services/nostr", () => ({ eventStore: new EventStore({ verifyEvent: () => true }) }));
vi.mock("../src/services/social", () => ({ socialLists$: of([]) }));

import { COMMENT_KIND, SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND } from "../src/const";
import { directory$, ServerSummary } from "../src/models/directory";
import { eventStore } from "../src/services/nostr";
import { SYNC_LAYERS } from "../src/services/sync";

let counter = 1;
function event(kind: number, tags: string[][], created_at: number): NostrEvent {
  return {
    id: (counter++).toString(16).padStart(64, "0"),
    pubkey: "a".repeat(64),
    kind,
    created_at,
    tags,
    content: "",
    sig: "0".repeat(128),
  };
}

describe("Blossom discovery excludes web discussions", () => {
  it("only globally syncs comments explicitly scoped to the review kind", () => {
    const comments = SYNC_LAYERS.filter((layer) => layer.filter.kinds?.includes(COMMENT_KIND));
    expect(comments).toHaveLength(1);
    expect(comments[0].filter["#K"]).toEqual([String(SERVER_REVIEW_KIND)]);
    expect(SYNC_LAYERS.some((layer) => layer.filter["#K"]?.includes("web"))).toBe(false);
  });

  it("ignores cached and live web comments without maintaining a global comment timeline", () => {
    vi.useFakeTimers();
    const url = "https://cdn.example.com/";
    const unrelated = "https://ordinary-website.example/";
    eventStore.add(event(SERVER_ADVERTIZEMENT_KIND, [["d", url]], 100));
    eventStore.add(
      event(
        COMMENT_KIND,
        [
          ["K", "web"],
          ["I", url],
        ],
        200,
      ),
    );
    eventStore.add(
      event(
        COMMENT_KIND,
        [
          ["K", "web"],
          ["I", unrelated],
        ],
        300,
      ),
    );
    const timeline = vi.spyOn(eventStore, "timeline");
    const received: ServerSummary[][] = [];
    const sub = directory$.subscribe((servers) => received.push(servers));
    try {
      vi.advanceTimersByTime(0);
      expect(received).toHaveLength(1);
      expect(received[0].map((server) => ({ url: server.url, updated: server.updated }))).toEqual([
        { url, updated: 100 },
      ]);
      expect(timeline.mock.calls.some(([filter]) => JSON.stringify(filter).includes(String(COMMENT_KIND)))).toBe(false);

      eventStore.add(
        event(
          COMMENT_KIND,
          [
            ["K", "web"],
            ["I", unrelated],
          ],
          400,
        ),
      );
      eventStore.add(
        event(
          COMMENT_KIND,
          [
            ["K", "web"],
            ["I", url],
          ],
          500,
        ),
      );
      vi.advanceTimersByTime(600);
      expect(received).toHaveLength(1);
    } finally {
      sub.unsubscribe();
      vi.advanceTimersByTime(120_000);
      eventStore.dispose();
      timeline.mockRestore();
      vi.useRealTimers();
    }
  });
});
