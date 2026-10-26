import { defer, filter, from, map, mergeMap, Observable, of, scan, shareReplay, startWith, throttleTime } from "rxjs";

export type ServerHealth =
  | { state: "checking" }
  | { state: "online"; latency: number; status: number; checkedAt: number }
  | { state: "offline"; error: string; checkedAt: number };

const STORAGE_PREFIX = "server-health:";
// How long a check result is reused for
const MAX_AGE = 10 * 60_000;
const TIMEOUT = 8_000;

// Shared by visible cards and directory filters, so neither can flood the browser.
let activeChecks = 0;
const waiting: Array<() => void> = [];
async function boundedCheck(url: string) {
  if (activeChecks >= 6) await new Promise<void>((resolve) => waiting.push(resolve));
  else activeChecks++;
  try {
    return await checkServer(url);
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeChecks--;
  }
}

function readCache(url: string): ServerHealth | undefined {
  try {
    const stored = sessionStorage.getItem(STORAGE_PREFIX + url);
    if (!stored) return undefined;
    const health = JSON.parse(stored) as ServerHealth;
    if (health.state !== "checking" && Date.now() - health.checkedAt < MAX_AGE) return health;
  } catch {}
  return undefined;
}

function writeCache(url: string, health: ServerHealth) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + url, JSON.stringify(health));
  } catch {}
}

/**
 * Checks that a server responds to a CORS request from the browser. Blossom servers must send CORS headers
 * on every response, so any HTTP response counts as online and network or CORS failures count as offline
 */
async function checkServer(url: string): Promise<ServerHealth> {
  const start = performance.now();
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    const latency = Math.round(performance.now() - start);
    // Don't download the whole page
    response.body?.cancel().catch(() => {});
    return { state: "online", latency, status: response.status, checkedAt: Date.now() };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "Timed out"
        : "Unreachable from the browser (offline or missing CORS headers)";
    return { state: "offline", error: message, checkedAt: Date.now() };
  }
}

const checks = new Map<string, Observable<ServerHealth>>();

/** Returns a shared observable of a server's health, checking it at most once every ten minutes */
export function serverHealth$(url: string): Observable<ServerHealth> {
  const cached = readCache(url);
  if (cached) return of(cached);

  let check = checks.get(url);
  if (!check) {
    check = defer(async () => {
      const health = await boundedCheck(url);
      writeCache(url, health);
      // Allow a fresh check after the cache expires
      setTimeout(() => checks.delete(url), MAX_AGE);
      return health;
    }).pipe(startWith<ServerHealth>({ state: "checking" }), shareReplay(1));
    checks.set(url, check);
  }
  return check;
}

/** Progressively check the filtered directory, including cards not yet rendered. */
export function directoryHealth$(urls: string[]): Observable<Map<string, ServerHealth>> {
  return from(urls).pipe(
    mergeMap(
      (url) =>
        serverHealth$(url).pipe(
          filter((health) => health.state !== "checking"),
          map((health) => ({ url, health })),
        ),
      6,
    ),
    scan((health, result) => new Map(health).set(result.url, result.health), new Map<string, ServerHealth>()),
    throttleTime(100, undefined, { leading: true, trailing: true }),
    startWith(new Map<string, ServerHealth>()),
  );
}
