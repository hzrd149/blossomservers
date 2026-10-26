import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import { probeServer, PROBE_FIXTURE } from "../src/services/probe";
import { emptyReport, parseReport, reportTags } from "../src/helpers/report";
import { SERVER_REPORT_KIND } from "../src/const";

const url = "https://cdn.example.com/";
describe("non-writing browser probe suite", () => {
  it("uses the documented fixture size and hash", () => {
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
      "base64",
    );
    expect(bytes.length).toBe(PROBE_FIXTURE.size);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(PROBE_FIXTURE.sha256);
  });
  it("uses only four sequential anonymous GET/HEAD/OPTIONS requests with bounded metadata", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ status: 200, headers: new Headers(), body: { cancel } });
    const observations = await probeServer(url, { fetch: request });
    expect(request.mock.calls.map(([target, init]) => [String(target), init.method])).toEqual([
      [url, "GET"],
      [`${url}upload`, "HEAD"],
      [`${url}media`, "HEAD"],
      [`${url}mirror`, "OPTIONS"],
    ]);
    for (const [, init] of request.mock.calls) {
      expect(init.credentials).toBe("omit");
      expect(init.redirect).toBe("error");
      expect(init.referrerPolicy).toBe("no-referrer");
      expect(init.body).toBeUndefined();
      expect(init.headers?.Authorization).toBeUndefined();
    }
    expect(request.mock.calls[1][1].headers).toEqual({
      "X-SHA-256": PROBE_FIXTURE.sha256,
      "X-Content-Type": "image/png",
      "X-Content-Length": "68",
    });
    expect(cancel).toHaveBeenCalledTimes(4);
    expect(observations).toHaveLength(4);
    const data = { ...emptyReport(), observations };
    expect(
      parseReport({
        kind: SERVER_REPORT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: reportTags(url, data),
        content: JSON.stringify(data),
      }),
    ).toEqual(data);
  });

  it("retains payment method indicators but never invoice/header values", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 402,
        headers: {
          "X-Lightning": "secret-invoice",
          "X-Cashu": "secret-request",
          "X-Reason": "arbitrary server text",
        },
      }),
    );
    const observations = await probeServer(url, { fetch: request });
    expect(observations[1].payments).toEqual(["cashu", "lightning"]);
    expect(JSON.stringify(observations)).not.toMatch(/secret|arbitrary/);
  });

  it("treats unreadable payment headers as unknown, not proof no payment methods exist", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 402 }));
    const observations = await probeServer(url, { fetch: request });
    expect(observations[1]).toMatchObject({ status: 402, payments: [] });
  });

  it("does not claim global offline status after browser/network failure", async () => {
    const request = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const observations = await probeServer(url, { fetch: request });
    expect(
      observations.every(
        (observation) => observation.failure === "network-or-cors" && observation.status === undefined,
      ),
    ).toBe(true);
  });

  it("cancels without retaining partial results or sending subsequent checks", async () => {
    const controller = new AbortController();
    const request = vi.fn(async () => {
      controller.abort();
      throw new Error("aborted");
    });
    await expect(probeServer(url, { fetch: request, signal: controller.signal })).rejects.toThrow();
    expect(request).toHaveBeenCalledOnce();
  });

  it("rejects local targets before issuing a request", async () => {
    const request = vi.fn();
    await expect(probeServer("https://127.0.0.1/", { fetch: request })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it("bounds each request and records timeouts without turning them into negative capabilities", async () => {
    const request = vi.fn(
      (_target, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
        }),
    );
    const observations = await probeServer(url, { fetch: request as typeof fetch, timeout: 10 });
    expect(observations).toHaveLength(4);
    expect(observations.every((observation) => observation.failure === "timeout")).toBe(true);
  });

  it("reads a bounded endpoint Allow advertisement, not generic CORS permissions", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: {
          Allow: "PUT, OPTIONS, PUT, SOMETHING-ELSE",
          "Access-Control-Allow-Methods": "DELETE, GET",
        },
      }),
    );
    const observations = await probeServer(url, { fetch: request });
    expect(observations[3].allow).toEqual(["PUT", "OPTIONS"]);
    const generic = await probeServer(url, {
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "GET, HEAD, PUT, DELETE" } }),
        ),
    });
    expect(generic[3].allow).toBeUndefined();
  });
});
