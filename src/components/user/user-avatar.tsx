import { castUser } from "applesauce-common/casts";
import { use$ } from "applesauce-react/hooks";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { eventStore } from "@/services/nostr";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default function UserAvatar({ pubkey, className }: { pubkey: string; className?: string }) {
  const user = useMemo(() => castUser(pubkey, eventStore), [pubkey]);
  const profile = use$(user.profile$);
  const name = profile?.displayName;

  return (
    <Avatar className={cn("h-9 w-9", className)}>
      <AvatarImage src={profile?.picture} alt={name} className="object-cover" />
      <AvatarFallback className="text-xs">{name?.slice(0, 1).toUpperCase() || pubkey.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
