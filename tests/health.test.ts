import { firstValueFrom, lastValueFrom } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { directoryHealth$, serverHealth$ } from "../src/services/health";

describe("browser health checks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shares checks and reuses cached results", async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal("fetch", fetch);
    const url = "https://cached.example/";
    const [a, b] = await Promise.all([lastValueFrom(serverHealth$(url)), lastValueFrom(serverHealth$(url))]);
    expect(a.state).toBe("online");
    expect(b).toEqual(a);
    expect((await firstValueFrom(serverHealth$(url))).state).toBe("online");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("classifies CORS/network failures as offline and any HTTP response as reachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ status: 403 }),
    );
    expect((await lastValueFrom(serverHealth$("https://offline.example/"))).state).toBe("offline");
    expect((await lastValueFrom(serverHealth$("https://restricted.example/"))).state).toBe("online");
  });

  it("checks offscreen results with at most six simultaneous requests", async () => {
    let active = 0;
    let maximum = 0;
    const fetch = vi.fn(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return { status: 200 };
    });
    vi.stubGlobal("fetch", fetch);
    const urls = Array.from({ length: 18 }, (_, i) => `https://batch-${i}.example/`);
    const result = lastValueFrom(directoryHealth$(urls));
    // Also check a visible card while the filter is busy; both share the same bound.
    const card = lastValueFrom(serverHealth$("https://visible.example/"));
    await vi.runAllTimersAsync();
    const health = await result;
    await card;
    expect(health.size).toBe(18);
    expect([...health.values()].every((entry) => entry.state === "online")).toBe(true);
    expect(maximum).toBeLessThanOrEqual(6);
    expect(fetch).toHaveBeenCalledTimes(19);
  });
});
