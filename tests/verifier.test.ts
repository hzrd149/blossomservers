import { finalizeEvent } from "applesauce-core/helpers";
import { beforeAll, describe, expect, it, vi } from "vitest";

const wasmCheck = vi.hoisted(() => vi.fn());
vi.mock("nostr-wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nostr-wasm")>();
  return {
    initNostrWasm: async () => {
      const wasm = await actual.initNostrWasm();
      wasmCheck.mockImplementation(wasm.verifyEvent.bind(wasm));
      return { ...wasm, verifyEvent: wasmCheck };
    },
  };
});

vi.mock("window.nostrdb.js", () => ({}));
vi.mock("applesauce-relay", () => ({ RelayLiveness: class {}, RelayPool: class {} }));
vi.mock("applesauce-loaders/loaders", () => ({
  createEventLoaderForStore: vi.fn(),
  createReactionsLoader: vi.fn(),
  createSyncLoader: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal("window", {
    navigator: { onLine: true },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    nostrdb: { add: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("optimistic verifier with real nostr-wasm signatures", () => {
  it("accepts valid signatures and rejects bad signatures, content and IDs", async () => {
    const { signatureVerifierReady, eventVerifier, eventStore } = await import("../src/services/nostr");
    await signatureVerifierReady;
    const signed = finalizeEvent({ kind: 1, created_at: 1, tags: [], content: "valid" }, new Uint8Array(32).fill(1));
    const clean = () => JSON.parse(JSON.stringify(signed));
    expect(eventStore.verifyEvent).toBe(eventVerifier.verifyEvent);
    expect(eventStore.add(clean())).not.toBeNull();
    expect(eventVerifier.verifyEvent({ ...clean(), sig: "0".repeat(128) })).toBe(false);
    expect(eventVerifier.verifyEvent({ ...clean(), content: "tampered" })).toBe(false);
    expect(eventVerifier.verifyEvent({ ...clean(), id: "0".repeat(64) })).toBe(false);
    expect(eventStore.add({ ...clean(), sig: "0".repeat(128) })).toBeNull();
    expect(wasmCheck).toHaveBeenCalled();
  });
});
