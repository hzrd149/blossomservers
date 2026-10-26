import { EventStore } from "applesauce-core";
import { matchFilter, NostrEvent } from "applesauce-core/helpers";
import { describe, expect, it } from "vitest";

import { ServerReport } from "../src/casts/report";
import { SERVER_REPORT_KIND } from "../src/const";
import { ServerReportFactory } from "../src/factories";
import {
  assertionFresh,
  detectedCapability,
  emptyReport,
  LEGACY_PROBE_SUITE,
  parseReport,
  probeOutcome,
  reportAssertions,
  reportServerUrl,
  reportTags,
} from "../src/helpers/report";
import { getServerPath, safeNormalizeServerUrl } from "../src/helpers/server";

const now = Math.floor(Date.now() / 1000);
const url = "https://cdn.example.com/";
function event(data = emptyReport()): NostrEvent {
  return {
    kind: SERVER_REPORT_KIND,
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    sig: "0".repeat(128),
    created_at: now,
    content: JSON.stringify(data),
    tags: reportTags(url, data),
  };
}

describe("server report protocol", () => {
  it("keeps legacy probe reports readable", () => {
    const data = emptyReport();
    data.probeSuite = LEGACY_PROBE_SUITE;
    data.observations = [
      { endpoint: "upload", checkedAt: now, duration: 1, fixture: "png-68", status: 200, payments: [] },
    ];
    expect(parseReport(event(data))).toEqual(data);
  });

  it("records method advertisements without upgrading them to verified capabilities", () => {
    const data = emptyReport();
    data.observations = [
      { endpoint: "mirror", checkedAt: now, duration: 1, status: 204, payments: [], allow: ["PUT", "OPTIONS"] },
    ];
    expect(parseReport(event(data))).toEqual(data);
    expect(reportTags(url, data)).toContainEqual(["c", "mirror-put-advertised"]);
    expect(reportTags(url, data)).not.toContainEqual(["c", "mirror"]);
    expect(detectedCapability("mirror", data.observations)).toContain("Advertised");
    expect(data.claims).toEqual([]);
    data.probeSuite = LEGACY_PROBE_SUITE;
    expect(parseReport(event(data))).toBeNull();
  });

  it("keeps payment/auth detections separate from general policies", () => {
    const observations = [
      { endpoint: "upload" as const, checkedAt: now, duration: 1, status: 402, payments: ["cashu" as const] },
    ];
    expect(detectedCapability("upload-payment", observations)).toBe("Payment requested · cashu");
    expect(detectedCapability("upload-auth", observations)).toBe("Authorization policy not determined");
    expect(detectedCapability("restricted-uploads", observations)).toBe("Access restrictions need your confirmation");
  });

  it("does not accept arbitrary method values or method metadata on failed probes", () => {
    const observation = { endpoint: "mirror", checkedAt: now, duration: 1, status: 204, payments: [] };
    for (const entry of [
      { ...observation, allow: ["PUT", "PUT"] },
      { ...observation, allow: ["anything"] },
      { ...observation, status: undefined, failure: "timeout", allow: ["PUT"] },
    ]) {
      expect(
        parseReport({ ...event(), content: JSON.stringify({ ...emptyReport(), observations: [entry] }) }),
      ).toBeNull();
    }
  });

  it("round trips manual assertions and bounded observations", () => {
    const data = emptyReport();
    data.name = "Community name";
    data.claims = [{ capability: "mirror", value: false, assertedAt: now - 100 }];
    data.observations = [
      { endpoint: "upload", checkedAt: now - 10, fixture: "png-68", duration: 30, status: 200, payments: [] },
    ];
    const report = event(data);
    expect(parseReport(report)).toEqual(data);
    expect(report.tags).toContainEqual(["c", "!mirror"]);
    expect(report.tags).toContainEqual(["c", "upload-preflight-accepted"]);
    expect(report.tags).not.toContainEqual(["c", "upload"]);
  });

  it("unknown is distinct from explicit false", () => {
    expect(reportAssertions(emptyReport())).toEqual([]);
    const data = emptyReport();
    data.claims = [{ capability: "upload-payment", value: false, assertedAt: now }];
    expect(reportTags(url, data)).toContainEqual(["c", "!upload-payment"]);
  });

  it("supports Applesauce AND matching within the same event", () => {
    const data = emptyReport();
    data.claims = ["upload", "mirror"].map((capability) => ({
      capability: capability as "upload" | "mirror",
      value: true,
      assertedAt: now,
    }));
    expect(matchFilter({ kinds: [SERVER_REPORT_KIND], "&c": ["upload", "mirror"] }, event(data))).toBe(true);
    expect(matchFilter({ "&c": ["upload", "media"] }, event(data))).toBe(false);
  });

  it("rejects mismatched, duplicate or contradictory index tags", () => {
    for (const tag of [
      ["c", "upload"],
      ["c", "!upload"],
      ["schema", "other"],
      ["d", url],
    ]) {
      const report = event();
      report.tags.push(tag);
      expect(parseReport(report)).toBeNull();
    }
  });

  it("rejects malformed/unknown/oversized content without throwing", () => {
    for (const content of [
      "not json",
      "null",
      JSON.stringify({ ...emptyReport(), schema: "blossom-server-report/2" }),
      JSON.stringify({ ...emptyReport(), token: "secret" }),
      "x".repeat(40_000),
    ]) {
      expect(parseReport({ ...event(), content })).toBeNull();
    }
  });

  it("rejects unknown predicates, duplicates and future assertions", () => {
    for (const claims of [
      [{ capability: "made-up", value: true, assertedAt: now }],
      [{ capability: "upload", value: true, assertedAt: now + 1000 }],
      [
        { capability: "upload", value: true, assertedAt: now },
        { capability: "upload", value: false, assertedAt: now },
      ],
    ])
      expect(parseReport({ ...event(), content: JSON.stringify({ ...emptyReport(), claims }) })).toBeNull();
  });

  it("rejects secret fields and inconsistent observations", () => {
    const observation = {
      endpoint: "upload",
      checkedAt: now,
      fixture: "png-68",
      duration: 1,
      payments: [],
      status: 200,
    };
    for (const entry of [
      { ...observation, authorization: "secret" },
      { ...observation, duration: -1 },
      { ...observation, payments: ["cashu"] },
      { ...observation, failure: "timeout" },
      { ...observation, status: undefined },
      { ...observation, fixture: "unknown" },
    ])
      expect(
        parseReport({ ...event(), content: JSON.stringify({ ...emptyReport(), observations: [entry] }) }),
      ).toBeNull();
  });

  it("preserves observation age on prose-only edits", () => {
    const data = emptyReport();
    data.observations = [
      { endpoint: "upload", checkedAt: now - 90_000, fixture: "png-68", duration: 1, status: 200, payments: [] },
    ];
    data.description = "Updated prose";
    const parsed = parseReport(event(data))!;
    const assertion = reportAssertions(parsed)[0];
    expect(assertion.at).toBe(now - 90_000);
    expect(assertionFresh(assertion, now)).toBe(false);
  });

  it("validates factory input before any signing", () => {
    expect(() => ServerReportFactory.create(url, emptyReport())).not.toThrow();
    expect(() => ServerReportFactory.create("http://cdn.example.com", emptyReport())).toThrow();
    expect(() => ServerReportFactory.create(url, { ...emptyReport(), name: "x".repeat(121) })).toThrow();
  });

  it("casts only recognized reports", () => {
    const store = new EventStore({ verifyEvent: () => true });
    expect(new ServerReport(event(), store).url).toBe(url);
    expect(() => new ServerReport({ ...event(), content: "bad" }, store)).toThrow();
    store.dispose();
  });
});

