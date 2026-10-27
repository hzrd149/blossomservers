import { NostrEvent } from "applesauce-core/helpers";
import { firstValueFrom } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOOKUP_RELAYS, DIRECTORY_RELAYS } from "../src/const";
import {
  accountRelays$,
  appRelays$,
  eventRelays,
  localLookupRelays$,
  lookupRelays$,
  normalizeRelays,
  readRelays$,
} from "../src/services/settings";

const mocks = vi.hoisted(() => ({ active: undefined as any, publish: vi.fn() }));
vi.mock("../src/services/accounts", () => ({
  accounts: {
    get active() {
      return mocks.active;
    },
  },
}));
vi.mock("../src/services/publish", () => ({ publishEvent: mocks.publish }));
import { saveLookupRelays } from "../src/services/save-lookup-relays";

const pubkey = "a".repeat(64);
function event(kind: number, tags: string[][]): NostrEvent {
  return { id: "1".repeat(64), pubkey, kind, tags, content: "preserve me", created_at: 1, sig: "0".repeat(128) };
}
beforeEach(() => {
  mocks.active = undefined;
  mocks.publish.mockReset();
  accountRelays$.next({ loading: false });
  appRelays$.next(DIRECTORY_RELAYS);
  localLookupRelays$.next(DEFAULT_LOOKUP_RELAYS);
});

describe("relay policy", () => {
  it("normalizes and deduplicates URLs and rejects unsupported URLs", () => {
    expect(normalizeRelays([" EXAMPLE.com ", "wss://example.com/", "https://example.com"])).toEqual([
      "wss://example.com/",
    ]);
    expect(normalizeRelays(["relay.example/path", "http://localhost:8080", "ws://localhost:8080/"])).toEqual([
      "wss://relay.example/path",
      "ws://localhost:8080/",
    ]);
    for (const url of ["nostr:invalid", "not a domain", "", "wss://user:pass@example.com", "wss://example.com/#x"]) {
      expect(() => normalizeRelays([url])).toThrow();
    }
  });
  it("uses local defaults signed out and always retains app relays", async () => {
    expect(await firstValueFrom(readRelays$)).toEqual(DIRECTORY_RELAYS);
    expect(await firstValueFrom(lookupRelays$)).toEqual(DEFAULT_LOOKUP_RELAYS);
    accountRelays$.next({
      pubkey,
      loading: false,
      mailboxes: event(10002, [
        ["r", "wss://read.example", "read"],
        ["r", "wss://write.example", "write"],
        ["r", "wss://both.example"],
        ["r", "not a domain"],
      ]),
    });
    expect(await firstValueFrom(readRelays$)).toEqual([
      ...DIRECTORY_RELAYS,
      "wss://read.example/",
      "wss://both.example/",
    ]);
    expect(eventRelays(accountRelays$.value.mailboxes, "write")).toEqual([
      "wss://write.example/",
      "wss://both.example/",
    ]);
  });
  it("reacts to local edits, account lists, account switching and logout", () => {
    const seen: string[][] = [];
    const sub = lookupRelays$.subscribe((value) => seen.push(value));
    localLookupRelays$.next(["wss://local.example/"]);
    accountRelays$.next({ pubkey, loading: false, lookup: event(10086, [["relay", "wss://account.example"]]) });
    expect(seen.at(-1)).toEqual(["wss://account.example/"]);
    accountRelays$.next({ pubkey: "b".repeat(64), loading: true });
    expect(seen.at(-1)).toEqual(["wss://local.example/"]);
    accountRelays$.next({ loading: false });
    expect(seen.at(-1)).toEqual(["wss://local.example/"]);
    sub.unsubscribe();
  });
});

describe("saving lookup relays", () => {
  it("saves locally without creating a list, signed out or signed in", async () => {
    await saveLookupRelays(["wss://local.example"]);
    expect(localLookupRelays$.value).toEqual(["wss://local.example/"]);
    mocks.active = { pubkey, signEvent: vi.fn() };
    accountRelays$.next({ pubkey, loading: false });
    await saveLookupRelays(["wss://other.example"], pubkey);
    expect(mocks.active.signEvent).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("updates only relay tags of an existing list and preserves content", async () => {
    const lookup = event(10086, [
      ["relay", "wss://old.example"],
      ["name", "My list"],
    ]);
    accountRelays$.next({ pubkey, lookup, loading: false });
    mocks.active = { pubkey, signEvent: vi.fn(async (template) => ({ ...lookup, ...template })) };
    await saveLookupRelays(["wss://new.example"], pubkey);
    expect(mocks.active.signEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 10086,
        content: "preserve me",
        tags: [
          ["name", "My list"],
          ["relay", "wss://new.example/"],
        ],
      }),
    );
    expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), ["wss://old.example/", "wss://new.example/"]);
  });
  it("blocks saving during discovery and after an account switch", async () => {
    mocks.active = { pubkey };
    accountRelays$.next({ pubkey, loading: true });
    await expect(saveLookupRelays(["wss://new.example"], pubkey)).rejects.toThrow("loading");
    await expect(saveLookupRelays(["wss://new.example"])).rejects.toThrow("account changed");
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("does not publish if the account changes while signing", async () => {
    const lookup = event(10086, []);
    accountRelays$.next({ pubkey, lookup, loading: false });
    mocks.active = {
      pubkey,
      signEvent: vi.fn(async () => {
        mocks.active = undefined;
        return lookup;
      }),
    };
    await expect(saveLookupRelays(["wss://new.example"], pubkey)).rejects.toThrow("changed");
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("surfaces signing and publishing failures without replacing the list", async () => {
    const lookup = event(10086, []);
    accountRelays$.next({ pubkey, lookup, loading: false });
    mocks.active = { pubkey, signEvent: vi.fn().mockRejectedValue(new Error("Rejected")) };
    await expect(saveLookupRelays(["wss://new.example"], pubkey)).rejects.toThrow("Rejected");
    mocks.active.signEvent.mockResolvedValue(lookup);
    mocks.publish.mockRejectedValue(new Error("Offline"));
    await expect(saveLookupRelays(["wss://new.example"], pubkey)).rejects.toThrow("Offline");
    expect(accountRelays$.value.lookup).toBe(lookup);
  });
});
