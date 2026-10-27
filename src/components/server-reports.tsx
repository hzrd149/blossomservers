import { CAPABILITIES, assertionFresh } from "@/helpers/report";
import { useActivePubkey } from "@/hooks/use-active-account";
import { formatRelative } from "@/lib/time";
import { ServerSummary } from "@/models/directory";
import { REPORT_FEATURE_LABELS } from "@/helpers/report-features";
import { ServerReport } from "@/casts/report";
import { useState } from "react";
import { ReportDialog } from "./report-dialog";
import { ReportObservations } from "./report-observations";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import UserAvatar from "./user/user-avatar";
import UserName from "./user/user-name";

function ReportCard({ report }: { report: ServerReport }) {
  const [expanded, setExpanded] = useState(false);
  const { name, description, claims, observations } = report.data;
  const longDescription = description.length > 240 || description.split("\n").length > 3;
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <UserAvatar pubkey={report.event.pubkey} className="h-9 w-9 shrink-0" />
        <div className="min-w-0 text-sm">
          <UserName pubkey={report.event.pubkey} />
          <p className="text-xs text-muted-foreground">Shared {formatRelative(report.event.created_at)}</p>
        </div>
      </div>
      {(name || description) && (
        <div className="min-w-0 space-y-2">
          {name && <h3 className="break-words font-medium">{name}</h3>}
          {description && (
            <p
              className={`whitespace-pre-wrap break-words text-sm ${longDescription && !expanded ? "line-clamp-3" : ""}`}
            >
              {description}
            </p>
          )}
          {longDescription && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}
      {!!claims.length && (
        <ul className="flex flex-wrap gap-2" aria-label="Reported features">
          {claims.map((claim) => {
            const fresh = assertionFresh({
              capability: claim.capability,
              value: claim.value,
              at: claim.assertedAt,
              basis: "manual",
            });
            return (
              <li key={claim.capability}>
                <Badge variant="outline" className="gap-1.5 font-normal">
                  {REPORT_FEATURE_LABELS[claim.capability][claim.value ? "yes" : "no"]}
                  {!fresh && <span className="text-muted-foreground">· older report</span>}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {!name && !description && !claims.length && (
        <p className="text-sm text-muted-foreground">
          {observations.length ? "Shared a server check." : "No features or notes shared yet."}
        </p>
      )}
      {(!!claims.length || !!observations.length) && (
        <details className="border-t pt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Report details</summary>
          <div className="mt-3 space-y-3">
            {!!claims.length && (
              <ul className="space-y-1">
                {claims.map((claim) => (
                  <li key={claim.capability}>
                    {CAPABILITIES[claim.capability]}: {claim.value ? "Yes" : "No"} · shared{" "}
                    {formatRelative(claim.assertedAt)}
                  </li>
                ))}
              </ul>
            )}
            {!!observations.length && <ReportObservations observations={observations} />}
            <p>
              Features are shared by this contributor, not independently verified. Feature reports leave filters after
              90 days; browser checks after 24 hours.
            </p>
          </div>
        </details>
      )}
    </article>
  );
}

export function ServerReports({ server }: { server: ServerSummary }) {
  const pubkey = useActivePubkey();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        What people know about this server’s features. Share what you’ve found to help others choose.
      </p>
      <ReportDialog url={server.url}>
        <Button className="self-start">
          {server.contributors.has(pubkey ?? "") ? "Edit my report" : "Contribute a report"}
        </Button>
      </ReportDialog>
      {server.reports.length === 0 && (
        <p className="text-muted-foreground">No reports yet. Know this server? Be the first to share its features.</p>
      )}
      {server.reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
      {!!server.announcements.length && (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">Legacy announcements ({server.announcements.length})</summary>
          <p className="my-2 text-xs text-muted-foreground">
            Historical contributor descriptions. Missing payment/access tags are unknown, not proof of free or open
            service. These are not current capability reports.
          </p>
          {server.announcements.map((announcement) => (
            <article key={announcement.id} className="flex flex-col gap-2 border-t py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <UserName pubkey={announcement.event.pubkey} />
                <span className="text-muted-foreground">{formatRelative(announcement.event.created_at)}</span>
                {server.contributors.has(announcement.event.pubkey) && (
                  <span className="text-muted-foreground">· newer-format report available above</span>
                )}
              </div>
              <p className="font-medium">{announcement.name}</p>
              <p className="whitespace-pre-wrap break-words">{announcement.description}</p>
              {announcement.paid && (
                <p>Reported payment: {typeof announcement.paid === "string" ? announcement.paid : "Required"}</p>
              )}
              {announcement.whitelist && (
                <p>
                  Reported access restriction:{" "}
                  {typeof announcement.whitelist === "string" ? announcement.whitelist : "Restricted"}
                </p>
              )}
            </article>
          ))}
        </details>
      )}
    </div>
  );
}
