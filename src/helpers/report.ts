import { NostrEvent } from "applesauce-core/helpers";

import { SERVER_REPORT_KIND } from "../const";
import { safeNormalizeServerUrl } from "./server";

export const REPORT_SCHEMA = "blossom-server-report/1";
export const REPORT_MAX_BYTES = 32_768;
export const CLAIM_MAX_AGE = 90 * 86400;
export const OBSERVATION_MAX_AGE = 86400;
export const PROBE_SUITE = "browser-head/2";
export const LEGACY_PROBE_SUITE = "browser-head/1";
export const HTTP_METHODS = ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const CAPABILITIES = {
  upload: "Blob uploads",
  mirror: "Mirroring",
  media: "Media optimization",
  "upload-auth": "Upload authorization required",
  "upload-payment": "Upload payment required",
  "restricted-uploads": "Restricted uploads",
} as const;
export type Capability = keyof typeof CAPABILITIES;
export type Claim = { capability: Capability; value: boolean; assertedAt: number };
export type ProbeEndpoint = "root" | "upload" | "media" | "mirror";
export type ProbeOutcome =
  | "responded"
  | "accepted"
  | "auth-required"
  | "payment-required"
  | "policy-denied"
  | "size-rejected"
  | "type-rejected"
  | "rate-limited"
  | "unavailable"
  | "inconclusive"
  | "browser-unreachable";
export type Observation = {
  endpoint: ProbeEndpoint;
  checkedAt: number;
  duration: number;
  status?: number;
  failure?: "timeout" | "network-or-cors";
  // A public, fixed fixture profile. No payload is uploaded.
  fixture?: "png-68";
  payments: ("cashu" | "lightning")[];
  /** Only endpoint-specific, browser-readable Allow values; never generic CORS permissions. */
  allow?: HttpMethod[];
};
export type ServerReportData = {
  schema: typeof REPORT_SCHEMA;
  name: string;
  description: string;
  claims: Claim[];
  observations: Observation[];
  probeSuite: typeof PROBE_SUITE | typeof LEGACY_PROBE_SUITE;
};
export type ReportAssertion = { capability: string; value: boolean; at: number; basis: "manual" | "observed" };

export function emptyReport(): ServerReportData {
  return { schema: REPORT_SCHEMA, name: "", description: "", claims: [], observations: [], probeSuite: PROBE_SUITE };
}

/** Strict identity for new reports and probes; legacy URL interpretation stays unchanged. */
export function reportServerUrl(input: string): string | null {
  const normalized = safeNormalizeServerUrl(input);
  if (!normalized) return null;
  const url = new URL(normalized);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !host.includes(".") ||
    host.includes(":") ||
    /^\d+(\.\d+)*$/.test(host) ||
    /\.(localhost|local|internal|lan|home|test|invalid|example)$/.test(host) ||
    host.endsWith(".home.arpa") ||
    host === "localhost" ||
    host.endsWith(".localhost")
  )
    return null;
  url.hostname = host;
  return url.toString();
}

export function probeOutcome(observation: Observation): ProbeOutcome {
  if (observation.failure) return "browser-unreachable";
  if (observation.endpoint === "root" || observation.endpoint === "mirror") return "responded";
  switch (observation.status) {
    case 200:
      return "accepted";
    case 401:
      return "auth-required";
    case 402:
      return "payment-required";
    case 403:
      return "policy-denied";
    case 413:
      return "size-rejected";
    case 415:
      return "type-rejected";
    case 429:
      return "rate-limited";
    case 503:
      return "unavailable";
    default:
      return "inconclusive";
  }
}

