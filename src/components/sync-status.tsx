import { use$ } from "applesauce-react/hooks";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { directorySync$, LayerState } from "@/services/sync";

const host = (relay: string) => relay.replace(/^wss?:\/\//, "").replace(/\/$/, "");

function LayerRow({ state }: { state: LayerState }) {
  const relays = Object.values(state.status?.relays ?? {});
  const finished = relays.filter((r) => ["complete", "error", "skipped"].includes(r.state)).length;

  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        {state.error ? (
          <CircleAlert size={16} className="text-red-500" />
        ) : state.status?.done ? (
          <CheckCircle2 size={16} className="text-green-600" />
        ) : (
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        )}
        <span className="flex-1 text-sm font-medium">{state.layer.label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {state.status ? `${state.status.loaded.toLocaleString()} new` : "waiting"}
        </span>
      </div>
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}
      {relays.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {relays.map((relay) => (
            <span
              key={relay.relay}
              className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              title={relay.error?.message ?? `${relay.state} via ${relay.method ?? "…"}`}
            >
              {host(relay.relay)} · {relay.state === "complete" ? relay.count : relay.state}
              {relay.method === "negentropy" && " ⇄"}
            </span>
          ))}
        </div>
      )}
      {relays.length > 0 && !state.status?.done && (
        <div className="h-1 overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(finished / relays.length) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/** A small indicator of the directory sync with a dialog showing each layer and relay */
export function SyncStatus() {
  const state = use$(directorySync$);
  const [open, setOpen] = useState(false);
  const done = state?.done ?? false;

  return (
    <>
      <button
        className="flex h-10 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent"
        onClick={() => setOpen(true)}
        title="Sync status"
      >
        {done ? <CheckCircle2 size={16} className="text-green-600" /> : <Loader2 size={16} className="animate-spin" />}
        <span className="hidden md:inline">{done ? "Synced" : state?.hydrated ? "Syncing" : "Loading cache"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Directory sync</DialogTitle>
            <DialogDescription>
              Events are loaded from your local cache, then each layer is reconciled with the relays using NIP-77
              negentropy (⇄) so only missing events are downloaded. Relays without NIP-77 fall back to paginated
              requests.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {state?.hydrated ? `${state.cached.toLocaleString()} events loaded from cache` : "Loading cache…"}
          </p>
          <div className="flex flex-col gap-2">
            {state?.layers.map((layer) => <LayerRow key={layer.layer.id} state={layer} />)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
