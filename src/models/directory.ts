import { castTimelineStream } from "applesauce-common/observable";
import { getBlossomServersFromList } from "applesauce-common/helpers";
import { NostrEvent } from "applesauce-core/helpers";
import { combineLatest, map, Observable, ReplaySubject, share, throttleTime, timer } from "rxjs";

import { ServerAnnouncement } from "../casts/server";
import { ServerReview } from "../casts/review";
import { ServerReport } from "../casts/report";
import { SERVER_ADVERTIZEMENT_KIND, SERVER_REPORT_KIND, SERVER_REVIEW_KIND } from "../const";
import { assertionFresh, ReportAssertion } from "../helpers/report";
import { getServerHost, safeNormalizeServerUrl } from "../helpers/server";
import { eventStore } from "../services/nostr";
import { socialLists$ } from "../services/social";

/** Everything the directory knows about a single server URL */
export type ServerSummary = {
  url: string;
  host: string;
  /** Every announcement for this URL, newest first */
  announcements: ServerAnnouncement[];
  /** The newest announcement */
  announcement?: ServerAnnouncement;
  reports: ServerReport[];
  contributors: Set<string>;
  reviews: ServerReview[];
  /** Average rating between 0 and 1, or null with no rated reviews */
  rating: number | null;
  /** Direct follows that list this server; empty when signed out */
  users: Set<string>;
  /** Number of users that have this server as their default (first) server */
  defaults: number;
  /** The most recent activity timestamp */
  updated: number;
};

/** Throttle a busy timeline so large syncs don't recompute the directory on every event */
function throttledTimeline(kind: number) {
  return eventStore.timeline({ kinds: [kind] }).pipe(throttleTime(500, undefined, { leading: true, trailing: true }));
}

export function buildDirectory(
  announcements: ServerAnnouncement[],
  reviews: ServerReview[],
  lists: NostrEvent[],
  reports: ServerReport[] = [],
): ServerSummary[] {
  const servers = new Map<string, ServerSummary>();
  const get = (url: string) => {
    let server = servers.get(url);
    if (!server) {
      server = {
        url,
        host: getServerHost(url),
        announcements: [],
        reports: [],
        contributors: new Set(),
        reviews: [],
        rating: null,
        users: new Set(),
        defaults: 0,
        updated: 0,
      };
      servers.set(url, server);
    }
    return server;
  };

  // Timelines are already sorted newest first
  for (const announcement of announcements) {
    const server = get(announcement.url);
    server.announcements.push(announcement);
    server.announcement ??= announcement;
    server.updated = Math.max(server.updated, announcement.event.created_at);
  }

  // Defend against aliases/multiple versions in upstream caches; latest per author, deterministic ties.
  const current = [...reports].sort(
    (a, b) => b.event.created_at - a.event.created_at || a.event.id.localeCompare(b.event.id),
  );
  for (const report of current) {
    const server = get(report.url);
    if (server.contributors.has(report.event.pubkey)) continue;
    server.reports.push(report);
    server.contributors.add(report.event.pubkey);
    server.updated = Math.max(server.updated, report.event.created_at);
  }

  for (const review of reviews) {
    const server = get(review.server);
    server.reviews.push(review);
    server.updated = Math.max(server.updated, review.event.created_at);
  }

  for (const list of lists) {
    const urls = getBlossomServersFromList(list);
    urls.forEach((value, index) => {
      const url = safeNormalizeServerUrl(value);
      if (!url) return;
      const server = get(url);
      server.users.add(list.pubkey);
      if (index === 0) server.defaults++;
    });
  }

  for (const server of servers.values()) {
    const rated = server.reviews.map((r) => r.rating).filter((r) => r !== null);
    server.rating = rated.length > 0 ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
  }

  return Array.from(servers.values());
}

/** Every known server URL with its announcements, reviews and users, kept up to date with the store */
export const directory$: Observable<ServerSummary[]> = combineLatest([
  throttledTimeline(SERVER_ADVERTIZEMENT_KIND).pipe(castTimelineStream(ServerAnnouncement, eventStore)),
  throttledTimeline(SERVER_REVIEW_KIND).pipe(castTimelineStream(ServerReview, eventStore)),
  socialLists$,
  throttledTimeline(SERVER_REPORT_KIND).pipe(
    map((events) =>
      events.flatMap((event) => {
        try {
          return [new ServerReport(event, eventStore)];
        } catch {
          return [];
        }
      }),
    ),
  ),
  // Freshness changes without a new event. Recompute eligibility at least once per minute.
  timer(0, 60_000),
]).pipe(
  map(([announcements, reviews, lists, reports]) => buildDirectory(announcements, reviews, lists, reports)),
  // Keep the directory around for a minute after the last view unsubscribes
  share({ connector: () => new ReplaySubject(1), resetOnRefCountZero: () => timer(60_000) }),
);

/** The summary for a single server URL */
export function serverSummary$(url: string): Observable<ServerSummary | undefined> {
  return directory$.pipe(map((servers) => servers.find((server) => server.url === url)));
}

/** A popularity score that weighs reviews more than list entries */
export function popularity(server: ServerSummary) {
  return server.users.size + server.reviews.length * 5 + (server.reports.length || server.announcement ? 2 : 0);
}

export function capabilityEvidence(server: ServerSummary, capability: string, now?: number) {
  const evidence = server.reports.flatMap((report) =>
    report.assertions
      .filter((assertion) => assertion.capability === capability)
      .map((assertion) => ({ ...assertion, pubkey: report.event.pubkey, fresh: assertionFresh(assertion, now) })),
  );
  const fresh = evidence.filter((assertion) => assertion.fresh);
  const positive = fresh.filter((assertion) => assertion.value).length;
  const negative = fresh.filter((assertion) => !assertion.value).length;
  return {
    evidence,
    positive,
    negative,
    state:
      positive && negative
        ? "conflicting"
        : positive
          ? "reported"
          : negative
            ? "reported-absent"
            : evidence.length
              ? "stale"
              : "unknown",
  } as const;
}

/** AND is within a single current report, never a join across authors. */
export function matchesCapabilities(server: ServerSummary, capabilities: string[], now?: number) {
  return (
    capabilities.length === 0 ||
    server.reports.some((report) =>
      capabilities.every((capability) =>
        report.assertions.some(
          (assertion: ReportAssertion) =>
            assertion.capability === capability && assertion.value && assertionFresh(assertion, now),
        ),
      ),
    )
  );
}
