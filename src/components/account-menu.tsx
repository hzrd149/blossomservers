import { castUser } from "applesauce-common/casts";
import { use$ } from "applesauce-react/hooks";
import { Check, LogOut, Plus, Server, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { accounts } from "@/services/accounts";
import { eventStore } from "@/services/nostr";
import { openLogin } from "./login-dialog";
import UserAvatar from "./user/user-avatar";
import UserName from "./user/user-name";

const TYPE_LABELS: Record<string, string> = {
  extension: "Extension",
  "nostr-connect": "Remote signer",
};

export function AccountMenu() {
  const active = use$(accounts.active$);
  const all = use$(accounts.accounts$);
  const [open, setOpen] = useState(false);
  const npub = useMemo(() => (active ? castUser(active.pubkey, eventStore).npub : undefined), [active]);

  if (!active)
    return (
      <Button variant="outline" onClick={openLogin}>
        Sign in
      </Button>
    );

  const signOut = () => {
    // Close remote signer connections, then forget the account
    const signer = active.signer as { close?: () => unknown };
    void signer.close?.();
    accounts.removeAccount(active);
    setOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            className="shrink-0 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Account"
          >
            <UserAvatar pubkey={active.pubkey} />
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-lg p-4 sm:p-6">
          <DialogHeader className="pr-6 text-left">
            <DialogTitle>Account</DialogTitle>
            <DialogDescription>Manage your signed-in profile and accounts.</DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
            <UserAvatar pubkey={active.pubkey} className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <UserName pubkey={active.pubkey} link={false} className="block whitespace-normal break-words" />
              <div className="truncate font-mono text-xs text-muted-foreground" title={npub}>
                {npub}
              </div>
              <div className="break-words text-xs text-muted-foreground">{TYPE_LABELS[active.type] ?? active.type}</div>
            </div>
          </div>

          <div className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild onClick={() => setOpen(false)}>
              <Link to="/me">
                <Server size={16} /> My servers
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild onClick={() => setOpen(false)}>
              <Link to={`/user/${npub}`}>
                <UserRound size={16} /> Public profile
              </Link>
            </Button>
          </div>

          {all.length > 1 && (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 border-t pt-3">
              <h3 className="text-sm font-medium text-muted-foreground">Switch account</h3>
              {all.map((account) => (
                <button
                  key={account.id}
                  className="flex min-w-0 items-center gap-2 rounded-md p-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => accounts.setActive(account)}
                >
                  <UserAvatar pubkey={account.pubkey} className="h-7 w-7 shrink-0" />
                  <UserName pubkey={account.pubkey} link={false} className="min-w-0 flex-1 text-sm" />
                  {account.id === active.id && <Check size={16} className="shrink-0" aria-label="Current account" />}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-2 border-t pt-3">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                setOpen(false);
                openLogin();
              }}
            >
              <Plus size={16} /> Add account
            </Button>
            <Button variant="ghost" className="justify-start text-destructive hover:text-destructive" onClick={signOut}>
              <LogOut size={16} /> Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
