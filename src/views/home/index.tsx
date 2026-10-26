import { use$ } from "applesauce-react/hooks";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { ServerCard } from "@/components/server-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { directory$, matchesCapabilities, popularity, ServerSummary } from "@/models/directory";
import { directorySync$ } from "@/services/sync";
import { directoryHealth$ } from "@/services/health";
import { useActivePubkey } from "@/hooks/use-active-account";

const PAGE_SIZE = 48;

const SORTS = {
  popular: { label: "Most popular", compare: (a: ServerSummary, b: ServerSummary) => popularity(b) - popularity(a) },
  users: { label: "Most followed users", compare: (a: ServerSummary, b: ServerSummary) => b.users.size - a.users.size },
  rating: {
    label: "Highest rated",
    compare: (a: ServerSummary, b: ServerSummary) =>
      (b.rating ?? -1) - (a.rating ?? -1) || b.reviews.length - a.reviews.length,
  },
  reviews: {
    label: "Most reviews",
    compare: (a: ServerSummary, b: ServerSummary) => b.reviews.length - a.reviews.length,
  },
  recent: { label: "Recently active", compare: (a: ServerSummary, b: ServerSummary) => b.updated - a.updated },
  name: {
    label: "Domain",
    compare: (a: ServerSummary, b: ServerSummary) => a.host.localeCompare(b.host),
  },
} as const;
type SortKey = keyof typeof SORTS;

const FILTERS = {
  reported: { label: "Has reports", match: (s: ServerSummary) => s.reports.length > 0 },
  upload: { label: "Uploads · reported", match: () => true },
  mirror: { label: "Mirroring · reported", match: () => true },
  media: { label: "Media optimization · reported", match: () => true },
  "upload-preflight-accepted": { label: "Upload preflight accepted", match: () => true },
  reviewed: { label: "Reviewed", match: (s: ServerSummary) => s.reviews.length > 0 },
  all: {
    label: "Include rarely used",
    // Handled separately, hides servers nobody announced, reviewed or shares with others
    match: () => true,
  },
} as const;
type FilterKey = keyof typeof FILTERS;

/** Servers nobody has announced, reviewed or uses alongside others are usually personal */
const isNotable = (s: ServerSummary) => s.updated > 0 || s.users.size >= 2;
const CAPABILITY_FILTERS = new Set(["upload", "mirror", "media", "upload-preflight-accepted"]);

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value?.toLocaleString() ?? "—"}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function HomeView() {
  const pubkey = useActivePubkey();
  const servers = use$(directory$);
  const sync = use$(directorySync$);
  const [params, setParams] = useSearchParams();
  const [limit, setLimit] = useState(PAGE_SIZE);

  const query = params.get("q") ?? "";
  const requestedSort = params.get("sort") as SortKey;
  const sort =
    Object.prototype.hasOwnProperty.call(SORTS, requestedSort) && (requestedSort !== "users" || pubkey)
      ? requestedSort
      : "popular";
  const status = params.get("status") === "online" ? "online" : params.get("status") === "offline" ? "offline" : "all";
  const filters = new Set(
    (params.get("filter")?.split(",") ?? []).filter((f): f is FilterKey =>
      Object.prototype.hasOwnProperty.call(FILTERS, f),
    ),
  );

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setLimit(PAGE_SIZE);
  };
  const toggleFilter = (filter: FilterKey) => {
    const next = new Set(filters);
    if (next.has(filter)) next.delete(filter);
    else next.add(filter);
    update("filter", [...next].join(",") || null);
  };

  const stats = useMemo(() => {
    if (!servers) return undefined;
    const users = new Set<string>();
    let reviews = 0;
    for (const server of servers) {
      for (const user of server.users) users.add(user);
      reviews += server.reviews.length;
    }
    return {
      reported: servers.filter((s) => s.reports.length).length,
      known: servers.length,
      reviews,
      users: users.size,
    };
  }, [servers]);

  const candidates = useMemo(() => {
    if (!servers) return [];
    const search = query.trim().toLowerCase();
    return servers
      .filter((server) => filters.has("all") || isNotable(server))
      .filter((server) => [...filters].every((f) => FILTERS[f].match(server)))
      .filter((server) =>
        matchesCapabilities(
          server,
          [...filters].filter((filter) => CAPABILITY_FILTERS.has(filter)),
        ),
      )
      .filter(
        (server) =>
          !search ||
          server.host.includes(search) ||
          server.reports.some((report) =>
            `${report.data.name} ${report.data.description}`.toLowerCase().includes(search),
          ) ||
          server.announcements.some((announcement) =>
            `${announcement.name} ${announcement.description}`.toLowerCase().includes(search),
          ),
      )
      .sort((a, b) => SORTS[sort].compare(a, b) || a.host.localeCompare(b.host));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers, query, sort, params.get("filter")]);

  const health = use$(
    () => (status === "all" ? undefined : directoryHealth$(candidates.map((s) => s.url))),
    [candidates, status],
  );
  const results =
    status === "all" ? candidates : candidates.filter((server) => health?.get(server.url)?.state === status);
  const pendingChecks = status === "all" ? 0 : candidates.length - (health?.size ?? 0);

  const loading = !sync?.done && results.length === 0;

  return (
    <>
      <PageHeader
        title="Find a Blossom server"
        description="Discover, review and check the status of public Blossom media servers."
      />

      <div className={`mb-6 grid grid-cols-2 gap-3 ${pubkey ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Stat label="Servers with reports" value={stats?.reported} />
        <Stat label="Known servers" value={stats?.known} />
        <Stat label="Reviews" value={stats?.reviews} />
        {pubkey && <Stat label="Followed users with a server list" value={stats?.users} />}
      </div>

      {[...filters].some((filter) => CAPABILITY_FILTERS.has(filter)) && (
        <p className="mb-3 text-xs text-muted-foreground">
          Capability selections must match one current report, not claims joined across contributors. Other reports may
          disagree. Loaded sources only; manual claims expire after 90 days and observations after 24 hours.
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="pl-9"
              placeholder="Search by name, domain or description"
              value={query}
              onChange={(e) => update("q", e.target.value || null)}
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => update("sort", e.target.value === "popular" ? null : e.target.value)}
            aria-label="Sort"
          >
            {Object.entries(SORTS)
              .filter(([key]) => key !== "users" || pubkey)
              .map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </Select>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Select
            value={status}
            onChange={(e) => update("status", e.target.value === "all" ? null : e.target.value)}
            aria-label="Server status"
            title="Reachability from this browser; CORS failures appear offline"
          >
            <option value="all">All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline / unreachable</option>
          </Select>
          {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
            <ToggleChip key={key} active={filters.has(key)} onClick={() => toggleFilter(key)}>
              {FILTERS[key].label}
            </ToggleChip>
          ))}
          <span className="ml-auto self-center whitespace-nowrap text-sm text-muted-foreground">
            {results.length.toLocaleString()} servers
          </span>
        </div>
      </div>

      {pendingChecks > 0 && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Checking status of {pendingChecks} servers… Results appear as checks finish.
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted/50" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {pendingChecks > 0 ? "Checking for matching servers…" : "No servers match your search."}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.slice(0, limit).map((server) => (
              <ServerCard key={server.url} server={server} />
            ))}
          </div>
          {results.length > limit && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Show more ({(results.length - limit).toLocaleString()} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