/** Observations deliberately do not assert actual upload/processing support or BUD compliance. */
export function reportAssertions(data: ServerReportData): ReportAssertion[] {
  const assertions: ReportAssertion[] = data.claims.map((claim) => ({
    capability: claim.capability,
    value: claim.value,
    at: claim.assertedAt,
    basis: "manual",
  }));
  for (const observation of data.observations) {
    if (observation.endpoint === "root") continue;
    const outcome = probeOutcome(observation);
    const suffix =
      outcome === "accepted"
        ? "preflight-accepted"
        : outcome === "auth-required"
          ? "auth-challenge"
          : outcome === "payment-required"
            ? "payment-challenge"
            : null;
    if (suffix)
      assertions.push({
        capability: `${observation.endpoint}-${suffix}`,
        value: true,
        at: observation.checkedAt,
        basis: "observed",
      });
    if (observation.allow?.includes("PUT"))
      assertions.push({
        capability: `${observation.endpoint}-put-advertised`,
        value: true,
        at: observation.checkedAt,
        basis: "observed",
      });
  }
  return assertions;
}

/** Human-facing hints stay separate from editable manual claims and verification. */
export function detectedCapability(capability: Capability, observations: Observation[]): string | undefined {
  const endpoint = capability === "mirror" ? "mirror" : capability === "media" ? "media" : "upload";
  const observation = observations.find((item) => item.endpoint === endpoint);
  if (!observation) return undefined;
  if (observation.failure) return "Could not read server details";
  if (capability === "restricted-uploads") return "Access restrictions need your confirmation";
  if (capability === "upload-payment")
    return observation.status === 402
      ? `Payment requested${observation.payments.length ? ` · ${observation.payments.join(", ")}` : ""}`
      : "Payment policy not determined";
  if (capability === "upload-auth")
    return observation.status === 401 ? "Authorization requested" : "Authorization policy not determined";
  if (observation.allow?.includes("PUT")) return "Advertised by this endpoint · not write-tested";
  if (endpoint !== "mirror" && observation.status === 200) return "Test metadata accepted · not write-tested";
  if (endpoint !== "mirror" && observation.status === 401) return "Endpoint requests authorization";
  if (endpoint !== "mirror" && observation.status === 402) return "Endpoint requests payment";
  return "Not determined from server response";
}

export function assertionFresh(assertion: ReportAssertion, now = Math.floor(Date.now() / 1000)) {
  return (
    assertion.at <= now + 300 &&
    now - assertion.at <= (assertion.basis === "observed" ? OBSERVATION_MAX_AGE : CLAIM_MAX_AGE)
  );
}

export function reportTags(url: string, data: ServerReportData): string[][] {
  return [
    ["d", url],
    ["schema", REPORT_SCHEMA],
    ...reportAssertions(data).map((assertion) => ["c", `${assertion.value ? "" : "!"}${assertion.capability}`]),
  ];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function timestamp(value: unknown, publishedAt: number): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= publishedAt + 300;
}

