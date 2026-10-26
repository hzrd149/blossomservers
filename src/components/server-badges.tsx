import { Badge } from "@/components/ui/badge";
import { capabilityEvidence, ServerSummary } from "@/models/directory";

/** Badges describing how a server can be used */
export function ServerBadges({ server }: { server: ServerSummary }) {
  const labels: [string, string][] = [
    ["upload", "Uploads"],
    ["mirror", "Mirroring"],
    ["media", "Media optimization"],
    ["upload-auth", "Upload authorization required"],
    ["upload-payment", "Upload payment required"],
    ["restricted-uploads", "Restricted uploads"],
    ["upload-preflight-accepted", "Upload preflight accepted"],
    ["media-preflight-accepted", "Media preflight accepted"],
    ["upload-put-advertised", "Uploads · advertised"],
    ["mirror-put-advertised", "Mirroring · advertised"],
    ["media-put-advertised", "Media optimization · advertised"],
    ["upload-payment-challenge", "Upload payment requested · observed"],
    ["upload-auth-challenge", "Upload authorization challenged · observed"],
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {!server.reports.length && <Badge variant="outline">No capability reports</Badge>}
      {labels.map(([capability, label]) => {
        const evidence = capabilityEvidence(server, capability);
        if (!evidence.positive && !evidence.negative) return null;
        return (
          <Badge
            key={capability}
            variant="secondary"
            title={`${evidence.positive} current positive reports; ${evidence.negative} negative. View Reports for sources and dates.`}
          >
            {label}
            {evidence.state === "conflicting"
              ? " · conflicting"
              : evidence.state === "reported-absent"
                ? " · reported no"
                : capability.endsWith("accepted") ||
                    capability.endsWith("challenge") ||
                    capability.endsWith("advertised")
                  ? ""
                  : " · reported"}
          </Badge>
        );
      })}
    </div>
  );
}
