import { HTTP_METHODS, HttpMethod, Observation, ProbeEndpoint, reportServerUrl } from "../helpers/report";

export const PROBE_FIXTURE = {
  id: "png-68" as const,
  type: "image/png",
  size: 68,
  sha256: "1f3b40322c29a8108ead1415f2aae739495eaee8b1952323ffcdc1a4258ea186",
};

type ProbeOptions = {
  signal?: AbortSignal;
  fetch?: typeof fetch;
  now?: () => number;
  clock?: () => number;
  timeout?: number;
};

/** Four sequential non-writing checks. Redirects are deliberately not followed. */
export async function probeServer(input: string, options: ProbeOptions = {}): Promise<Observation[]> {
  const url = reportServerUrl(input);
  if (!url) throw new Error("Checks require a public HTTPS server URL");
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const clock = options.clock ?? (() => performance.now());
  const observations: Observation[] = [];
  for (const endpoint of ["root", "upload", "media", "mirror"] as ProbeEndpoint[]) {
    options.signal?.throwIfAborted();
    const start = clock();
    const timeout = AbortSignal.timeout(options.timeout ?? 8000);
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
    const observation: Observation = {
      endpoint,
      checkedAt: Math.floor(now() / 1000),
      duration: 0,
      payments: [],
      ...(["root", "mirror"].includes(endpoint) ? {} : { fixture: PROBE_FIXTURE.id }),
    };
    try {
      const response = await request(new URL(endpoint === "root" ? "/" : `/${endpoint}`, url), {
        method: endpoint === "root" ? "GET" : endpoint === "mirror" ? "OPTIONS" : "HEAD",
        headers:
          endpoint === "root" || endpoint === "mirror"
            ? undefined
            : {
                "X-SHA-256": PROBE_FIXTURE.sha256,
                "X-Content-Type": PROBE_FIXTURE.type,
                "X-Content-Length": String(PROBE_FIXTURE.size),
              },
        signal,
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        redirect: "error",
      });
      observation.status = response.status;
      // Allow describes endpoint methods. Access-Control-Allow-Methods only describes CORS policy.
      const advertised = response.headers.get("Allow");
      if (advertised && advertised.length <= 256) {
        const methods = [...new Set(advertised.split(",").map((method) => method.trim().toUpperCase()))].filter(
          (method): method is HttpMethod => HTTP_METHODS.includes(method as HttpMethod),
        );
        if (methods.length) observation.allow = methods;
      }
      // Only retain method indicators, never invoice/request contents or arbitrary headers.
      if (response.status === 402) {
        if (response.headers.get("X-Cashu")) observation.payments.push("cashu");
        if (response.headers.get("X-Lightning")) observation.payments.push("lightning");
      }
      response.body?.cancel().catch(() => {});
    } catch {
      options.signal?.throwIfAborted();
      observation.failure = timeout.aborted ? "timeout" : "network-or-cors";
    }
    observation.duration = Math.min(120_000, Math.max(0, Math.round(clock() - start)));
    observations.push(observation);
  }
  return observations;
}