/** Bounded, fail-closed decoding. Unknown schemas and inconsistent index tags are not reports. */
export function parseReport(
  event: Pick<NostrEvent, "kind" | "tags" | "content" | "created_at">,
): ServerReportData | null {
  try {
    if (
      event.kind !== SERVER_REPORT_KIND ||
      event.content.length > REPORT_MAX_BYTES ||
      new TextEncoder().encode(event.content).length > REPORT_MAX_BYTES ||
      !Number.isSafeInteger(event.created_at) ||
      event.created_at <= 0 ||
      event.created_at > Math.floor(Date.now() / 1000) + 300 ||
      event.tags.length > 64 ||
      event.tags.some((tag) => tag.length > 4 || tag.some((value) => typeof value !== "string" || value.length > 2048))
    )
      return null;
    const d = event.tags.filter((tag) => tag[0] === "d");
    if (d.length !== 1 || d[0].length !== 2 || reportServerUrl(d[0][1]) !== d[0][1]) return null;
    const schemas = event.tags.filter((tag) => tag[0] === "schema");
    if (schemas.length !== 1 || schemas[0].length !== 2 || schemas[0][1] !== REPORT_SCHEMA) return null;
    const data: unknown = JSON.parse(event.content);
    if (
      !record(data) ||
      !keys(data, ["schema", "name", "description", "claims", "observations", "probeSuite"]) ||
      data.schema !== REPORT_SCHEMA ||
      ![PROBE_SUITE, LEGACY_PROBE_SUITE].includes(data.probeSuite as typeof PROBE_SUITE) ||
      typeof data.name !== "string" ||
      data.name.length > 120 ||
      typeof data.description !== "string" ||
      data.description.length > 4000 ||
      !Array.isArray(data.claims) ||
      data.claims.length > Object.keys(CAPABILITIES).length ||
      !Array.isArray(data.observations) ||
      data.observations.length > (data.probeSuite === LEGACY_PROBE_SUITE ? 3 : 4)
    )
      return null;
    const seenClaims = new Set();
    for (const claim of data.claims) {
      if (
        !record(claim) ||
        !keys(claim, ["capability", "value", "assertedAt"]) ||
        typeof claim.capability !== "string" ||
        !Object.prototype.hasOwnProperty.call(CAPABILITIES, claim.capability) ||
        typeof claim.value !== "boolean" ||
        !timestamp(claim.assertedAt, event.created_at) ||
        seenClaims.has(claim.capability)
      )
        return null;
      seenClaims.add(claim.capability);
    }
    const seenEndpoints = new Set();
    for (const observation of data.observations) {
      if (
        !record(observation) ||
        !keys(observation, [
          "endpoint",
          "checkedAt",
          "duration",
          "status",
          "failure",
          "fixture",
          "payments",
          "allow",
        ]) ||
        !(
          data.probeSuite === LEGACY_PROBE_SUITE ? ["root", "upload", "media"] : ["root", "upload", "media", "mirror"]
        ).includes(observation.endpoint as string) ||
        seenEndpoints.has(observation.endpoint) ||
        !timestamp(observation.checkedAt, event.created_at) ||
        typeof observation.duration !== "number" ||
        !Number.isFinite(observation.duration) ||
        observation.duration < 0 ||
        observation.duration > 120_000 ||
        !Array.isArray(observation.payments) ||
        observation.payments.length > 2 ||
        new Set(observation.payments).size !== observation.payments.length ||
        !observation.payments.every((payment) => ["cashu", "lightning"].includes(payment)) ||
        (["root", "mirror"].includes(observation.endpoint as string)
          ? observation.fixture !== undefined
          : observation.fixture !== "png-68")
      )
        return null;
      if (
        observation.allow !== undefined &&
        (data.probeSuite === LEGACY_PROBE_SUITE ||
          !Array.isArray(observation.allow) ||
          observation.allow.length === 0 ||
          observation.allow.length > HTTP_METHODS.length ||
          new Set(observation.allow).size !== observation.allow.length ||
          !observation.allow.every((method) => HTTP_METHODS.includes(method)) ||
          observation.failure !== undefined)
      )
        return null;
      if (observation.failure !== undefined) {
        if (
          !["timeout", "network-or-cors"].includes(observation.failure as string) ||
          observation.status !== undefined ||
          observation.payments.length
        )
          return null;
      } else if (
        !Number.isInteger(observation.status) ||
        (observation.status as number) < 100 ||
        (observation.status as number) > 599 ||
        (observation.status !== 402 && observation.payments.length)
      )
        return null;
      seenEndpoints.add(observation.endpoint);
    }
    const report = data as unknown as ServerReportData;
    const expected = reportTags(d[0][1], report)
      .filter((tag) => tag[0] === "c")
      .map((tag) => tag[1])
      .sort();
    const indexed = event.tags.filter((tag) => tag[0] === "c");
    if (
      indexed.some((tag) => tag.length !== 2) ||
      JSON.stringify(indexed.map((tag) => tag[1]).sort()) !== JSON.stringify(expected)
    )
      return null;
    return report;
  } catch {
    return null;
  }
}
