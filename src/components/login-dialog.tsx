import { ExtensionAccount, NostrConnectAccount } from "applesauce-accounts/accounts";
import { use$ } from "applesauce-react/hooks";
import { NostrConnectSigner } from "applesauce-signers";
import { KeyRound, Link2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { BehaviorSubject } from "rxjs";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NOSTR_CONNECT_RELAYS } from "@/const";
import { accounts } from "@/services/accounts";
import CopyButton from "./copy-button";

/** Whether the login dialog is open, any component can open it */
export const loginDialog$ = new BehaviorSubject(false);
export const openLogin = () => loginDialog$.next(true);

type Method = "extension" | "bunker" | "qr";

function useLogin(onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (login: () => Promise<ExtensionAccount | NostrConnectAccount>) => {
    setError(null);
    setBusy(true);
    try {
      const account = await login();
      // Reuse an existing account for the same pubkey and signer type
      const existing = accounts.getAccountsForPubkey(account.pubkey).find((a) => a.type === account.type);
      if (existing) accounts.replaceAccount(existing, account);
      else accounts.addAccount(account);
      accounts.setActive(account);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return { error, busy, run };
}

function ExtensionLogin({ onDone }: { onDone: () => void }) {
  const { error, busy, run } = useLogin(onDone);
  const available = typeof window !== "undefined" && !!window.nostr;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Use a NIP-07 browser extension like Alby, nos2x or Keys.band to sign in.
      </p>
      <Button onClick={() => run(() => ExtensionAccount.fromExtension())} disabled={busy}>
        {busy ? "Waiting for extension…" : "Sign in with extension"}
      </Button>
      {!available && <p className="text-xs text-muted-foreground">No extension was detected in this browser.</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

function BunkerLogin({ onDone }: { onDone: () => void }) {
  const { error, busy, run } = useLogin(onDone);
  const [uri, setUri] = useState("");

  const connect = () =>
    run(async () => {
      const signer = await NostrConnectSigner.fromBunkerURI(uri.trim());
      const pubkey = await signer.getPublicKey();
      return new NostrConnectAccount(pubkey, signer);
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        connect();
      }}
    >
      <p className="text-sm text-muted-foreground">Paste a bunker:// URL from your remote signer (nsec.app, Amber…).</p>
      <Input placeholder="bunker://…" value={uri} onChange={(e) => setUri(e.target.value)} autoComplete="off" />
      <Button type="submit" disabled={busy || !uri.trim().startsWith("bunker://")}>
        {busy ? "Connecting…" : "Connect"}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}

function QRLogin({ onDone }: { onDone: () => void }) {
  const { error, run } = useLogin(onDone);
  const [uri, setUri] = useState<string | null>(null);

  // Start a nostrconnect:// session and wait for a signer to scan it
  useEffect(() => {
    const signer = new NostrConnectSigner({ relays: NOSTR_CONNECT_RELAYS });
    const controller = new AbortController();
    let handedOff = false;

    setUri(signer.getNostrConnectURI({ name: "Blossom Servers", url: location.origin }));
    run(async () => {
      await signer.waitForSigner(controller.signal);
      handedOff = true;
      const pubkey = await signer.getPublicKey();
      return new NostrConnectAccount(pubkey, signer);
    });

    return () => {
      controller.abort();
      if (!handedOff) void signer.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground text-center">
        Scan with a NIP-46 signer app on your phone, or open the link on this device.
      </p>
      {uri && (
        <>
          <a href={uri} className="rounded-lg bg-white p-3">
            <QRCodeSVG value={uri} size={200} />
          </a>
          <div className="flex w-full items-center gap-2">
            <Input value={uri} readOnly className="font-mono text-xs" />
            <CopyButton data={uri} variant="outline" title="Copy link" aria-label="Copy link" />
          </div>
        </>
      )}
      {error && error !== "Aborted" && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

const METHODS: { id: Method; label: string; icon: typeof KeyRound }[] = [
  { id: "extension", label: "Extension", icon: KeyRound },
  { id: "bunker", label: "Bunker", icon: Link2 },
  { id: "qr", label: "QR code", icon: QrCode },
];

export function LoginDialog() {
  const open = use$(loginDialog$);
  const [method, setMethod] = useState<Method>(() => (window.nostr ? "extension" : "qr"));
  const close = () => loginDialog$.next(false);

  return (
    <Dialog open={open} onOpenChange={(v) => loginDialog$.next(v)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>Sign in with Nostr to review servers, comment and manage your server list.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {METHODS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                method === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {method === "extension" && <ExtensionLogin onDone={close} />}
        {method === "bunker" && <BunkerLogin onDone={close} />}
        {method === "qr" && <QRLogin onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

declare global {
  interface Window {
    nostr?: unknown;
  }
}
