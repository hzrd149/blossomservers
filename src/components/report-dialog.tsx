import { DeleteFactory } from "applesauce-core/factories";
import { use$ } from "applesauce-react/hooks";
import { ReactNode, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ServerReport } from "@/casts/report";
import { ServerAnnouncement } from "@/casts/server";
import { ServerReportFactory } from "@/factories";
import {
  CAPABILITIES,
  Capability,
  detectedCapability,
  emptyReport,
  PROBE_SUITE,
  reportServerUrl,
  ServerReportData,
} from "@/helpers/report";
import { getServerPath } from "@/helpers/server";
import { useActivePubkey } from "@/hooks/use-active-account";
import { serverSummary$ } from "@/models/directory";
import { probeServer } from "@/services/probe";
import { signAndPublish } from "@/services/publish";
import { openLogin } from "./login-dialog";
import { ReportObservations } from "./report-observations";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

function ReportEditor({
  url,
  report,
  legacy,
  close,
}: {
  url: string;
  report?: ServerReport;
  legacy?: ServerAnnouncement;
  close: () => void;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<ServerReportData>(() => report?.data ?? emptyReport());
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);

  const claim = (capability: Capability, value: string) =>
    setData((previous) => ({
      ...previous,
      claims: [
        ...previous.claims.filter((claim) => claim.capability !== capability),
        ...(value === "unknown"
          ? []
          : [{ capability, value: value === "yes", assertedAt: Math.floor(Date.now() / 1000) }]),
      ],
    }));
  const check = async () => {
    const current = new AbortController();
    controller.current = current;
    setChecking(true);
    setError(undefined);
    try {
      const observations = await probeServer(url, { signal: current.signal });
      if (!current.signal.aborted) setData((previous) => ({ ...previous, observations, probeSuite: PROBE_SUITE }));
    } catch (error) {
      if (!current.signal.aborted) setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (!current.signal.aborted) setChecking(false);
    }
  };
  const run = async (remove = false) => {
    setBusy(true);
    setError(undefined);
    try {
      await signAndPublish(
        remove
          ? DeleteFactory.fromEvents([report!.event], "Withdraw server report")
          : ServerReportFactory.create(url, data),
      );
      close();
      if (!remove) navigate(getServerPath(url));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const importLegacy = () => {
    const next = emptyReport();
    next.name = legacy!.name.slice(0, 120);
    next.description = legacy!.description.slice(0, 4000);
    const at = legacy!.event.created_at;
    if (legacy!.paid) next.claims.push({ capability: "upload-payment", value: true, assertedAt: at });
    if (legacy!.whitelist) next.claims.push({ capability: "restricted-uploads", value: true, assertedAt: at });
    setData(next);
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void run();
      }}
    >
      <p className="break-all text-sm font-medium">{url}</p>
      {legacy && !report && (
        <div className="rounded-lg border p-3 text-sm">
          <p>
            You have a legacy announcement. Importing copies its description and explicit payment/restriction flags for
            review; missing flags stay unknown. Nothing is published or deleted yet.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={importLegacy}>
            Import my legacy details
          </Button>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="report-name">Suggested name (optional)</Label>
        <Input
          id="report-name"
          maxLength={120}
          value={data.name}
          onChange={(event) => setData({ ...data, name: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="report-description">Your description (optional)</Label>
        <Textarea
          id="report-description"
          maxLength={4000}
          value={data.description}
          onChange={(event) => setData({ ...data, description: event.target.value })}
        />
      </div>
      <section className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium">Server details</h3>
            <p className="mt-1 text-xs text-muted-foreground">Read available details without uploading or paying.</p>
          </div>
          <Button type="button" variant="outline" disabled={checking || busy} onClick={() => void check()}>
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
            {checking ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        <div className="mt-3" role="status" aria-live="polite">
          <ReportObservations observations={data.observations} />
        </div>
      </section>
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">Capabilities and policies</legend>
        <p className="mb-4 text-sm text-muted-foreground">
          Captured details appear below. Your selections are separate claims; leave anything you cannot confirm as
          Unknown.
        </p>
        <div className="divide-y rounded-xl border px-4">
          {(Object.entries(CAPABILITIES) as [Capability, string][]).map(([capability, label]) => {
            const existing = data.claims.find((item) => item.capability === capability);
            const detected = detectedCapability(capability, data.observations);
            return (
              <div key={capability} className="flex items-center justify-between gap-4 py-4 text-sm">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`claim-${capability}`} className="leading-relaxed">
                    {label}
                  </Label>
                  {detected && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Server: {detected}</p>}
                </div>
                <Select
                  id={`claim-${capability}`}
                  className="w-28 shrink-0 sm:w-36"
                  aria-label={`${label} — your claim`}
                  disabled={busy}
                  value={existing ? (existing.value ? "yes" : "no") : "unknown"}
                  onChange={(event) => claim(capability, event.target.value)}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </div>
            );
          })}
        </div>
      </fieldset>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Advanced · preview report data</summary>
        <p className="mt-3 text-xs text-muted-foreground">
          Unchanged claims retain their dates. To reaffirm one, select Unknown, then its value again. Refresh sends four
          anonymous requests from your network; closing this dialog cancels unfinished checks.
        </p>
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(data, null, 2)}</pre>
        {!!data.observations.length && (
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            disabled={checking || busy}
            onClick={() => setData({ ...data, observations: [] })}
          >
            Remove captured details
          </Button>
        )}
      </details>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {confirmDelete ? (
        <div className="rounded border p-3 text-sm">
          <p>
            Withdraw only your report? Other contributions and the server entry are not deleted. Relays may retain
            copies.
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void run(true)}>
              Withdraw my report
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-between gap-2">
          {report ? (
            <Button type="button" variant="ghost" disabled={busy || checking} onClick={() => setConfirmDelete(true)}>
              Delete my report
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={busy || checking}>
            {busy ? "Publishing…" : report ? "Save my report" : "Publish my report"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function ReportDialog({ url, children }: { url?: string; children: ReactNode }) {
  const pubkey = useActivePubkey();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState(url);
  useEffect(() => {
    setOpen(false);
  }, [pubkey]);
  const normalized = reportServerUrl(input);
  const server = use$(() => (open && selected ? serverSummary$(selected) : undefined), [open, selected]);
  const mine = server?.reports.find((report) => report.event.pubkey === pubkey);
  const legacy = server?.announcements.find((announcement) => announcement.event.pubkey === pubkey);
  const changeOpen = (value: boolean) => {
    if (value && !pubkey) {
      openLogin();
      return;
    }
    if (value) {
      setSelected(url);
      setInput("");
    }
    setOpen(value);
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-[840px] sm:p-8">
        <DialogHeader>
          <DialogTitle>{mine ? "Edit my server report" : "Report server capabilities"}</DialogTitle>
          <DialogDescription>
            Share what you know about a server. Reports do not establish ownership, operator status or independent
            verification.
          </DialogDescription>
        </DialogHeader>
        {!selected ? (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (normalized) setSelected(normalized);
            }}
          >
            <Label htmlFor="report-url">Public HTTPS server URL</Label>
            <Input
              id="report-url"
              value={input}
              placeholder="https://cdn.example.com"
              onChange={(event) => setInput(event.target.value)}
              required
            />
            {input && !normalized && (
              <p className="text-sm text-muted-foreground">
                Use a public HTTPS domain without credentials. Local addresses are not supported.
              </p>
            )}
            <Button type="submit" disabled={!normalized}>
              Continue
            </Button>
          </form>
        ) : reportServerUrl(selected) ? (
          <ReportEditor
            key={`${pubkey}/${selected}/${mine?.event.id ?? "new"}`}
            url={selected}
            report={mine}
            legacy={legacy}
            close={() => setOpen(false)}
          />
        ) : (
          <p className="text-sm">Reports and browser checks currently require a public HTTPS domain.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
