import { EventStore } from "applesauce-core";
import { NostrEvent } from "applesauce-core/helpers";
import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/services/nostr", () => ({ eventStore: new EventStore({ verifyEvent: () => true }) }));
vi.mock("../src/services/social", () => ({ socialLists$: of([]) }));

import { ServerReport } from "../src/casts/report";
import { ServerAnnouncement } from "../src/casts/server";
import { SERVER_REPORT_KIND, SERVER_ADVERTIZEMENT_KIND, SERVER_REVIEW_KIND } from "../src/const";
import { Capability, emptyReport, reportTags } from "../src/helpers/report";
import { buildDirectory, capabilityEvidence, directory$, matchesCapabilities } from "../src/models/directory";
import { eventStore } from "../src/services/nostr";
import { ServerReview } from "../src/casts/review";

const now = Math.floor(Date.now() / 1000);
const url = "https://cdn.example.com/";
let counter = 1;
const alice = "a".repeat(64),
  bob = "b".repeat(64);
function event(kind: number, pubkey = alice, tags: string[][] = [], content = "", created_at = now): NostrEvent {
  return {
    kind,
    pubkey,
    tags,
    content,
    created_at,
    id: (counter++).toString(16).padStart(64, "0"),
    sig: "0".repeat(128),
  };
}
function report(pubkey: string, capability: Capability, value = true, at = now): ServerReport {
  const data = emptyReport();
  data.claims = [{ capability, value, assertedAt: at }];
  return new ServerReport(event(SERVER_REPORT_KIND, pubkey, reportTags(url, data), JSON.stringify(data)), eventStore);
}

describe("source-aware directory", () => {
  it("groups multiple authors under one URL without promoting a newest report", () => {
    const servers = buildDirectory([], [], [], [report(alice, "upload"), report(bob, "mirror")]);
    expect(servers).toHaveLength(1);
    expect(servers[0].reports).toHaveLength(2);
    expect(servers[0].contributors.size).toBe(2);
    expect(servers[0].announcement).toBeUndefined();
  });

  it("deduplicates author snapshots and uses deterministic timestamp ties", () => {
    const first = report(alice, "upload");
    const second = report(alice, "mirror");
    const server = buildDirectory([], [], [], [second, first])[0];
    expect(server.reports).toHaveLength(1);
    expect(server.reports[0].id).toBe(first.id);
  });

  it("shows conflicting claims instead of newest-author-wins", () => {
    const server = buildDirectory([], [], [], [report(alice, "upload"), report(bob, "upload", false)])[0];
    expect(capabilityEvidence(server, "upload", now)).toMatchObject({ state: "conflicting", positive: 1, negative: 1 });
  });

  it("does not join capabilities from different reporters for AND filtering", () => {
    const server = buildDirectory([], [], [], [report(alice, "upload"), report(bob, "mirror")])[0];
    expect(matchesCapabilities(server, ["upload"], now)).toBe(true);
    expect(matchesCapabilities(server, ["upload", "mirror"], now)).toBe(false);
  });

  it("keeps stale and unknown separate from explicitly reported absence", () => {
    const server = buildDirectory([], [], [], [report(alice, "upload", true, now - 100 * 86400)])[0];
    expect(capabilityEvidence(server, "upload", now).state).toBe("stale");
    expect(capabilityEvidence(server, "mirror", now).state).toBe("unknown");
    expect(matchesCapabilities(server, ["upload"], now)).toBe(false);
  });

  it("keeps legacy data separate, without manufacturing free/open claims", () => {
    const legacy = new ServerAnnouncement(
      event(SERVER_ADVERTIZEMENT_KIND, alice, [["d", url]], "Old description"),
      eventStore,
    );
    const server = buildDirectory([legacy], [], [], [report(alice, "upload")])[0];
    expect(server.announcements).toHaveLength(1);
    expect(server.reports).toHaveLength(1);
    expect(capabilityEvidence(server, "upload-payment").state).toBe("unknown");
  });

  it("discovers URLs from reviews and direct-follow lists", () => {
    const review = new ServerReview(event(SERVER_REVIEW_KIND, alice, [["d", url]], "Review"), eventStore);
    expect(buildDirectory([], [review], [])[0].url).toBe(url);
    expect(buildDirectory([], [], [event(10063, alice, [["server", url]])])[0].url).toBe(url);
  });

  it("keeps the live directory running after malformed report events", async () => {
    eventStore.add(event(SERVER_REPORT_KIND, alice, [["d", url]], "bad JSON"));
    const valid = report(bob, "mirror");
    eventStore.add(valid.event);
    await new Promise<void>((resolve, reject) => {
      const subscription = directory$.subscribe({
        next: (servers) => {
          try {
            expect(servers.find((server) => server.url === url)?.reports.map((report) => report.event.pubkey)).toEqual([
              bob,
            ]);
            resolve();
          } catch (error) {
            reject(error);
          }
          queueMicrotask(() => subscription.unsubscribe());
        },
        error: reject,
      });
    });
  });

  it("applies author-authorized replacement and deletion without removing others", () => {
    const store = new EventStore({ verifyEvent: () => true });
    const first = report(alice, "upload").event;
    const other = report(bob, "mirror").event;
    const second = { ...report(alice, "media").event, created_at: now + 1 };
    store.add(first);
    store.add(other);
    store.add(second);
    expect(
      store
        .getByFilters({ kinds: [SERVER_REPORT_KIND] })
        .map((event) => event.id)
        .sort(),
    ).toEqual([other.id, second.id].sort());
    store.add(
      event(
        5,
        bob,
        [
          ["e", second.id],
          ["k", String(SERVER_REPORT_KIND)],
        ],
        "",
        now + 2,
      ),
    );
    expect(store.getEvent(second.id)).toBeDefined();
    store.add(
      event(
        5,
        alice,
        [
          ["a", `${SERVER_REPORT_KIND}:${alice}:${url}`],
          ["k", String(SERVER_REPORT_KIND)],
        ],
        "",
        now + 3,
      ),
    );
    expect(store.getByFilters({ kinds: [SERVER_REPORT_KIND] }).map((event) => event.id)).toEqual([other.id]);
    store.dispose();
  });
});
