import { use$ } from "applesauce-react/hooks";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_LOOKUP_RELAYS, DIRECTORY_RELAYS } from "@/const";
import { useTheme } from "@/hooks/use-theme";
import { accountRelays$, appRelays$, eventRelays, lookupRelays$, normalizeRelays } from "@/services/settings";
import { saveLookupRelays } from "@/services/save-lookup-relays";

function RelayEditor({
  title,
  description,
  values,
  defaults,
  disabled,
  onSave,
}: {
  title: string;
  description: string;
  values: string[];
  defaults: string[];
  disabled?: boolean;
  onSave: (relays: string[]) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function save() {
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const relays = normalizeRelays((draft ?? values.join("\n")).split(/\s+/).filter(Boolean));
      if (!relays.length) throw new Error("Add at least one relay.");
      await onSave(relays);
      setDraft(undefined);
      setMessage("Saved.");
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const id = title.toLowerCase().replace(/ /g, "-");
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">
        <label htmlFor={id}>{title}</label>
      </h2>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        {description} Enter one relay domain or URL per line. Domains default to wss://.
      </p>
      <Textarea
        id={id}
        aria-describedby={`${id}-help`}
        rows={6}
        value={draft ?? values.join("\n")}
        disabled={busy || disabled}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage("");
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || disabled || draft === undefined} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="outline"
          disabled={busy || disabled}
          onClick={() => {
            setDraft(defaults.join("\n"));
            setMessage("Defaults selected. Save to apply.");
            setError(false);
          }}
        >
          Reset to defaults
        </Button>
        {draft !== undefined && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setDraft(undefined);
              setMessage("");
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message}
        </p>
      )}
    </section>
  );
}

export default function SettingsView() {
  const app = use$(appRelays$) ?? appRelays$.value;
  const lookup = use$(lookupRelays$) ?? DEFAULT_LOOKUP_RELAYS;
  const account = use$(accountRelays$) ?? accountRelays$.value;
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Choose the relays this app uses and customize its appearance." />
      <RelayEditor
        title="App relays"
        description="Saved on this device. Always used for reading and publishing, alongside your account relays."
        values={app}
        defaults={DIRECTORY_RELAYS}
        onSave={(relays) => appRelays$.next(relays)}
      />
      <RelayEditor
        key={account.pubkey ?? "anonymous"}
        title="Lookup relays"
        description={
          account.loading
            ? "Loading your relay lists…"
            : account.lookup
              ? "Saving updates your existing public Nostr lookup-relay list."
              : "Saved on this device. No Nostr lookup-relay list will be created."
        }
        values={lookup}
        defaults={DEFAULT_LOOKUP_RELAYS}
        disabled={account.loading}
        onSave={(relays) => saveLookupRelays(relays, account.pubkey)}
      />
      {account.pubkey && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Account relays</h2>
          <p className="text-sm text-muted-foreground">
            Additional relays from your NIP-65 list. Manage these in your Nostr client.
          </p>
          {(["read", "write"] as const).map((marker) => (
            <div key={marker}>
              <h3 className="font-medium">{marker === "read" ? "Read relays" : "Outboxes (publishing)"}</h3>
              <ul className="break-all text-sm text-muted-foreground">
                {eventRelays(account.mailboxes, marker).map((relay) => (
                  <li key={relay}>{relay}</li>
                ))}
              </ul>
              {!eventRelays(account.mailboxes, marker).length && (
                <p className="text-sm text-muted-foreground">{account.loading ? "Loading…" : "None found."}</p>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <Button variant="outline" onClick={toggleTheme}>
          Switch to {theme === "dark" ? "light" : "dark"} theme
        </Button>
      </section>
    </div>
  );
}
