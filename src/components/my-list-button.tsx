import { AddBlossomServer, RemoveBlossomServer } from "applesauce-actions/actions";
import { castUser } from "applesauce-common/casts";
import { use$ } from "applesauce-react/hooks";
import { Check, Plus } from "lucide-react";
import { useState } from "react";

import { Button, ButtonProps } from "@/components/ui/button";
import { safeNormalizeServerUrl } from "@/helpers/server";
import { useActivePubkey } from "@/hooks/use-active-account";
import { eventStore } from "@/services/nostr";
import { actions } from "@/services/publish";
import { openLogin } from "./login-dialog";

/** The active user's ordered BUD-03 server list as normalized URLs */
export function useMyServers() {
  const pubkey = useActivePubkey();
  const servers = use$(() => (pubkey ? castUser(pubkey, eventStore).blossomServers$ : undefined), [pubkey]);
  return servers?.map((url) => safeNormalizeServerUrl(url)).filter((url) => url !== null);
}

/** Adds or removes a server from the active user's BUD-03 server list */
export function MyListButton({ url, ...props }: { url: string } & Omit<ButtonProps, "onClick">) {
  const pubkey = useActivePubkey();
  const servers = useMyServers();
  const [busy, setBusy] = useState(false);
  const listed = servers?.includes(url) ?? false;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pubkey) return openLogin();

    setBusy(true);
    try {
      await actions.run(listed ? RemoveBlossomServer : AddBlossomServer, url);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={listed ? "secondary" : "outline"}
      size="sm"
      disabled={busy}
      onClick={toggle}
      title={listed ? "Remove from your server list" : "Add to your server list"}
      {...props}
    >
      {listed ? <Check size={16} /> : <Plus size={16} />}
      {listed ? "In my list" : "Add to my list"}
    </Button>
  );
}
