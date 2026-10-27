import { Badge } from "@/components/ui/badge";
import { capabilityEvidence, ServerSummary } from "@/models/directory";
import { Clock, Image, KeyRound, LockKeyhole, Repeat2, Upload, Wallet } from "lucide-react";
import { Capability } from "@/helpers/report";
import { REPORT_FEATURE_LABELS } from "@/helpers/report-features";

const FEATURES = [
  { capability: "upload", label: "Uploads", icon: Upload },
  { capability: "mirror", label: "Mirroring", icon: Repeat2 },
  { capability: "media", label: "Media", icon: Image },
  { capability: "upload-auth", label: "Auth required", icon: KeyRound },
  { capability: "upload-payment", label: "Paid uploads", icon: Wallet },
  { capability: "restricted-uploads", label: "Restricted", icon: LockKeyhole },
] satisfies { capability: Capability; label: string; icon: typeof Upload }[];

/** Community claims only; browser preflights are not proof of feature support. */
export function ServerBadges({ server }: { server: ServerSummary }) {
  const features = FEATURES.map((feature) => ({
    ...feature,
    evidence: capabilityEvidence(server, feature.capability),
  })).filter(({ evidence }) => evidence.evidence.length > 0);

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Community-reported features">
      {!features.length && <span className="text-xs text-muted-foreground">No features shared yet</span>}
      {features.flatMap(({ capability, label, icon: Icon, evidence }) => {
        const stale = evidence.state === "stale";
        const description = `${label}: ${stale ? "older reports only" : `${evidence.positive} reported yes, ${evidence.negative} reported no`}. ${evidence.state === "conflicting" ? "Contributors disagree. " : ""}Community reports, not verified. View Reports for details.`;
        return [true, false].map((value) => {
          const count = stale
            ? evidence.evidence.filter((assertion) => assertion.value === value).length
            : value
              ? evidence.positive
              : evidence.negative;
          if (!count) return null;
          const featureLabel = REPORT_FEATURE_LABELS[capability][value ? "yes" : "no"];
          return (
            <Badge
              key={`${capability}/${value}`}
              variant="outline"
              className={`gap-1.5 py-1 font-normal ${stale ? "text-muted-foreground" : ""}`}
              title={`${featureLabel}: ${count} ${stale ? "older" : "current"} reports. ${description}`}
              aria-label={`${featureLabel}: ${count} ${stale ? "older" : "current"} reports. ${description}`}
              tabIndex={0}
            >
              <Icon size={13} aria-hidden="true" />
              {featureLabel}
              {evidence.state === "conflicting" && <span className="text-muted-foreground">· mixed reports</span>}
              {stale && <Clock size={12} aria-hidden="true" />}
            </Badge>
          );
        });
      })}
    </div>
  );
}