describe("report URL identity", () => {
  it("canonicalizes roots, casing and default ports", () => {
    expect(reportServerUrl("https://CDN.example.com:443/path?a=b#x")).toBe(url);
    expect(reportServerUrl("https://cdn.example.com./")).toBe(url);
    expect(reportServerUrl("cdn.example.com")).toBe(url);
  });
  it.each([
    "http://cdn.example.com",
    "ftp://cdn.example.com",
    "https://localhost",
    "https://localhost./",
    "https://127.0.0.1",
    "https://2130706433",
    "https://[::1]",
    "https://foo.local",
    "https://foo.home.arpa",
    "https://user:pass@cdn.example.com",
    "https://intranet",
    "https://foo.internal",
  ])("rejects unsafe probe/report target %s", (input) => {
    expect(reportServerUrl(input)).toBeNull();
  });
  it("keeps legacy HTTP routes from becoming a different HTTPS server", () => {
    const input = "http://cdn.example.com/";
    expect(safeNormalizeServerUrl(decodeURIComponent(getServerPath(input).slice("/server/".length)))).toBe(input);
    expect(getServerPath(url)).toBe("/server/cdn.example.com");
  });
});

describe("probe interpretations", () => {
  it.each([
    [200, "accepted"],
    [401, "auth-required"],
    [402, "payment-required"],
    [403, "policy-denied"],
    [413, "size-rejected"],
    [415, "type-rejected"],
    [429, "rate-limited"],
    [503, "unavailable"],
    [404, "inconclusive"],
    [405, "inconclusive"],
  ] as const)("classifies %s without overclaiming", (status, expected) => {
    expect(probeOutcome({ endpoint: "upload", checkedAt: now, duration: 1, status, payments: [] })).toBe(expected);
  });
  it("never infers negative capability support from an unavailable optional HEAD endpoint", () => {
    const data = emptyReport();
    data.observations = [
      { endpoint: "upload", checkedAt: now, fixture: "png-68", duration: 1, status: 404, payments: [] },
    ];
    expect(reportAssertions(data)).toEqual([]);
  });
});
