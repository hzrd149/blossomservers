import { CAPABILITIES, Capability, assertionFresh } from "@/helpers/report";
import { useActivePubkey } from "@/hooks/use-active-account";
import { formatRelative } from "@/lib/time";
import { ServerSummary } from "@/models/directory";
import { ReportDialog } from "./report-dialog";
import { ReportObservations } from "./report-observations";
import { Button } from "./ui/button";
import UserAvatar from "./user/user-avatar";
import UserName from "./user/user-name";

export function ServerReports({ server }: { server: ServerSummary }) {
  const pubkey = useActivePubkey();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Independent reports about this URL, not statements of ownership. Contributors may disagree or repeat incorrect
        information. Manual assertions expire from filters after 90 days; browser observations after 24 hours.
      </p>
      <ReportDialog url={server.url}>
        <Button className="self-start">
          {server.contributors.has(pubkey ?? "") ? "Edit my report" : "Contribute a report"}
        </Button>
      </ReportDialog>
      {server.reports.length === 0 && (
        <p className="text-muted-foreground">
          No capability reports yet. Reviews, legacy announcements and server lists can introduce a server without a
          report.
        </p>
      )}
      {server.reports.map((report) => (
        <article key={report.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <UserAvatar pubkey={report.event.pubkey} className="h-7 w-7" />
            <UserName pubkey={report.event.pubkey} />
            <span className="text-muted-foreground">Report published {formatRelative(report.event.created_at)}</span>
          </div>
          {report.data.name && <p className="font-medium">Suggested name: {report.data.name}</p>}
          {report.data.description && (
            <p className="whitespace-pre-wrap break-words text-sm">{report.data.description}</p>
          )}
          {report.data.claims.length > 0 && (
            <ul className="space-y-1 text-sm">
              {report.data.claims.map((claim) => (
                <li key={claim.capability}>
                  {CAPABILITIES[claim.capability as Capability]}: <strong>{claim.value ? "Yes" : "No"}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    · manually reported {formatRelative(claim.assertedAt)}
                    {!assertionFresh({
                      capability: claim.capability,
                      value: claim.value,
                      at: claim.assertedAt,
                      basis: "manual",
                    }) && " · stale"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ReportObservations observations={report.data.observations} />
        </article>
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
