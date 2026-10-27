import { beforeEach, expect, it, vi } from "vitest";
import { NostrEvent } from "applesauce-core/helpers";
import { accountRelays$, appRelays$ } from "../src/services/settings";

const mocks = vi.hoisted(() => ({ publish: vi.fn(), add: vi.fn(), outboxes: vi.fn() }));
vi.mock("../src/services/accounts", () => ({ accounts: { signer: {} } }));
vi.mock("../src/services/nostr", () => ({ eventStore: { add: mocks.add }, pool: { publish: mocks.publish } }));
vi.mock("applesauce-common/casts", () => ({ castUser: () => ({ outboxes$: { $first: mocks.outboxes } }) }));
import { publishEvent } from "../src/services/publish";

const event: NostrEvent = {
  id: "1".repeat(64),
  pubkey: "a".repeat(64),
  kind: 1,
  tags: [],
  content: "",
  created_at: 1,
  sig: "0".repeat(128),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.publish.mockResolvedValue([{ ok: true }]);
  mocks.outboxes.mockResolvedValue(["wss://outbox.example/"]);
  appRelays$.next(["wss://app.example/"]);
  accountRelays$.next({
    pubkey: event.pubkey,
    loading: false,
    mailboxes: {
      ...event,
      kind: 10002,
      tags: [
        ["r", "wss://known.example", "write"],
        ["r", "wss://read.example", "read"],
        ["r", "wss://app.example"],
      ],
    },
  });
});
it("publishes to app relays, explicit destinations and author outboxes with deduplication", async () => {
  await publishEvent(event, ["wss://extra.example/"]);
  const targets = mocks.publish.mock.calls[0][0];
  expect(new Set(targets)).toEqual(
    new Set(["wss://app.example/", "wss://extra.example/", "wss://outbox.example/", "wss://known.example/"]),
  );
  expect(targets).toHaveLength(4);
  expect(mocks.add).toHaveBeenCalledWith(event);
});
it("does not treat a failed publish as a saved event", async () => {
  mocks.publish.mockResolvedValue([{ ok: false, message: "Offline" }]);
  await expect(publishEvent(event)).rejects.toThrow("Offline");
  expect(mocks.add).not.toHaveBeenCalled();
});
