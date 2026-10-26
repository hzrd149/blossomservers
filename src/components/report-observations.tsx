import { Observation, OBSERVATION_MAX_AGE, probeOutcome } from "@/helpers/report";
import { formatRelative } from "@/lib/time";

const LABELS = {
  responded: "HTTP response received (not proof of Blossom support)",
  accepted: "Test metadata accepted; actual upload/processing not tested",
  "auth-required": "Authorization challenged for this request",
  "payment-required": "Payment requested for this request",
  "policy-denied": "Request denied by policy",
  "size-rejected": "Test size rejected",
  "type-rejected": "Test MIME type rejected",
  "rate-limited": "Rate limited",
  unavailable: "Service temporarily unavailable",
  inconclusive: "Inconclusive; optional endpoint may not be implemented",
  "browser-unreachable": "Unreachable from this browser; network, CORS, TLS or redirect failure",
};

export function ReportObservations({ observations }: { observations: Observation[] }) {
  if (!observations.length) return <p className="text-xs text-muted-foreground">No server details captured yet.</p>;
  const responses = observations.filter((observation) => observation.status !== undefined);
  const latest = Math.max(...observations.map((observation) => observation.checkedAt));
  const stale = Math.floor(Date.now() / 1000) - latest > OBSERVATION_MAX_AGE;
  const captured = [
    responses.some((observation) => observation.endpoint === "root") && "Reachability",
    responses.some((observation) => observation.endpoint === "upload") && "Upload response",
    responses.some((observation) => observation.endpoint === "media") && "Media response",
    responses.some((observation) => observation.endpoint === "mirror" && observation.allow?.includes("PUT")) &&
      "Mirroring advertisement",
    responses.some((observation) => observation.payments.length) && "Payment methods",
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-sm">
        {responses.length ? `${responses.length} server responses captured` : "Could not read server details"}
        <span className="text-muted-foreground">
          {" "}
          · {formatRelative(latest)}
          {stale && " · refresh recommended"}
        </span>
      </p>
      {!!captured.length && <p className="text-xs text-muted-foreground">{captured.join(" · ")}</p>}
      {responses.length > 0 && responses.length < observations.length && (
        <p className="text-xs text-muted-foreground">Some details could not be read from this browser.</p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">View captured details</summary>
        <div className="mt-3 flex flex-col gap-3">
          {observations.map((observation) => (
            <div key={observation.endpoint}>
              <div className="font-medium">
                {observation.endpoint === "root"
                  ? "GET /"
                  : observation.endpoint === "mirror"
                    ? "OPTIONS /mirror"
                    : `HEAD /${observation.endpoint}`}
                {observation.status !== undefined && ` · HTTP ${observation.status}`}
              </div>
              <p>{LABELS[probeOutcome(observation)]}</p>
              <p className="text-xs text-muted-foreground">
                Checked {formatRelative(observation.checkedAt)} · {observation.duration} ms · anonymous
                {Math.floor(Date.now() / 1000) - observation.checkedAt > OBSERVATION_MAX_AGE && " · stale"}
              </p>
              {!!observation.payments.length && <p>Exposed payment methods: {observation.payments.join(", ")}</p>}
              {observation.allow && <p>Advertised methods (Allow): {observation.allow.join(", ")}</p>}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Upload/media checks propose a 68-byte PNG without uploading it. Unreadable headers remain unknown. Results
            describe one browser and time, not global uptime or complete BUD compliance. Method advertisements are not
            write tests.
          </p>
          <details>
            <summary className="cursor-pointer text-muted-foreground">
              Technical observations included in the report
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(observations, null, 2)}
            </pre>
          </details>
        </div>
      </details>
    </div>
  );
}
